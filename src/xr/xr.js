import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { makeMainPanel, makePrompt, makeToolbar } from './canvas-ui.js';
import { CUSTOMISE } from '../custom/config.js';

/*
 * WebXR (immersive-vr) for the existing scene. One renderer, one scene, one animation loop:
 * the camera simply moves into a "rig" group and the headset drives it. While presenting, the
 * desktop post-processing composer is bypassed (it cannot target the XR framebuffer) and the
 * scene is drawn straight to the headset; desktop rendering is untouched and resumes on exit.
 *
 * Reference space is `local-floor`, so the headset reports eye height above the real floor and
 * the rig stays at floor level (y = 0). Eye height is therefore never added a second time.
 *
 * Locomotion is teleport (thumbstick forward, release to go) plus 30° snap turns, both
 * validated against the walkability grid. Real-world head movement is free and untouched.
 */

const SESSION_INIT = { optionalFeatures: ['local-floor'] };
const TELEPORT_MAX = 9;
const PANEL_DISTANCE = 1.15;   // preferred distance of the customise panel in front of the viewer
const SNAP_TURN = THREE.MathUtils.degToRad(30);
const rotY = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)]; // THREE rotation.y on (x, z)

export function explainXRError(e) {
  switch (e?.name) {
    case 'SecurityError':
    case 'NotAllowedError':
      return { title: 'VR was blocked', text: 'The browser did not allow a VR session. Accept the VR permission prompt, and make sure the page is opened over HTTPS and the button was pressed directly.' };
    case 'NotSupportedError':
      return { title: 'VR not available', text: 'This browser or headset cannot start an immersive VR session for this page.' };
    case 'InvalidStateError':
      return { title: 'Headset busy', text: 'Another VR session may already be running, or the headset is asleep. Put it on, close other VR apps, then try again.' };
    default:
      return { title: 'Could not start VR', text: e?.message || 'An unknown error occurred while starting the session.' };
  }
}

export async function detectXR() {
  if (!window.isSecureContext) {
    return { state: 'insecure', title: 'HTTPS required', text: 'WebXR only works on secure pages. Open this app over https:// (or http://localhost on the same device). See the README for a Quest-ready setup.' };
  }
  if (!navigator.xr) {
    return { state: 'unsupported', title: 'WebXR not available', text: 'This browser has no WebXR support. On a Meta Quest, open the page in the Meta Quest Browser.' };
  }
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-vr');
    return ok
      ? { state: 'supported' }
      : { state: 'unsupported', title: 'No VR headset found', text: 'This device does not report an immersive VR display. Connect a headset or open the page in the Meta Quest Browser.' };
  } catch (e) {
    return { state: 'unsupported', ...explainXRError(e) };
  }
}

export class XRManager {
  constructor({ renderer, scene, camera, player, nav, world, custom, furniture, hooks, buttons, message }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.nav = nav;
    this.world = world;
    this.custom = custom;
    this.furniture = furniture;
    this.hooks = hooks;
    this.buttons = [].concat(buttons || []).filter(Boolean); // every "Enter VR" control (HUD and intro screen)
    this.messageEl = message;

    this.presenting = false;
    this.session = null;
    this.support = { state: 'checking' };
    this.placementPending = false;
    this.snapCooldown = 0;
    this.menuCooldown = 0;
    this.msgTimer = 0;

    // The camera moves inside this rig; XR poses are local to it.
    this.rig = new THREE.Group();
    this.rig.name = 'xr-rig';
    scene.add(this.rig);
    this.rig.add(camera);

    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    const scale = Number(new URLSearchParams(location.search).get('vrScale')) || 1;
    renderer.xr.setFramebufferScaleFactor(scale);

    this.raycaster = new THREE.Raycaster();
    this.tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler() };
    this.head = new THREE.Vector3();
    this._lp = new THREE.Vector3();
    this._lq = new THREE.Quaternion();
    this.controllers = [];
    this.ui = null;   // built on the first session
    this.listeners = [];
    this._buildControllers();
    this._onStart = () => this._sessionStart();
    this._onEnd = () => this._sessionEnd();
    renderer.xr.addEventListener('sessionstart', this._onStart);
    renderer.xr.addEventListener('sessionend', this._onEnd);

