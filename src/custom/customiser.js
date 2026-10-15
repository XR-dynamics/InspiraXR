import * as THREE from 'three';
import { CUSTOMISE, WALL_SWATCHES } from './config.js';
import { ENVIRONMENTS, ORIGINAL_ENVIRONMENT } from './environment.js';
import { activeLayout, roomInfo } from '../layouts/active.js';

/*
 * The customisation controller. It owns all state (targeted wall, locked wall, open tab,
 * pending confirmation) and every action. The panel itself is described as plain data by
 * getSchema(); the desktop DOM panel and the in-headset canvas panel both render that same
 * description, so the two can never disagree about what a control does.
 */


export class Customiser {
  constructor({ camera, world, lighting, walls, furniture, getRoom, getHead, home = null, toast = () => {}, storage = defaultStorage() }) {
    this.home = home;           // whole-home controls (lights, curtains, breeze, doors, blueprint), or null
    this.camera = camera;
    this.world = world;
    this.lighting = lighting;
    this.walls = walls;
    this.furniture = furniture;
    this.getRoom = getRoom;     // () => room key under the visitor
    this.getHead = getHead;     // (Vector3) => world position of the viewer's eyes
    this.toast = toast;
    this.storage = storage;

    this.state = {
      open: false,
      tab: 'walls',
      wallId: null,        // the wall locked while the panel is open
      dialog: null,        // { kind: 'empty'|'reset', scope? }
      pickHex: '#d4c2a2',  // working colour of the picker
      note: '',
    };
    this.target = null;           // the wall currently pointed at (not yet opened)
    this.targetLostAt = 0;
    this.environment = ORIGINAL_ENVIRONMENT;
    this.lastActivation = 0;
    this.listeners = new Map();
    this.raycaster = new THREE.Raycaster();
    this._head = new THREE.Vector3();
    this._saveTimer = 0;
    this.persist = true;
    this.occluderExtras = () => [];   // e.g. doors, curtains and switches that can stand in front of a wall
  }

  // --------------------------------------------------------------- events
  on(evt, fn) {
    if (!this.listeners.has(evt)) this.listeners.set(evt, new Set());
    this.listeners.get(evt).add(fn);
    return () => this.listeners.get(evt).delete(fn);
  }
  emit(evt, data) { this.listeners.get(evt)?.forEach((fn) => fn(data)); }
  changed() { this.emit('schema'); this.save(); }

  // ------------------------------------------------------------- targeting
  /**
   * Which wall is this ray pointing at? Only the nearest thing along the ray counts, so a wall
   * behind a sofa, a door or a pane of glass is never selected. The wall must also be within
   * `proximity` metres of the viewer's head.
   */
  queryWall(origin, dir) {
    this.getHead(this._head);
    const reach = CUSTOMISE.proximity + origin.distanceTo(this._head) + 0.2;
    this.raycaster.set(origin, dir);
    this.raycaster.far = reach;
    // 1) cheap: is a wall within reach along this ray at all?
    const hit = this.raycaster.intersectObjects(this.walls.meshes, false)[0];
    if (!hit) return null;
    const id = this.walls.faceAt(hit.object, hit.faceIndex);
    if (!id) return null;
    const distance = this._head.distanceTo(hit.point);
    if (distance > CUSTOMISE.proximity) return null;
    // 2) only now pay for occlusion: anything solid between the viewer and the wall hides it
    this.raycaster.far = hit.distance - 0.02;
    if (this.raycaster.intersectObjects([...this.furniture.occluderMeshes(), ...this.occluderExtras()], false).length) return null;
    const face = this.walls.get(id);
    return { id, label: face.label, point: hit.point.clone(), normal: face.normal, distance };
  }

  /** Update the (unlocked) target. Passing null clears it after a short grace period. */
  setTarget(t, now = performance.now()) {
    if (this.state.open) return;
    if (t) { this.targetLostAt = 0; }
    else if (this.target) {
      if (!this.targetLostAt) this.targetLostAt = now;
      if (now - this.targetLostAt < 160) return; // avoid flicker on ray jitter
    }
    const same = (!t && !this.target) || (t && this.target && t.id === this.target.id);
    this.target = t;
    if (!same) {
      this.walls.highlight(t ? t.id : null);
      this.emit('target', t);
    }
  }

  /** Distance from `origin` along `dir` to the first wall, furniture or built-in (or `far` if the way is clear). */
  clearance(origin, dir, far) {
    this.raycaster.set(origin, dir);
    this.raycaster.far = far;
    const hit = this.raycaster.intersectObjects([...this.walls.meshes, ...this.furniture.occluderMeshes(), ...this.occluderExtras()], false)[0];
    return hit ? hit.distance : far;
  }

