import * as THREE from 'three';
import { ROOMS, roomAt } from '../world/layout.js';
import { CUSTOMISE } from './config.js';

/*
 * Movable furniture and loose decor. Pieces are groups produced by the Batcher; they only ever
 * slide on the floor (x, z) and turn about the vertical axis, so they stay grounded. A placement
 * is accepted only when the piece's recorded collision footprint avoids walls, the pool,
 * everything outside the plan and every other piece, and stays on its own side of the
 * indoor / outdoor boundary. Hiding a piece also removes its collision.
 */

const TEAL = 0x5fe3d0;
const RED = 0xff6b5b;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class FurnitureSystem {
  constructor({ scene, items, nav, onChange = () => {} }) {
    this.scene = scene;
    this.nav = nav;
    this.onChange = onChange;
    this.items = new Map();
    this.selectedId = null;
    this.drag = null;       // { lastValid } while a piece is being moved
    this.snapshot = null;   // transform when the piece was selected, for Cancel
    this.snap = false;
    this.hiddenByEmpty = new Set();

    for (const built of items.values()) {
      const { id, meta, group, pivot, local, shapes } = built;
      const flat = !!meta.flat;
      const size = local.getSize(new THREE.Vector3());
      // pieces that recorded no collision shapes fall back to their bounding rectangle
      const footprint = shapes.length ? shapes : [{ t: 'o', x: pivot.x, z: pivot.z, w: size.x, d: size.z, ry: 0 }];
      const home = { x: pivot.x, z: pivot.z, ry: 0 };
      const item = {
        id, name: meta.name, room: meta.room, category: meta.category, movable: !!meta.movable,
        flat, finish: meta.finish || null, group, home, cur: { ...home }, hidden: false, local, size,
      };
      nav.registerItem(id, footprint, { x: pivot.x, z: pivot.z });
      nav.itemNav.get(id).flat = flat;
      this.items.set(id, item);
    }
    nav.rebuildDynamic();

    // selection outline: a cool teal volume, deliberately unlike the amber wall highlight
    this.outline = new THREE.Group();
    this.outline.visible = false;
    this.outlineFill = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.1, depthWrite: false, toneMapped: false }),
    );
    this.outlineLines = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: TEAL, toneMapped: false, depthTest: false, transparent: true, opacity: 0.95 }),
    );
    this.outlineRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    );
    for (const m of [this.outlineFill, this.outlineLines, this.outlineRing]) { m.raycast = () => {}; m.userData.noAO = true; }
    this.outlineLines.renderOrder = 6;
    this.outline.add(this.outlineFill, this.outlineLines, this.outlineRing);
    scene.add(this.outline);
  }

  get selected() { return this.selectedId ? this.items.get(this.selectedId) : null; }
  get(id) { return this.items.get(id) || null; }

  /** Raycast targets for selection: visible, movable pieces. */
  pickMeshes() {
    const out = [];
    for (const it of this.items.values()) if (it.movable && !it.hidden) it.group.children.forEach((m) => out.push(m));
    return out;
  }
  /** Every visible piece, used to occlude wall targeting. */
  occluderMeshes() {
    const out = [];
    for (const it of this.items.values()) if (!it.hidden) it.group.children.forEach((m) => out.push(m));
    return out;
  }
  itemIdOf(obj) { for (let o = obj; o; o = o.parent) if (o.userData.itemId) return o.userData.itemId; return null; }

  // ----------------------------------------------------------- selection
  select(id) {
    const it = this.items.get(id);
    if (!it || !it.movable || it.hidden) return false;
    if (this.selectedId && this.selectedId !== id) this._detachOutline();
    this.selectedId = id;
    this.snapshot = { ...it.cur };
    this.drag = null;
    this._attachOutline(it);
    this._setValid(true);
    this.onChange('select');
    return true;
  }

  deselect() {
    if (!this.selectedId) return;
    if (this.drag) this.endDrag(false);
    this._detachOutline();
    this.selectedId = null;
    this.snapshot = null;
    this.onChange('select');
  }

  _attachOutline(it) {
    const c = it.local.getCenter(new THREE.Vector3());
    const s = it.size;
    this.outlineFill.position.copy(c);
    this.outlineLines.position.copy(c);
    this.outlineFill.scale.set(s.x + 0.06, s.y + 0.06, s.z + 0.06);
    this.outlineLines.scale.copy(this.outlineFill.scale);
    this.outlineRing.position.set(c.x, 0.012, c.z);
    const rad = Math.max(0.3, Math.hypot(s.x, s.z) / 2);
    this.outlineRing.scale.set(rad, 1, rad);
    it.group.add(this.outline);
    this.outline.visible = true;
  }
  _detachOutline() { this.outline.visible = false; this.outline.parent?.remove(this.outline); }
  _setValid(ok) {
    const c = ok ? TEAL : RED;
    this.outlineFill.material.color.setHex(c);
    this.outlineLines.material.color.setHex(c);
    this.outlineRing.material.color.setHex(c);
  }

  // ------------------------------------------------------------ placement
  _normalise(tf) {
    let { x, z, ry } = tf;
    if (this.snap) {
      x = Math.round(x / CUSTOMISE.gridSnap) * CUSTOMISE.gridSnap;
      z = Math.round(z / CUSTOMISE.gridSnap) * CUSTOMISE.gridSnap;
      ry = Math.round(ry / CUSTOMISE.angleSnap) * CUSTOMISE.angleSnap;
    }
    return { x, z, ry: wrapAngle(ry) };
  }

  /**
   * `from` is the last accepted position. A piece can be carried through an open doorway,
   * but never across a wall: pointing through a wall at the floor beyond it is refused.
   */
  _valid(it, tf, from) {
    const room = roomAt(tf.x, tf.z);
    if (!room) return false;
    const outdoor = !!ROOMS[it.room]?.outdoor;
    if (!!ROOMS[room].outdoor !== outdoor) return false;
    if (from && this.nav.wallOnSegment(from.x, from.z, tf.x, tf.z)) return false;
    return this.nav.itemFits(it.id, tf);
  }

  _apply(it, tf) {
    it.cur = { ...tf };
    it.group.position.set(tf.x, 0, tf.z);
    it.group.rotation.y = tf.ry;
    this.nav.setItemTransform(it.id, tf);
  }

  /** Begin interactive movement. The piece stops blocking itself while it is carried. */
  beginDrag(id) {
    if (this.selectedId !== id && !this.select(id)) return false;
    const it = this.selected;
    this.nav.rebuildDynamic(it.id);
    this.drag = { lastValid: { ...it.cur }, valid: true };
    return true;
  }

  /** Move the carried piece (floor x/z) and report whether that spot is allowed. */
  dragTo(x, z, ry = null) {
    const it = this.selected;
    if (!it || !this.drag) return false;
    const tf = this._normalise({ x, z, ry: ry ?? it.cur.ry });
    const ok = this._valid(it, tf, this.drag.lastValid);
    this._apply(it, tf);
    this.drag.valid = ok;
    if (ok) this.drag.lastValid = { ...tf };
    this._setValid(ok);
    return ok;
  }

  /** Drop the piece. An invalid spot snaps it back to the last allowed position. */
  endDrag(commit = true) {
    const it = this.selected;
    if (!it || !this.drag) return true;
    const placed = this.drag.valid;
    if (!commit || !placed) this._apply(it, this.drag.lastValid);
    this.drag = null;
    this._setValid(true);
    this.nav.rebuildDynamic();
    this.onChange('move');
    return commit ? placed : false;
  }

  _tryPlace(it, tf) {
    this.nav.rebuildDynamic(it.id);
    const n = this._normalise(tf);
    const ok = this._valid(it, n, it.cur);
    if (ok) this._apply(it, n);
    this.nav.rebuildDynamic();
    if (ok) this.onChange('move');
    return ok;
  }

  rotateBy(rad) {
    const it = this.selected;
    if (!it) return false;
    return this._tryPlace(it, { ...it.cur, ry: it.cur.ry + rad });
  }
  nudge(dx, dz) {
    const it = this.selected;
    if (!it) return false;
    return this._tryPlace(it, { ...it.cur, x: it.cur.x + dx, z: it.cur.z + dz });
  }

  /** Revert the selected piece to where it stood when it was selected. */
  cancel() {
    const it = this.selected;
    if (!it || !this.snapshot) return;
    if (this.drag) { this.drag = null; this._setValid(true); }
    this._apply(it, this.snapshot);
    this.nav.rebuildDynamic();
    this.onChange('move');
  }

  resetItem(id = this.selectedId) {
    const it = this.items.get(id);
    if (!it) return false;
    const ok = this._tryPlace(it, { ...it.home });
    return ok;
  }

  // ------------------------------------------------------------ visibility
  setHidden(it, hidden) {
    it.hidden = hidden;
    it.group.visible = !hidden;
    this.nav.setItemActive(it.id, !hidden);
    if (hidden && this.selectedId === it.id) this.deselect();
  }

  /** Hide movable furniture and loose decor. scope: a room key, or 'all'. Returns the count. */
  empty(scope) {
    let n = 0;
    for (const it of this.items.values()) {
      if (it.hidden) continue;
      if (scope !== 'all' && !this.sameSpace(it.room, scope)) continue;
      this.setHidden(it, true);
      this.hiddenByEmpty.add(it.id);
      n++;
    }
    this.nav.rebuildDynamic();
    this.onChange('empty');
    return n;
  }

  /** The living room, entrance and dining room read as one open space. */
  sameSpace(a, b) {
    const open = new Set(['living', 'foyer', 'dining']);
    return a === b || (open.has(a) && open.has(b));
  }

  restoreHidden() {
    let n = 0;
    for (const id of this.hiddenByEmpty) {
      const it = this.items.get(id);
      if (it?.hidden) { this.setHidden(it, false); n++; }
    }
    this.hiddenByEmpty.clear();
    this.nav.rebuildDynamic();
    this.onChange('empty');
    return n;
  }

  countHidden() { return this.hiddenByEmpty.size; }
  countVisible(scope) {
    let n = 0;
    for (const it of this.items.values()) if (!it.hidden && (scope === 'all' || this.sameSpace(it.room, scope))) n++;
    return n;
  }

  /** Back to the layout the residence shipped with. */
  resetAll() {
    this.deselect();
    for (const it of this.items.values()) {
      this._apply(it, { ...it.home });
      this.setHidden(it, false);
    }
    this.hiddenByEmpty.clear();
    this.snap = false;
    this.nav.rebuildDynamic();
    this.onChange('reset');
  }

  isModified() {
    for (const it of this.items.values()) {
      if (it.hidden || it.cur.x !== it.home.x || it.cur.z !== it.home.z || it.cur.ry !== 0) return true;
    }
    return false;
  }

  /** Movable pieces nearest to a point, optionally limited to one open space. */
  nearest(x, z, room, count = 6) {
    return [...this.items.values()]
      .filter((it) => it.movable && !it.hidden && (!room || this.sameSpace(it.room, room)))
      .map((it) => ({ it, d: Math.hypot(it.cur.x - x, it.cur.z - z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map((e) => e.it);
  }

  // ----------------------------------------------------------- persistence
  serialize() {
    const out = {};
    for (const it of this.items.values()) {
      const moved = it.cur.x !== it.home.x || it.cur.z !== it.home.z || it.cur.ry !== 0;
      if (moved || it.hidden) out[it.id] = { x: +it.cur.x.toFixed(3), z: +it.cur.z.toFixed(3), ry: +it.cur.ry.toFixed(4), hidden: it.hidden };
    }
    return { items: out, hiddenByEmpty: [...this.hiddenByEmpty] };
  }

  load(state = {}) {
    const { items = {}, hiddenByEmpty = [] } = state;
    for (const [id, s] of Object.entries(items)) {
      const it = this.items.get(id);
      if (!it) continue;
      if (it.movable && Number.isFinite(s.x)) this._apply(it, { x: s.x, z: s.z, ry: s.ry || 0 });
      if (s.hidden) this.setHidden(it, true);
    }
    hiddenByEmpty.forEach((id) => { if (this.items.get(id)?.hidden) this.hiddenByEmpty.add(id); });
    this.nav.rebuildDynamic();
  }
}