    this._clickHandler = () => this.onButton();
    this.buttons.forEach((b) => b.addEventListener('click', this._clickHandler));
    this.refreshSupport();
  }

  // ------------------------------------------------------------------ support / button
  async refreshSupport() {
    this.support = await detectXR();
    this._setState(this.support.state);
  }

  _setState(state) { this.buttons.forEach((b) => { b.dataset.state = state; }); }

  showMessage(title, text, ms = 9000) {
    const el = this.messageEl;
    if (!el) return;
    el.replaceChildren();
    const b = document.createElement('b'); b.textContent = title;
    el.append(b, document.createTextNode(text));
    el.classList.remove('hidden');
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  onButton() {
    if (this.presenting) return;
    if (this.support.state === 'checking') { this.refreshSupport().then(() => this.onButton()); return; }
    if (this.support.state !== 'supported') { this.showMessage(this.support.title, this.support.text); return; }
    this.enter();
  }

  async enter() {
    if (this.presenting || this.session) return;
    this._setState('busy');
    let session = null;
    try {
      this.hooks.beforeEnter();
      session = await navigator.xr.requestSession('immersive-vr', SESSION_INIT);
      this.session = session;
      session.addEventListener('end', () => { this.session = null; }, { once: true });
      await this.renderer.xr.setSession(session);
    } catch (e) {
      console.warn('[xr] session failed', e);
      const m = explainXRError(e);
      this.showMessage(m.title, m.text);
      try { await session?.end(); } catch { /* already closed */ }
      this.session = null;
      this._setState(this.support.state);
    }
  }

  exit() { this.session?.end().catch(() => {}); }

  // ----------------------------------------------------------------------- lifecycle
  _sessionStart() {
    this.presenting = true;
    this._setState('supported');
    this.player.xr = true;
    this.player.cancelRoute();
    this.rig.position.set(0, 0, 0);
    this.rig.rotation.set(0, 0, 0);
    this.placementPending = true;
    this.renderer.xr.setFoveation(1);
    if (!this.ui) this._buildUI();
    this.ui.toolbar.visible = true;
    this.ui.main.visible = this.custom.state.open;
    this._placeMain();
    this.fadeMesh.visible = true;
    this.hooks.onStart();
  }

  _sessionEnd() {
    if (!this.presenting) return;
    this.presenting = false;
    if (this.furniture.drag) this.furniture.endDrag(false);
    for (const c of this.controllers) { c.grab = null; c.aiming = false; c.ray.visible = false; c.reticle.visible = false; }
    this.arc.visible = false;
    this.dest.visible = false;
    this.fadeMesh.material.opacity = 0;
    this.fadeMesh.visible = false;
    this.ui.toolbar.visible = false;
    this.ui.prompt.visible = false;
    this.ui.main.visible = false;

    // hand the visitor back to the desktop camera exactly where they stand and look
    const x = this.player.pos.x, z = this.player.pos.y, yaw = this.player.yaw; // updated every XR frame
    this.rig.position.set(0, 0, 0);
    this.rig.rotation.set(0, 0, 0);
    this.camera.position.set(x, this.player.eye, z);
    this.camera.quaternion.identity();
    this.player.xr = false;
    this.player.setPose(x, z, yaw, 0);
    this.camera.updateProjectionMatrix();   // the headset overwrote the projection
    this.camera.userData.applyShift?.();
    this.hooks.onEnd();
  }

  // ------------------------------------------------------------------------- UI objects
  _buildUI() {
    const { renderer, scene, custom } = this;
    const getLabel = () => custom.target?.label || '';
    this.ui = {
      main: makeMainPanel(renderer, custom),
      prompt: makePrompt(renderer, getLabel, () => {
        if (custom.target && custom.cooldown()) custom.open({ wallId: custom.target.id });
      }),
      toolbar: makeToolbar(renderer, {
        onHome: () => { if (this.menuReady()) this.custom.open({ wallId: null, tab: 'home' }); },
        onBlueprint: () => { if (this.menuReady()) { this.hooks.toggleBlueprint?.(); this.ui.toolbar.dirty = true; } },
        blueprintOn: () => !!this.hooks.blueprintOn?.(),
        hasBlueprint: !!this.hooks.toggleBlueprint,
        onCustomise: () => this._toggleMenu(),
        onExit: () => this.exit(),
      }),
    };
    scene.add(this.ui.main.mesh, this.ui.prompt.mesh);
    this.ui.panels = [this.ui.main, this.ui.prompt, this.ui.toolbar];
    this._buildEffects();
    this._attachToolbar();

    this.custom.on('open', () => { if (this.presenting) { this.ui.main.visible = true; this._placeMain(); this.ui.prompt.visible = false; } });
    this.custom.on('close', () => { this.ui.main.visible = false; });
    this.custom.on('schema', () => this.ui.main.invalidate());
    this.custom.on('target', (t) => { if (this.presenting) this._placePrompt(t); });
  }

  /** Controllers exist before any session so their input sources connect the moment it starts. */
  _buildControllers() {
    const { scene } = this;
    const factory = new XRControllerModelFactory();
    for (let i = 0; i < 2; i++) {
      const ctrl = this.renderer.xr.getController(i);
      const grip = this.renderer.xr.getControllerGrip(i);
      this.rig.add(ctrl, grip);
      try { grip.add(factory.createControllerModel(grip)); } catch (e) { console.warn('[xr] controller model unavailable', e); }
      const ray = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0022, 0.0022, 1, 8).rotateX(Math.PI / 2).translate(0, 0, -0.5),
        new THREE.MeshBasicMaterial({ color: 0xf2eee8, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false }),
      );
      ray.userData.noAO = true;
      ray.visible = false;
      ctrl.add(ray);
      const reticle = new THREE.Mesh(
        new THREE.SphereGeometry(0.011, 16, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, depthTest: false, transparent: true }),
      );
      reticle.renderOrder = 40;
      reticle.visible = false;
      reticle.userData.noAO = true;
      scene.add(reticle);
      const c = { index: i, ctrl, grip, ray, reticle, hand: 'unknown', source: null, hover: null, selectDown: null, grab: null, aiming: false, aimValid: false, aimPoint: new THREE.Vector3(), prevStick: 0 };
      const on = (type, fn) => { ctrl.addEventListener(type, fn); this.listeners.push([ctrl, type, fn]); };
      on('connected', (e) => { c.source = e.data; c.hand = e.data.handedness || 'unknown'; this._attachToolbar(); });
      on('disconnected', () => { c.source = null; c.hand = 'unknown'; this._attachToolbar(); });
      on('selectstart', () => this._selectStart(c));
      on('selectend', () => this._selectEnd(c));
      on('squeezestart', () => this._squeezeStart(c));
      on('squeezeend', () => this._squeezeEnd(c));
      this.controllers.push(c);
    }
  }

  _buildEffects() {
    const { scene } = this;

    // teleport arc and destination marker
    this.arc = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7dffd8, toneMapped: false, depthWrite: false }), 40);
    this.arc.frustumCulled = false; this.arc.visible = false; this.arc.userData.noAO = true;
    this.dest = new THREE.Group();
    this.destRing = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7dffd8, toneMapped: false, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
    this.destDisc = new THREE.Mesh(new THREE.CircleGeometry(0.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7dffd8, toneMapped: false, side: THREE.DoubleSide, transparent: true, opacity: 0.22, depthWrite: false }));
    this.dest.add(this.destRing, this.destDisc);
    this.dest.visible = false; this.dest.userData.noAO = true;
    this.destRing.renderOrder = this.destDisc.renderOrder = 35;
    scene.add(this.arc, this.dest);

    // comfort fade for teleports
    this.fadeMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }));
    this.fadeMesh.position.z = -0.12;
    this.fadeMesh.renderOrder = 999;
    this.fadeMesh.frustumCulled = false;
    this.fadeMesh.userData.noAO = true;
    this.camera.add(this.fadeMesh);
    this.fade = null;
  }

  /** Put the toolbar on top of the left controller (or whichever one is connected). */
  _attachToolbar() {
    if (!this.ui) return;
    const live = this.controllers.filter((c) => c.source);
    const host = live.find((c) => c.hand === 'left') || live[0];
    const mesh = this.ui.toolbar.mesh;
    mesh.parent?.remove(mesh);
    if (host) {
      host.ctrl.add(mesh);
      mesh.position.set(0, 0.05, 0.03);
      mesh.rotation.set(-Math.PI / 2, 0, 0);
    } else this.scene.add(mesh);
  }

  _toggleMenu() {
    if (!this.menuReady()) return;
    if (this.custom.state.open) this.custom.close();
    else this.custom.open({ wallId: null, tab: this.custom.state.tab });
  }
  menuReady() {
    const now = performance.now();
    if (now - (this._lastMenu || 0) < CUSTOMISE.cooldownMs) return false;
    this._lastMenu = now;
    return true;
  }

  // --------------------------------------------------------------------------- geometry helpers
  /**
   * Head pose in the headset's reference space (before the rig moves it into the house).
   * three.js only copies the headset pose onto `camera` while rendering, so on a frame's
   * logic step the current pose lives on the per-eye cameras; their midpoint is the head.
   */
  _headLocal() {
    const eyes = this.renderer.xr.getCamera().cameras;
    if (eyes && eyes.length) {
      this._lp.set(0, 0, 0);
      for (const e of eyes) this._lp.add(e.position);
      this._lp.multiplyScalar(1 / eyes.length);
      this._lq.copy(eyes[0].quaternion);
    } else {
      this._lp.copy(this.camera.position);
      this._lq.copy(this.camera.quaternion);
    }
    return this._lp;
  }
  _headWorld(out = new THREE.Vector3()) { return out.copy(this._headLocal()).applyMatrix4(this.rig.matrixWorld); }
  _headLocalYaw() { this._headLocal(); return this.tmp.e.setFromQuaternion(this._lq, 'YXZ').y; }
  _headYaw() { return this.rig.rotation.y + this._headLocalYaw(); }
  _headForward(out) {
    this._headLocal();
    out.set(0, 0, -1).applyQuaternion(this._lq).applyQuaternion(this.rig.quaternion);
    return out;
  }

  /** Position the rig so the head is at world (x, z) and facing `yaw`. */
  _placeHead(x, z, yaw) {
    this.rig.rotation.y = yaw - this._headLocalYaw();
    const lp = this._headLocal();
    const [ox, oz] = rotY(lp.x, lp.z, this.rig.rotation.y);
    this.rig.position.set(x - ox, 0, z - oz);
    this.rig.updateMatrixWorld(true);
  }

  _turnAboutHead(angle) {
    const before = this._headWorld(this.tmp.b).clone();
    this.rig.rotation.y += angle;
    this.rig.updateMatrixWorld(true);
    const after = this._headWorld(this.tmp.c);
    this.rig.position.x += before.x - after.x;
    this.rig.position.z += before.z - after.z;
    this.rig.updateMatrixWorld(true);
  }

  _placeMain() {
    if (!this.ui) return;
    const head = this._headWorld(this.tmp.a).clone();
    const d = this._headForward(this.tmp.b); d.y = 0;
    if (d.lengthSq() < 1e-4) d.set(0, 0, -1);
    d.normalize();
    // The panel opens when you are close to a wall and facing it, so a fixed distance would bury it
    // in the wall. Stop short of whatever is ahead, and shrink with distance so it keeps the same
    // apparent size (and stays readable) instead of filling your view.
    const y = Math.max(1.05, head.y - 0.12);
    const free = this.custom.clearance(new THREE.Vector3(head.x, y, head.z), d, PANEL_DISTANCE + 0.3);
    const dist = THREE.MathUtils.clamp(free - 0.18, 0.55, PANEL_DISTANCE);
    const m = this.ui.main.mesh;
    m.scale.setScalar(dist / PANEL_DISTANCE);
    m.position.set(head.x + d.x * dist, y, head.z + d.z * dist);
    m.lookAt(head.x, y, head.z);
    m.updateMatrixWorld(true);
  }

  _placePrompt(t) {
    const p = this.ui.prompt;
    if (!t || this.custom.state.open) { p.visible = false; return; }
    const head = this._headWorld(this.tmp.a);
    const m = p.mesh;
    m.position.set(t.point.x + t.normal[0] * 0.06, THREE.MathUtils.clamp(t.point.y, head.y - 0.55, head.y + 0.1), t.point.z + t.normal[1] * 0.06);
    m.lookAt(head.x, m.position.y, head.z);
    m.updateMatrixWorld(true);
    p.visible = true;
    p.invalidate();
  }

  // ------------------------------------------------------------------------ per-frame update
  /** Called once per frame while presenting. */
  update(dt) {
    if (!this.presenting || !this.ui) return;
    this.rig.updateMatrixWorld(true);
    if (this.placementPending) {
      this.placementPending = false;
      this._placeHead(this.player.pos.x, this.player.pos.y, this.player.yaw);
      this._placeMain();
    }
    // the visitor is wherever the headset is (this is what rooms, targeting and exit continue from)
    this._headWorld(this.head);
    this.player.pos.set(this.head.x, this.head.z);
    this.player.yaw = this._headYaw();

    this.frame = (this.frame || 0) + 1;
    this.snapCooldown = Math.max(0, this.snapCooldown - dt);
    this._updateFade(dt);

    const open = this.custom.state.open;
    const furn = open && this.custom.state.tab === 'furniture';
    let wallCandidate = null;
    let uiHover = false;
    // The prompt floats in front of its wall, so a ray at the wall also meets the prompt. Never let that
    // keep a wall alive after the visitor has moved out of range, or the label could be pulled from afar.
    if (!open && this.custom.target && this.head.distanceTo(this.custom.target.point) > CUSTOMISE.proximity + 0.3) {
      this.custom.clearTarget();
      this.ui.prompt.visible = false;
    }

    for (const c of this.controllers) {
      c.ctrl.updateMatrixWorld(true);
      c.hover = null;
      if (!c.source) { c.ray.visible = false; c.reticle.visible = false; continue; }
      c.ray.visible = true;
      const origin = c.ctrl.getWorldPosition(this.tmp.a).clone();
      const dir = this.tmp.b.set(0, 0, -1).transformDirection(c.ctrl.matrixWorld).clone();
      c.origin = origin; c.dir = dir;

      // ---- what is the ray pointing at? (nearest of: UI panels, interactive objects, furniture)
      this.raycaster.set(origin, dir);
      this.raycaster.far = 12;
      let best = null;
      for (const panel of this.ui.panels) {
        if (!panel.visible) continue;
        const h = this.raycaster.intersectObject(panel.mesh, false)[0];
        if (h && (!best || h.distance < best.distance)) best = { kind: 'ui', panel, distance: h.distance, point: h.point.clone() };
      }
      {
        const targets = [];
        if (!open) targets.push(...this.world.interact.targets);
        if (furn) targets.push(...this.furniture.pickMeshes());
        if (targets.length) {
          const h = this.raycaster.intersectObjects(targets, false)[0];
          if (h && (!best || h.distance < best.distance) && h.distance < 8) {
            const px = h.point.x - this.raycaster.ray.direction.x * 0.3, pz = h.point.z - this.raycaster.ray.direction.z * 0.3;
            const blocked = this.nav.wallBetween(this.head.x, this.head.z, px, pz);
            if (!blocked) {
              const itemId = this.furniture.itemIdOf(h.object);
              if (itemId && furn) best = { kind: 'furniture', id: itemId, distance: h.distance, point: h.point.clone() };
              else if (h.object.userData.interactive && !(h.object.userData.interactive.kind === 'material' && furn)) {
                best = { kind: 'interact', item: h.object.userData.interactive, distance: h.distance, point: h.point.clone() };
              }
            }
          }
        }
      }
      c.hover = best;
      if (best && best.kind === 'ui') uiHover = true;

      // ---- wall targeting (only when no panel is open)
      if (!open && !(best && best.kind === 'ui')) {
        // the occlusion test is the costly part: refresh each controller's wall every third frame
        if ((this.frame + c.index) % 3 === 0) c.lastWall = this.custom.queryWall(origin, dir);
        const t = c.lastWall;
        if (t && (!wallCandidate || c.hand === 'right')) wallCandidate = t;
      } else c.lastWall = null;

      // ---- UI pointer state
      for (const panel of this.ui.panels) {
        if (!panel.visible) { panel.move(c.index, null); continue; }
        let px = null;
        if (best && best.kind === 'ui' && best.panel === panel) px = panel.pixelAt(best.point);
        else if (panel.pressed && panel.pressed.owner === c.index) px = this._planePixel(panel); // keep dragging a slider off the edge
        panel.move(c.index, px);
      }

      // ---- ray + reticle visuals
      const len = best ? best.distance : 3;
      c.ray.scale.set(1, 1, len);
      const hot = best && (best.kind === 'ui' || best.kind === 'interact' || best.kind === 'furniture');
      c.ray.material.color.setHex(hot ? 0xffc27d : 0xf2eee8);
      c.ray.material.opacity = hot ? 0.9 : 0.5;
      if (best) { c.reticle.position.copy(best.point); c.reticle.visible = true; c.reticle.material.color.setHex(hot ? 0xffc27d : 0xffffff); } else c.reticle.visible = false;

      this._pollGamepad(c);
      if (c.grab) this._updateGrab(c, dt);
    }

    if (!open && !uiHover) this.custom.setTarget(wallCandidate);
    this.ui.prompt.update();
    this.ui.toolbar.update();
    this.ui.main.update();
  }

  /** Where the current ray meets the panel's plane, in canvas pixels (even outside the panel). */
  _planePixel(panel) {
    const normal = panel.mesh.getWorldDirection(this.tmp.c);
    panel.plane.setFromNormalAndCoplanarPoint(normal, panel.mesh.getWorldPosition(this.tmp.a));
    const hit = this.raycaster.ray.intersectPlane(panel.plane, this.tmp.b);
    return hit ? panel.pixelAt(hit) : null;
  }

  // ----------------------------------------------------------------------------- gamepad
  _pollGamepad(c) {
    const gp = c.source?.gamepad;
    if (!gp) return;
    const ax = gp.axes.length >= 4 ? [gp.axes[2], gp.axes[3]] : [gp.axes[0] || 0, gp.axes[1] || 0];
    const [sx, sy] = ax;
    const grabbing = !!c.grab;
    const overUI = c.hover?.kind === 'ui';

    // menu button (B / Y) toggles the customise panel
    const menu = gp.buttons[5]?.pressed;
    if (menu && !c.menuHeld) this._toggleMenu();
    c.menuHeld = !!menu;

    // teleport: push the stick forward to aim, release to go
    if (!grabbing && !overUI) {
      if (sy < -0.65) { c.aiming = true; this._aim(c); }
      else if (c.aiming) {
        c.aiming = false;
        if (sy > -0.35 && c.aimValid) this._teleport(c.aimPoint);
        this.arc.visible = false; this.dest.visible = false;
      }
    } else if (c.aiming) { c.aiming = false; this.arc.visible = false; this.dest.visible = false; }

    // snap turn
    if (!c.aiming && !grabbing && !overUI && this.snapCooldown === 0 && Math.abs(sx) > 0.75) {
      this._turnAboutHead(-Math.sign(sx) * SNAP_TURN);
      this.snapCooldown = 0.32;
    }
    c.stickX = sx;
  }

  _aim(c) {
    const pts = [];
    const p = c.origin.clone();
    const v = c.dir.clone().multiplyScalar(7.6);
    let hit = null;
    pts.push(p.clone());
    let blocked = false;
    for (let i = 0; i < 70 && !hit; i++) {
      const prev = p.clone();
      v.y -= 9.8 * 0.03;
      p.addScaledVector(v, 0.03);
      if (p.y <= 0) {
        const t = prev.y / (prev.y - p.y);
        hit = prev.clone().lerp(p, t); hit.y = 0;
        pts.push(hit.clone());
      } else pts.push(p.clone());
      if (!blocked && this.nav.segmentBlocked(prev.x, prev.z, (hit || p).x, (hit || p).z)) blocked = true;
    }
    let valid = false;
    if (hit && !blocked) {
      const dist = Math.hypot(hit.x - this.head.x, hit.z - this.head.z);
      valid = dist < TELEPORT_MAX
        && this.nav.free(hit.x, hit.z, true)
        && !this.nav.segmentBlocked(this.head.x, this.head.z, hit.x, hit.z);
    }
    c.aimValid = valid;
    if (hit) c.aimPoint.copy(hit);
    const col = valid ? 0x7dffd8 : 0xff6b5b;
    this.arc.material.color.setHex(col);
    const m = new THREE.Matrix4();
    const n = Math.min(pts.length, 40);
    for (let i = 0; i < n; i++) { m.makeTranslation(pts[i].x, pts[i].y, pts[i].z); this.arc.setMatrixAt(i, m); }
    this.arc.count = n;
    this.arc.instanceMatrix.needsUpdate = true;
    this.arc.visible = true;
    if (hit) {
      this.dest.position.copy(hit); this.dest.position.y = 0.015;
      this.destRing.material.color.setHex(col); this.destDisc.material.color.setHex(col);
      this.dest.visible = true;
    } else this.dest.visible = false;
  }

  _teleport(point) {
    if (this.fade) return;
    this.fade = { t: 0, phase: 'out', target: point.clone() };
  }

  _updateFade(dt) {
    const f = this.fade;
    if (!f) return;
    f.t += dt;
    if (f.phase === 'out') {
      this.fadeMesh.material.opacity = Math.min(1, f.t / 0.1);
      if (f.t >= 0.1) {
        this._placeHead(f.target.x, f.target.z, this._headYaw());
        this._placeMain();
        f.phase = 'in'; f.t = 0;
      }
    } else {
      this.fadeMesh.material.opacity = Math.max(0, 1 - f.t / 0.16);
      if (f.t >= 0.16) { this.fade = null; this.fadeMesh.material.opacity = 0; }
    }
  }

  // ------------------------------------------------------------------------------ buttons
  _selectStart(c) {
    if (!this.presenting) return;
    const h = c.hover;
    if (h && h.kind === 'ui') {
      c.selectDown = { kind: 'ui', panel: h.panel };
      h.panel.down(c.index, h.panel.pixelAt(h.point));
    } else c.selectDown = h ? { kind: h.kind, id: h.id, item: h.item } : { kind: 'none' };
  }

  _selectEnd(c) {
    if (!this.presenting) return;
    const d = c.selectDown;
    c.selectDown = null;
    if (!d) return;
    if (d.kind === 'ui') {
      const px = c.hover?.kind === 'ui' && c.hover.panel === d.panel ? d.panel.pixelAt(c.hover.point) : null;
      d.panel.up(c.index, px);
      return;
    }
    const h = c.hover;
    // activate only if the ray is still on the very same thing it was on when the trigger went down
    if (!h || h.kind !== d.kind) return;
    if (d.kind === 'interact' && h.item === d.item) {
      if (this.custom.cooldown()) h.item.action();
    } else if (d.kind === 'furniture' && h.id === d.id) {
      if (this.custom.cooldown()) this.custom.selectFurniture(h.id);
    }
  }

  _squeezeStart(c) {
    if (!this.presenting || c.grab) return;
    const S = this.custom.state;
    if (!(S.open && S.tab === 'furniture')) return;
    if (!this.furniture.selected && c.hover?.kind === 'furniture') this.custom.selectFurniture(c.hover.id);
    const it = this.furniture.selected;
    if (!it || !it.movable || !this.furniture.beginDrag(it.id)) return;
    const floor = this._floorPoint(c);
    c.grab = {
      id: it.id, ry: it.cur.ry,
      offX: floor ? it.cur.x - floor.x : 0, offZ: floor ? it.cur.z - floor.z : 0,
    };
  }

  _squeezeEnd(c) {
    if (!c.grab) return;
    c.grab = null;
    const placed = this.furniture.endDrag(true);
    if (!placed) this.custom.say("Can't place it there — moved back");
    else this.custom.changed();
  }

  _floorPoint(c) {
    if (!c.origin || c.dir.y > -0.02) return null;
    const t = -c.origin.y / c.dir.y;
    if (t > 14) return null;
    return c.origin.clone().addScaledVector(c.dir, t);
  }

  _updateGrab(c, dt) {
    const g = c.grab;
    const it = this.furniture.get(g.id);
    if (!it) { c.grab = null; return; }
    const f = this._floorPoint(c);
    const stick = Math.abs(c.stickX || 0) > 0.3 ? c.stickX : 0;
    g.ry -= stick * dt * 1.8;
    if (f) this.furniture.dragTo(f.x + g.offX, f.z + g.offZ, g.ry);
    else this.furniture.dragTo(it.cur.x, it.cur.z, g.ry);
  }

  dispose() {
    this.renderer.xr.removeEventListener('sessionstart', this._onStart);
    this.renderer.xr.removeEventListener('sessionend', this._onEnd);
    this.buttons.forEach((b) => b.removeEventListener('click', this._clickHandler));
    clearTimeout(this.msgTimer);
    this.exit();
    this.listeners.forEach(([t, type, fn]) => t.removeEventListener(type, fn));
    this.controllers.forEach((c) => { c.ray.geometry.dispose(); c.ray.material.dispose(); c.reticle.geometry.dispose(); c.reticle.material.dispose(); c.reticle.parent?.remove(c.reticle); });
    if (this.ui) {
      this.ui.panels.forEach((p) => { p.mesh.parent?.remove(p.mesh); p.dispose(); });
      this.arc.geometry.dispose(); this.arc.material.dispose(); this.arc.dispose();
      this.destRing.geometry.dispose(); this.destDisc.geometry.dispose();
      this.fadeMesh.geometry.dispose(); this.fadeMesh.material.dispose();
    }
  }
}