  /** Drop the target immediately (no flicker grace), e.g. when the viewer has walked out of range. */
  clearTarget() {
    if (this.state.open || !this.target) return;
    this.target = null;
    this.targetLostAt = 0;
    this.walls.highlight(null);
    this.emit('target', null);
  }

  // ----------------------------------------------------------------- panel
  /** Rate-limit activations so one trigger pull can never fire twice. */
  cooldown(now = performance.now()) {
    if (now - this.lastActivation < CUSTOMISE.cooldownMs) return false;
    this.lastActivation = now;
    return true;
  }

  open({ wallId = this.target?.id ?? null, tab = null } = {}) {
    if (this.state.open) return;
    this.state.open = true;
    this.state.wallId = wallId;
    this.state.dialog = null;
    this.state.note = '';
    this.state.tab = tab || (wallId ? 'walls' : this.state.tab);
    if (wallId) {
      this.walls.highlight(wallId);
      this.state.pickHex = this.walls.get(wallId)?.hex || this.state.pickHex;
    }
    this.emit('open');
    this.emit('schema');
  }

  close() {
    if (!this.state.open) return;
    this.furniture.deselect();
    this.state.open = false;
    this.state.dialog = null;
    this.state.wallId = null;
    this.target = null;
    this.walls.highlight(null);
    this.emit('close');
    this.emit('target', null);
    this.save();
  }

  setTab(tab) {
    if (this.state.tab === tab) return;
    this.state.tab = tab;
    this.state.dialog = null;
    if (tab !== 'furniture') this.furniture.deselect();
    this.emit('schema');
  }

  say(text) { this.state.note = text; this.toast(text); this.emit('schema'); }

  // --------------------------------------------------------------- actions
  paintSelected(hex, commit = true) {
    const id = this.state.wallId;
    if (!id) return;
    this.state.pickHex = hex;
    this.walls.paint(id, hex);
    this.emit('paint');
    if (commit) this.changed();
  }
  applyToAll() {
    const hex = this.state.pickHex;
    this.walls.paintAll(hex);
    this.say('Applied to all interior walls');
    this.changed();
  }
  restoreWall() {
    const id = this.state.wallId;
    if (!id) return;
    this.walls.paint(id, null);
    this.say('Wall restored');
    this.changed();
  }
  setEnvironment(id, instant = false) {
    this.environment = id;
    this.lighting.setMode(id, instant);
    this.emit('environment', id);
    this.changed();
  }
  restoreEnvironment() { this.setEnvironment(ORIGINAL_ENVIRONMENT); this.say('Original lighting restored'); }

  roomName(key) { return roomInfo(key)?.name || 'this area'; }
  currentSpace() { return this.getRoom() || 'terrace'; }

  askEmpty(scope) { this.state.dialog = { kind: 'empty', scope }; this.emit('schema'); }
  askReset() { this.state.dialog = { kind: 'reset' }; this.emit('schema'); }
  cancelDialog() { this.state.dialog = null; this.emit('schema'); }
  confirmDialog() {
    const d = this.state.dialog;
    this.state.dialog = null;
    if (!d) return;
    if (d.kind === 'empty') {
      const n = this.furniture.empty(d.scope);
      this.say(n ? `Removed ${n} pieces` : 'Nothing to remove here');
    } else if (d.kind === 'reset') {
      this.resetRoom();
    }
    this.changed();
  }
  restoreFurniture() {
    const n = this.furniture.restoreHidden();
    this.say(n ? `Restored ${n} pieces` : 'Nothing to restore');
    this.changed();
  }
  resetRoom() {
    this.walls.restoreAll();
    this.furniture.resetAll();
    this.environment = ORIGINAL_ENVIRONMENT;
    this.lighting.setMode(ORIGINAL_ENVIRONMENT);
    this.state.pickHex = '#d4c2a2';
    this.emit('environment', this.environment);
    this.say('Room reset to the original design');
    this.changed();
  }

  selectFurniture(id) {
    if (this.furniture.select(id)) { this.state.note = ''; this.emit('schema'); return true; }
    return false;
  }
  rotate(dir) {
    const ok = this.furniture.rotateBy(dir * CUSTOMISE.rotateStep);
    if (!ok) this.say('No room to turn it there');
    else this.changed();
  }
  nudge(forward, right) {
    // relative to where the visitor is looking, so "forward" means away from you
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    const f = Math.abs(d.x) > Math.abs(d.z) ? new THREE.Vector3(Math.sign(d.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(d.z) || -1);
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const step = this.furniture.snap ? CUSTOMISE.gridSnap : CUSTOMISE.nudge;
    const ok = this.furniture.nudge((f.x * forward + r.x * right) * step, (f.z * forward + r.z * right) * step);
    if (!ok) this.say("Can't move it any further that way");
    else this.changed();
  }
  toggleSnap() { this.furniture.snap = !this.furniture.snap; this.emit('schema'); }
  cancelEdit() { this.furniture.cancel(); this.changed(); }
  resetPiece() {
    if (this.furniture.resetItem()) this.say('Returned to its original place');
    else this.say("Original spot is occupied");
    this.changed();
  }
  doneEdit() { this.furniture.deselect(); this.emit('schema'); }

  // -------------------------------------------------------------- schema
  getSchema() {
    const S = this.state;
    const wall = S.wallId ? this.walls.get(S.wallId) : null;
    const schema = {
      title: 'Customise',
      subtitle: wall ? wall.label : 'No wall selected',
      tab: S.tab,
      tabs: [
        { id: 'walls', label: 'Wall' },
        { id: 'environment', label: 'Light' },
        { id: 'furniture', label: 'Furniture' },
        { id: 'room', label: 'Room' },
        ...(this.home ? [{ id: 'home', label: 'Home' }] : []),
      ],
      note: S.note,
      body: [],
    };
    const B = schema.body;

    if (S.dialog) {
      const d = S.dialog;
      const where = d.scope === 'all' ? activeLayout().wholeName : this.roomName(d.scope);
      B.push(d.kind === 'empty'
        ? { t: 'dialog', title: 'Empty room?', text: `Hide the movable furniture and loose decor in ${where}. Walls, floors, doors, windows, built-in fixtures and lighting stay. You can restore everything afterwards.`,
          buttons: [{ label: 'Empty room', kind: 'danger', onClick: () => this.confirmDialog() }, { label: 'Cancel', onClick: () => this.cancelDialog() }] }
        : { t: 'dialog', title: 'Reset the room?', text: 'Restore the original wall colours, furniture layout and lighting. Your changes will be lost.',
          buttons: [{ label: 'Reset room', kind: 'danger', onClick: () => this.confirmDialog() }, { label: 'Cancel', onClick: () => this.cancelDialog() }] });
      return schema;
    }

    if (S.tab === 'walls') {
      B.push({ t: 'heading', text: 'Wall appearance' });
      if (!wall) {
        B.push({ t: 'text', style: 'muted', text: 'Stand within 1.5 m of a wall and look at it to choose which wall to change.' });
      } else {
        B.push({ t: 'swatches', items: WALL_SWATCHES, value: WALL_SWATCHES.find((s) => s.color.toLowerCase() === (wall.hex || '').toLowerCase())?.id ?? null,
          onPick: (id) => { const sw = WALL_SWATCHES.find((x) => x.id === id); this.paintSelected(sw.color, true); this.emit('schema'); } });
        B.push({ t: 'color', hex: S.pickHex, onChange: (hex, commit) => { this.paintSelected(hex, commit); if (commit) this.emit('schema'); } });
        B.push({ t: 'buttons', items: [
          { label: 'Apply to all walls', onClick: () => this.applyToAll() },
          { label: 'Restore original', disabled: !wall.hex, onClick: () => this.restoreWall() },
        ] });
        B.push({ t: 'text', style: 'muted', text: 'Texture and relief are kept; only the tint changes.' });
      }
    } else if (S.tab === 'environment') {
      B.push({ t: 'heading', text: 'Lighting and background' });
      B.push({ t: 'presets', items: ENVIRONMENTS, value: this.environment, onPick: (id) => this.setEnvironment(id) });
      B.push({ t: 'buttons', items: [{ label: 'Restore original', disabled: this.environment === ORIGINAL_ENVIRONMENT, onClick: () => this.restoreEnvironment() }] });
    } else if (S.tab === 'furniture') {
      const sel = this.furniture.selected;
      B.push({ t: 'heading', text: sel ? sel.name : 'Furniture' });
      if (!sel) {
        B.push({ t: 'text', style: 'muted', text: 'Pick a piece below, or click / point at it in the room.' });
        const space = this.getRoom();
        const head = this.getHead(new THREE.Vector3());
        const near = this.furniture.nearest(head.x, head.z, space, 6);
        if (near.length) B.push({ t: 'list', items: near.map((it) => ({ id: it.id, label: it.name })), onPick: (id) => this.selectFurniture(id) });
        else B.push({ t: 'text', style: 'muted', text: 'No movable furniture here.' });
      } else {
        B.push({ t: 'text', style: 'accent', text: 'Selected furniture (teal outline)' });
        B.push({ t: 'text', style: 'muted', text: 'Drag it on the floor. In VR, hold the grip and move.' });
        B.push({ t: 'buttons', items: [
          { label: 'Rotate ↺', onClick: () => this.rotate(1) },
          { label: 'Rotate ↻', onClick: () => this.rotate(-1) },
        ] });
        B.push({ t: 'buttons', items: [
          { label: '↑', onClick: () => this.nudge(1, 0) }, { label: '↓', onClick: () => this.nudge(-1, 0) },
          { label: '←', onClick: () => this.nudge(0, -1) }, { label: '→', onClick: () => this.nudge(0, 1) },
        ] });
        B.push({ t: 'toggle', label: 'Snap to grid (25 cm, 15°)', value: this.furniture.snap, onChange: () => this.toggleSnap() });
        B.push({ t: 'buttons', items: [
          { label: 'Cancel', onClick: () => this.cancelEdit() },
          { label: 'Reset piece', onClick: () => this.resetPiece() },
          { label: 'Done', kind: 'primary', onClick: () => this.doneEdit() },
        ] });
      }
    } else if (S.tab === 'home' && this.home) {
      const h = this.home;
      B.push({ t: 'heading', text: 'Lights' });
      B.push({ t: 'buttons', items: [
        { label: 'All on', onClick: () => { h.allLights(true); this.changed(); } },
        { label: 'All off', onClick: () => { h.allLights(false); this.changed(); } },
      ] });
      const rooms = h.rooms();
      for (let i = 0; i < rooms.length; i += 4) {
        B.push({ t: 'buttons', items: rooms.slice(i, i + 4).map((r) => ({ label: r.label, kind: r.on ? 'primary' : undefined, onClick: () => { h.toggleRoom(r.id); this.changed(); } })) });
      }
      B.push({ t: 'heading', text: 'Home' });
      const row1 = [
        { label: h.curtains.open() ? 'Close curtains' : 'Open curtains', onClick: () => { h.curtains.set(!h.curtains.open()); this.changed(); } },
        { label: h.sheers.open() ? 'Draw sheers' : 'Open sheers', onClick: () => { h.sheers.set(!h.sheers.open()); this.changed(); } },
        { label: h.wind.on() ? 'Breeze: on' : 'Breeze: off', kind: h.wind.on() ? 'primary' : undefined, onClick: () => { h.wind.set(!h.wind.on()); this.changed(); } },
      ];
      B.push({ t: 'buttons', items: row1 });
      const row2 = [{ label: h.door.open() ? 'Close terrace door' : 'Open terrace door', onClick: () => { h.door.set(!h.door.open()); this.changed(); } }];
      if (h.blueprint) row2.push({ label: h.blueprint.on() ? 'Blueprint: on' : 'Blueprint view', kind: h.blueprint.on() ? 'primary' : undefined, onClick: () => { h.blueprint.set(!h.blueprint.on()); this.changed(); } });
      B.push({ t: 'buttons', items: row2 });
    } else if (S.tab === 'room') {
      const space = this.currentSpace();
      B.push({ t: 'heading', text: 'Empty room' });
      B.push({ t: 'buttons', items: [
        { label: `Empty ${this.roomName(space)}`, disabled: this.furniture.countVisible(space) === 0, onClick: () => this.askEmpty(space) },
        { label: `Empty ${activeLayout().wholeName}`, onClick: () => this.askEmpty('all') },
      ] });
      B.push({ t: 'buttons', items: [{ label: 'Restore furniture', kind: 'primary', disabled: this.furniture.countHidden() === 0, onClick: () => this.restoreFurniture() }] });
      B.push({ t: 'heading', text: 'Reset' });
      B.push({ t: 'buttons', items: [{ label: 'Reset room', kind: 'danger', onClick: () => this.askReset() }] });
      B.push({ t: 'text', style: 'muted', text: 'Resets wall colours, furniture and lighting to the original design.' });
    }
    return schema;
  }

  // ----------------------------------------------------------- persistence
  save() {
    if (!this.persist) return;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this.storage.set(activeLayout().storageKey, JSON.stringify({
        v: 1, environment: this.environment, walls: this.walls.serialize(), furniture: this.furniture.serialize(),
      }));
    }, 300);
  }

  /** Restore a saved design (wall colours, layout, environment). Returns the saved environment id, if any. */
  restore() {
    const raw = this.storage.get(activeLayout().storageKey);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      if (s.v !== 1) return null;
      this.walls.load(s.walls);
      this.furniture.load(s.furniture);
      if (ENVIRONMENTS.some((e) => e.id === s.environment)) { this.environment = s.environment; return s.environment; }
    } catch { /* ignore a corrupt save */ }
    return null;
  }

  clearSaved() { this.storage.remove(activeLayout().storageKey); }
}

function defaultStorage() {
  const mem = new Map();
  return {
    get: (k) => { try { return localStorage.getItem(k); } catch { return mem.get(k) ?? null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { mem.set(k, v); } },
    remove: (k) => { try { localStorage.removeItem(k); } catch { mem.delete(k); } },
  };
}
