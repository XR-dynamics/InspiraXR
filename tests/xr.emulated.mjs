/*
 * Headset-path test using Meta's IWER runtime to emulate a Quest 3 and Touch controllers.
 * This exercises the real WebXR session, stereo rendering, input events and our XR code, but it
 * is an EMULATION: it cannot show comfort, real tracking, performance or controller-model issues.
 *
 *   npm run dev            (in another terminal)
 *   npm run test:xr
 */
import fs from 'node:fs';
import { launch, openApp, suite } from './lib.mjs';

const OUT = process.env.OUT_DIR || '/tmp';
const { browser, page, logs } = await launch({ width: 480, height: 300, xr: true });
const T = suite('Emulated Quest 3 session');
const ev = (fn, arg) => page.evaluate(fn, arg);

// ---------------------------------------------------------------- in-page helpers
await openApp(page, 'enter&reset');
await ev(() => {
  const R = window.__residence;
  const V = R.camera.position.constructor, Q = R.camera.quaternion.constructor;
  const H = (window.__h = {});
  H.V = V;
  H.head = () => R.xr._headWorld(new V());
  H.rigInv = () => R.xr.rig.matrixWorld.clone().invert();
  // Point a controller's ray at a world position, from a natural spot beside the body.
  H.aim = (hand, p, from = null) => {
    const x = R.xr, head = H.head();
    const f = x._headForward(new V()); f.y = 0; f.normalize();
    const right = new V(-f.z, 0, f.x);
    const o = from ? new V(...from) : head.clone().addScaledVector(right, hand === 'right' ? 0.22 : -0.22).add(new V(0, -0.38, 0)).addScaledVector(f, 0.2);
    const d = new V(p.x - o.x, p.y - o.y, p.z - o.z).normalize();
    const qw = new Q().setFromUnitVectors(new V(0, 0, -1), d);
    const lp = o.clone().applyMatrix4(H.rigInv());
    const ql = x.rig.quaternion.clone().invert().multiply(qw);
    const c = window.__xrDevice.controllers[hand];
    c.position.set(lp.x, lp.y, lp.z); c.quaternion.set(ql.x, ql.y, ql.z, ql.w);
  };
  // Where a panel pixel is in the world.
  H.panelPoint = (panel, px, py) => {
    const g = panel.mesh.geometry.parameters;
    return panel.mesh.localToWorld(new V((px / panel.px[0] - 0.5) * g.width, (0.5 - py / panel.px[1]) * g.height, 0));
  };
  // Hold a controller at a world position, pointing straight ahead (like a hand resting at chest height).
  H.hold = (hand, p) => {
    const lp = new V(p.x, p.y, p.z).applyMatrix4(H.rigInv()), q = R.xr.rig.quaternion.clone().invert();
    const c = window.__xrDevice.controllers[hand];
    c.position.set(lp.x, lp.y, lp.z); c.quaternion.set(q.x, q.y, q.z, q.w);
  };
  H.item = (panel, pred) => panel.items.find(pred);
  H.center = (it) => [it.rect[0] + it.rect[2] / 2, it.rect[1] + it.rect[3] / 2];
  H.frame = () => R.xr.frame || 0;
});
const frames = async (n) => { const f0 = await ev(() => window.__h.frame()); await page.waitForFunction((t) => window.__h.frame() >= t, f0 + n, { timeout: 600000 }); };
const press = async (hand, id = 'trigger', n = 2) => { await ev(([h, i]) => window.__xrDevice.controllers[h].updateButtonValue(i, 1), [hand, id]); await frames(n); await ev(([h, i]) => window.__xrDevice.controllers[h].updateButtonValue(i, 0), [hand, id]); await frames(2); };
const stick = (hand, x, y) => ev(([h, a, b]) => window.__xrDevice.controllers[h].updateAxes('thumbstick', a, b), [hand, x, y]);
const settle = async (hand, point) => { await ev(([h, p]) => window.__h.aim(h, p), [hand, point]); await frames(2); };
/** Aim the right ray at a panel widget and pull the trigger. */
const clickWidget = async (panelName, pred, label) => {
  const pt = await ev(([pn, src]) => {
    const R = window.__residence, panel = R.xr.ui[pn];
    const it = panel.items.find(new Function('it', `return (${src})`));
    if (!it) return null;
    const [cx, cy] = window.__h.center(it); const w = window.__h.panelPoint(panel, cx, cy);
    window.__h.aim('right', w);
    return { x: w.x, y: w.y, z: w.z };
  }, [panelName, pred]);
  if (!pt) { T.check(`widget found: ${label}`, false); return false; }
  await frames(2);
  await press('right');
  return true;
};
const snap = async (name) => { try { await page.screenshot({ path: `${OUT}/${name}.png` }); } catch { /* ignore */ } };

// ------------------------------------------------------------------ A. entry
T.check('VR button reports "supported" for an immersive-vr capable runtime', (await ev(() => document.querySelector('#vr-btn').dataset.state)) === 'supported');
const pre = await ev(() => { const R = window.__residence; return { x: R.player.pos.x, z: R.player.pos.y, yaw: R.player.yaw, f: R.frameCount, shared: R.furniture.items.size }; });
await page.click('#vr-btn');
await page.waitForFunction(() => window.__residence.xr.presenting, null, { timeout: 120000 });
await frames(3);
const s1 = await ev(() => {
  const R = window.__residence, x = R.xr, h = window.__h.head();
  return { presenting: R.renderer.xr.isPresenting, views: R.renderer.xr.getCamera().cameras.length, head: [h.x, h.y, h.z], rigY: x.rig.position.y, yaw: x.player.yaw, refSpace: !!R.renderer.xr.getReferenceSpace(), ctrl: x.controllers.map((c) => c.hand), parentIsRig: R.camera.parent === x.rig, desktopHud: getComputedStyle(document.querySelector('#hud')).visibility };
});
T.check('immersive session is presenting with stereoscopic rendering (2 views)', s1.presenting && s1.views === 2, `views=${s1.views}`);
T.check('reference space acquired', s1.refSpace);
T.check('eye height is not added twice (head y == tracked 1.6 m, rig at floor)', Math.abs(s1.head[1] - 1.6) < 0.03 && Math.abs(s1.rigY) < 1e-6, `head.y=${s1.head[1].toFixed(3)} rig.y=${s1.rigY}`);
T.check('visitor starts where they stood on the desktop (inside, facing the interior)', Math.hypot(s1.head[0] - pre.x, s1.head[2] - pre.z) < 0.05 && Math.abs(Math.atan2(Math.sin(s1.yaw - pre.yaw), Math.cos(s1.yaw - pre.yaw))) < 0.05, `head=(${s1.head[0].toFixed(2)},${s1.head[2].toFixed(2)}) yaw=${s1.yaw.toFixed(2)} (was ${pre.yaw.toFixed(2)})`);
T.check('both controllers connected', s1.ctrl.includes('left') && s1.ctrl.includes('right'), s1.ctrl.join(','));
await snap('xr-01-session-start');
// single render loop: every XR frame is exactly one app frame
const lp0 = await ev(() => ({ a: window.__residence.frameCount, b: window.__h.frame() }));
await frames(4);
const lp1 = await ev(() => ({ a: window.__residence.frameCount, b: window.__h.frame() }));
T.check('one animation loop (app frames == XR frames)', lp1.a - lp0.a === lp1.b - lp0.b, `app +${lp1.a - lp0.a}, xr +${lp1.b - lp0.b}`);

// ------------------------------------------------------------------ B. teleport
// aim forward and slightly down; stick forward shows the arc, releasing teleports
const fwdPoint = await ev(() => { const h = window.__h.head(), V = window.__h.V; const f = window.__residence.xr._headForward(new V()); f.y = 0; f.normalize(); return { x: h.x + f.x * 4, y: 0, z: h.z + f.z * 4 }; });
await settle('right', fwdPoint);
await stick('right', 0, -1);
await frames(3);
const aim1 = await ev(() => { const x = window.__residence.xr, c = x.controllers.find((k) => k.hand === 'right'); return { aiming: c.aiming, valid: c.aimValid, arc: x.arc.visible, dest: x.dest.visible, pt: c.aimPoint.toArray() }; });
T.check('stick forward shows a teleport arc with a destination marker', aim1.aiming && aim1.arc && aim1.dest, JSON.stringify(aim1.pt.map((n) => +n.toFixed(2))));
T.check('open floor is a valid destination', aim1.valid);
await stick('right', 0, 0);
await page.waitForFunction(() => !window.__residence.xr.fade, null, { timeout: 120000 });
await frames(2);
const tp1 = await ev(() => ({ head: window.__h.head().toArray(), free: window.__residence.world.nav.free(window.__h.head().x, window.__h.head().z, true) }));
T.check('releasing teleports the head to the marker', Math.hypot(tp1.head[0] - aim1.pt[0], tp1.head[2] - aim1.pt[2]) < 0.2 && tp1.free, `head=(${tp1.head[0].toFixed(2)},${tp1.head[2].toFixed(2)}) free=${tp1.free}`);

// cannot teleport through a wall: stand in the living room, aim east into the master bedroom
await ev(() => { const x = window.__residence.xr; x._placeHead(9, 8, -Math.PI / 2); });
await frames(2);
const eastPoint = { x: 14.5, y: 0, z: 8 };
await settle('right', eastPoint);
const wallTest = await ev(() => {
  const x = window.__residence.xr, c = x.controllers.find((k) => k.hand === 'right'), V = window.__h.V;
  // sweep the pitch until the arc lands inside the bedroom, then ask the real validator
  const res = [];
  for (let deg = -2; deg >= -30; deg -= 2) {
    const q = new c.ctrl.quaternion.constructor().setFromEuler(new c.ctrl.rotation.constructor(deg * Math.PI / 180, -Math.PI / 2, 0, 'YXZ'));
    c.origin = new V(9.2, 1.3, 8); c.dir = new V(0, 0, -1).applyQuaternion(q);
    x._aim(c);
    if (c.aimPoint.x > 12.4 && c.aimPoint.x < 20) res.push({ deg, x: +c.aimPoint.x.toFixed(2), valid: c.aimValid });
  }
  x.arc.visible = false; x.dest.visible = false;
  return res;
});
T.check('arc landing in the next room is rejected (wall between)', wallTest.length > 0 && wallTest.every((r) => !r.valid), `${wallTest.length} landings, valid=${wallTest.filter((r) => r.valid).length}`);
const furnTest = await ev(() => {
  const x = window.__residence.xr, c = x.controllers.find((k) => k.hand === 'right'), V = window.__h.V;
  const res = [];
  for (let deg = 24; deg >= -12; deg -= 1) {     // launch angles (up positive) that reach the table 4.8 m away
    const q = new c.ctrl.quaternion.constructor().setFromEuler(new c.ctrl.rotation.constructor(deg * Math.PI / 180, 0, 0, 'YXZ'));
    c.origin = new V(4.6, 1.3, 11.4); c.dir = new V(0, 0, -1).applyQuaternion(q);
    x._aim(c);
    if (Math.hypot(c.aimPoint.x - 4.6, c.aimPoint.z - 6.6) < 0.5) res.push({ deg, z: +c.aimPoint.z.toFixed(2), valid: c.aimValid });
  }
  x.arc.visible = false; x.dest.visible = false;
  return res;
});
T.check('arc landing on the coffee table / furniture footprint is rejected', furnTest.length > 0 && furnTest.every((r) => !r.valid), `${furnTest.length} landings`);

// ------------------------------------------------------------------ C. wall prompt
await ev(() => window.__residence.xr._placeHead(16, -1.0, Math.PI));
await frames(2);
const wallPt = { x: 16, y: 1.3, z: -0.1 };
await settle('right', wallPt);
await page.waitForFunction(() => window.__residence.custom.target, null, { timeout: 120000 });
await frames(3);
const c1 = await ev(() => { const R = window.__residence; return { label: R.custom.target?.label, dist: R.custom.target?.distance, prompt: R.xr.ui.prompt.visible, hl: R.walls.highlighted, ov: R.walls.overlay.visible }; });
await snap('xr-00-wall-prompt');
T.check('pointing at a wall within range highlights it and shows the controller prompt', c1.label === 'Kitchen · South wall' && c1.prompt && c1.ov, `${c1.label} @ ${c1.dist?.toFixed(2)} m`);
await ev(() => window.__residence.xr._placeHead(16, -3.4, Math.PI));
await settle('right', { x: 16, y: 1.3, z: -0.1 });
await page.waitForFunction(() => !window.__residence.custom.target, null, { timeout: 120000 }).catch(() => {});
await frames(2);
const far = await ev(() => ({ t: window.__residence.custom.target?.label ?? null, p: window.__residence.xr.ui.prompt.visible }));
T.check('no prompt when the wall is beyond the proximity distance (1.5 m)', !far.t && !far.p, JSON.stringify(far));
await ev(() => window.__residence.xr._placeHead(16, -1.0, Math.PI));
await settle('right', wallPt);
await page.waitForFunction(() => window.__residence.custom.target, null, { timeout: 120000 });
await frames(2);

// pull the trigger on the prompt; hold it for a while: still exactly one activation
await ev(() => { const R = window.__residence; window.__opens = 0; R.custom.on('open', () => { window.__opens++; }); });
await ev(() => { const p = window.__residence.xr.ui.prompt; const w = p.mesh.getWorldPosition(new window.__h.V()); window.__h.aim('right', w); });
await frames(3);
const hv = await ev(() => window.__residence.xr.controllers.find((k) => k.hand === 'right').hover?.kind);
T.check('ray over the prompt hovers it', hv === 'ui', String(hv));
await ev(() => window.__xrDevice.controllers.right.updateButtonValue('trigger', 1));
await frames(4);
const heldOpen = await ev(() => window.__residence.custom.state.open);
T.check('activation happens on trigger release, not on press (no accidental selection)', heldOpen === false);
await ev(() => window.__xrDevice.controllers.right.updateButtonValue('trigger', 0));
await frames(4);
const opened = await ev(() => { const R = window.__residence; return { open: R.custom.state.open, wall: R.custom.state.wallId, opens: window.__opens, panel: R.xr.ui.main.visible }; });
T.check('trigger on the prompt opens the panel for that wall exactly once', opened.open && opened.opens === 1 && /^w\d+[np]:kitchen$/.test(opened.wall), JSON.stringify(opened));
const pdist = await ev(() => {
  const R = window.__residence, x = R.xr, V = window.__h.V, m = x.ui.main.mesh;
  const head = x._headWorld(new V()), c = m.getWorldPosition(new V()), dir = c.clone().sub(head);
  const d = dir.length(); dir.normalize();
  // is anything solid between the viewer's eyes and the panel?  (walls, furniture, built-ins)
  const blocker = R.custom.clearance(head, dir, d - 0.02);
  const wallAhead = R.custom.clearance(new V(head.x, head.y, head.z), x._headForward(new V()), 3);
  return { d, blocked: blocker < d - 0.03, scale: m.scale.x, apparent: m.geometry.parameters.width * m.scale.x / d, wallAhead };
});
T.check('panel is visible: nothing (wall, furniture) sits between the viewer and it', !pdist.blocked, `panel at ${pdist.d.toFixed(2)} m, wall ahead at ${pdist.wallAhead.toFixed(2)} m`);
T.check('panel is a world-space object 0.5-1.2 m away, keeping its apparent size when pulled in', pdist.d >= 0.5 && pdist.d <= 1.2 && Math.abs(pdist.apparent - 1.2 / 1.15) < 0.02, `distance=${pdist.d.toFixed(2)} m, scale=${pdist.scale.toFixed(2)}`);
// wall stays locked while the ray roams
await ev(() => window.__h.aim('right', new window.__h.V(10, 1.3, -3)));
await frames(5);
const locked = await ev(() => window.__residence.custom.state.wallId === window.__residence.walls.highlighted);
T.check('selected wall stays fixed while the panel is open', locked);
await frames(2);
await snap('xr-02-panel-open');
fs.writeFileSync(`${OUT}/xr-panel-walls.png`, Buffer.from((await ev(() => window.__residence.xr.ui.main.canvas.toDataURL('image/png'))).split(',')[1], 'base64'));

// ------------------------------------------------------------------ D. panel interactions
const wallId = opened.wall;
const colorOf = (id) => ev((i) => window.__residence.walls.get(i).hex, id);
await clickWidget('main', "it.t === 'swatch' && it.label === 'Terracotta'", 'Terracotta swatch');
T.check('swatch changes the selected wall colour', (await colorOf(wallId)) === '#b8694c', await colorOf(wallId));
const otherChanged = await ev((i) => [...window.__residence.walls.faces.values()].filter((f) => f.id !== i && f.hex).length, wallId);
T.check('editing one wall does not change any other wall', otherChanged === 0, `${otherChanged} others changed`);

// drag the hue slider with the trigger held
const hue0 = await ev(() => window.__residence.custom.state.pickHex);
const sl = await ev(() => { const p = window.__residence.xr.ui.main; const it = p.items.find((i) => i.t === 'slider' && i.kind === 'hue'); return it.rect; });
const at = (f) => ev(([r, fr]) => { const w = window.__h.panelPoint(window.__residence.xr.ui.main, r[0] + r[2] * fr, r[1] + r[3] / 2); window.__h.aim('right', w); }, [sl, f]);
await at(0.1); await frames(3);
await ev(() => window.__xrDevice.controllers.right.updateButtonValue('trigger', 1)); await frames(2);
await at(0.45); await frames(3);
await at(0.8); await frames(3);
await ev(() => window.__xrDevice.controllers.right.updateButtonValue('trigger', 0)); await frames(3);
const hue1 = await ev(() => ({ pick: window.__residence.custom.state.pickHex, wall: window.__residence.walls.get(window.__residence.custom.state.wallId).hex }));
T.check('hue slider can be dragged with the controller; wall follows live', hue1.pick !== hue0 && hue1.wall === hue1.pick, `${hue0} -> ${hue1.pick}`);

await clickWidget('main', "it.t === 'button' && it.label === 'Apply to all walls'", 'Apply to all');
const all = await ev(() => ({ painted: [...window.__residence.walls.faces.values()].filter((f) => f.room && f.hex).length, total: window.__residence.walls.interiorIds().length }));
T.check('"Apply to all walls" tints every interior wall', all.painted === all.total && all.total > 20, `${all.painted}/${all.total}`);
await clickWidget('main', "it.t === 'button' && it.label === 'Restore original'", 'Restore original');
T.check('"Restore original" restores just the selected wall', (await colorOf(wallId)) === null && (await ev(() => [...window.__residence.walls.faces.values()].filter((f) => f.room && f.hex).length)) === all.total - 1);

// environment tab: all five presets through the headset UI
await clickWidget('main', "it.t === 'tab' && it.label === 'Light'", 'Light tab');
const envs = [['Bright Daylight', 'day'], ['Warm Golden Hour', 'sunset'], ['Overcast Soft Light', 'overcast'], ['Evening Interior', 'evening'], ['Night Interior', 'night']];
for (const [name, id] of envs) {
  await clickWidget('main', `it.t === 'preset' && it.name === ${JSON.stringify(name)}`, name);
  await frames(2);
  const e = await ev(() => ({ env: window.__residence.custom.environment, mode: window.__residence.lighting.mode, to: window.__residence.lighting.to?.sunIntensity }));
  T.check(`environment preset "${name}" applies in VR`, e.env === id && e.mode === id);
}
await clickWidget('main', "it.t === 'button' && it.label === 'Restore original'", 'Restore original environment');
T.check('original environment can be restored', (await ev(() => window.__residence.custom.environment)) === 'sunset');
await snap('xr-03-environment');

// furniture tab: pick from the list, grab with the grip, rotate, cancel
await clickWidget('main', "it.t === 'tab' && it.label === 'Furniture'", 'Furniture tab');
await clickWidget('main', "it.t === 'button' && it.kind === 'list' && /stool/i.test(it.label)", 'bar stool in list');
const sel = await ev(() => { const f = window.__residence.furniture; return f.selected && { id: f.selectedId, x: f.selected.cur.x, z: f.selected.cur.z }; });
T.check('furniture can be selected from the headset panel', !!sel, sel?.id);
if (sel) {
  await ev((s) => { window.__s = s; }, sel);
  // grab: squeeze while pointing at the floor 0.6 m to the side of the stool (valid), release to place
  const target = { x: sel.x - 0.7, y: 0, z: sel.z + 0.9 };
  await ev((s) => window.__h.aim('right', new window.__h.V(s.x, 0, s.z)), sel);   // point at the piece,
  await frames(2);
  await ev(() => window.__xrDevice.controllers.right.updateButtonValue('squeeze', 1)); await frames(2); // grab it,
  await ev((t) => window.__h.aim('right', new window.__h.V(t.x, t.y, t.z)), target);                   // then carry it
  await frames(3);
  const during = await ev(() => { const f = window.__residence.furniture; return { dragging: !!f.drag, y: f.selected.group.position.y, x: f.selected.cur.x }; });
  await ev(() => window.__xrDevice.controllers.right.updateButtonValue('squeeze', 0)); await frames(3);
  const placed = await ev(() => { const f = window.__residence.furniture; return { dragging: !!f.drag, x: f.selected.cur.x, z: f.selected.cur.z, y: f.selected.group.position.y }; });
  T.check('grip grabs the piece, it stays on the floor, and release places it', during.dragging && during.y === 0 && !placed.dragging && placed.y === 0 && Math.hypot(placed.x - sel.x, placed.z - sel.z) > 0.2, `moved ${Math.hypot(placed.x - sel.x, placed.z - sel.z).toFixed(2)} m`);
  // pointing through the wall at the hallway floor beyond it is refused and the piece snaps back
  await ev((p) => window.__h.aim('right', new window.__h.V(p.x, 0, p.z)), placed);
  await frames(2);
  await ev(() => window.__xrDevice.controllers.right.updateButtonValue('squeeze', 1)); await frames(2);
  await ev((p) => window.__h.aim('right', new window.__h.V(p.x, 0, 1.2)), placed);   // hallway, other side of the kitchen wall
  await frames(3);
  const mid = await ev(() => window.__residence.furniture.drag?.valid);
  await ev(() => window.__xrDevice.controllers.right.updateButtonValue('squeeze', 0)); await frames(3);
  const back = await ev(() => { const f = window.__residence.furniture; return { x: f.selected.cur.x, z: f.selected.cur.z }; });
  T.check('carrying furniture through a wall is refused and it returns to its last valid spot', mid === false && Math.hypot(back.x - placed.x, back.z - placed.z) < 0.01, `valid-while-carried=${mid}, back=(${back.x.toFixed(2)},${back.z.toFixed(2)})`);
  const ry0 = await ev(() => window.__residence.furniture.selected.cur.ry);
  await clickWidget('main', "it.t === 'button' && it.label.startsWith('Rotate') && it.label.includes('\\u21ba')", 'rotate');
  const ry1 = await ev(() => window.__residence.furniture.selected.cur.ry);
  T.check('rotate button turns the piece by 15°', Math.abs(Math.abs(ry1 - ry0) - Math.PI / 12) < 1e-3, `${((ry1 - ry0) * 180 / Math.PI).toFixed(1)}°`);
  await clickWidget('main', "it.t === 'button' && it.label === 'Reset piece'", 'Reset piece');
  const home = await ev(() => { const s = window.__residence.furniture.selected; return Math.hypot(s.cur.x - s.home.x, s.cur.z - s.home.z) < 0.01 && s.cur.ry === 0; });
  T.check('Reset piece returns it to its original place and angle', home);
}
await snap('xr-04-furniture');
await clickWidget('main', "it.t === 'button' && it.label === 'Done'", 'Done');

// room tab: confirmation, empty, restore, reset
await clickWidget('main', "it.t === 'tab' && it.label === 'Room'", 'Room tab');
await clickWidget('main', "it.t === 'button' && it.label.startsWith('Empty') && !it.label.includes('whole')", 'Empty this room');
const dlg = await ev(() => !!window.__residence.custom.state.dialog);
T.check('emptying asks for confirmation first', dlg && (await ev(() => window.__residence.furniture.countHidden())) === 0);
await clickWidget('main', "it.t === 'button' && it.label === 'Empty room'", 'confirm');
const emptied = await ev(() => ({ hidden: window.__residence.furniture.countHidden(), stool: window.__residence.furniture.get('kitchen-stool-1').hidden, bed: window.__residence.furniture.get('master-bed').hidden, walls: window.__residence.walls.faces.size }));
T.check('Empty Room hides this room\'s movable furniture only', emptied.hidden > 0 && emptied.stool && !emptied.bed && emptied.walls > 40, JSON.stringify(emptied));
await clickWidget('main', "it.t === 'button' && it.label === 'Restore furniture'", 'Restore furniture');
T.check('Restore Furniture brings everything back', (await ev(() => window.__residence.furniture.countHidden())) === 0);
// make a mess, then Reset room
await ev(() => { const R = window.__residence; R.custom.state.wallId = [...R.walls.faces.keys()][3]; R.custom.paintSelected('#336699', true); R.custom.setEnvironment('night', true); });
await clickWidget('main', "it.t === 'button' && it.label === 'Reset room'", 'Reset room');
await clickWidget('main', "it.t === 'button' && it.label === 'Reset room' && it.kind === 'danger'", 'confirm reset');
await frames(2);
const rs = await ev(() => { const R = window.__residence; return { mod: R.furniture.isModified(), painted: [...R.walls.faces.values()].filter((f) => f.hex).length, env: R.custom.environment }; });
T.check('Reset Room restores layout, wall colours and environment', !rs.mod && rs.painted === 0 && rs.env === 'sunset', JSON.stringify(rs));
await clickWidget('main', "it.t === 'button' && it.label === 'Close'", 'Close');
T.check('Close button dismisses the panel', !(await ev(() => window.__residence.custom.state.open)) && !(await ev(() => window.__residence.xr.ui.main.visible)));

// ------------------------------------------------------------------ E. controller menu and exit
await ev(() => window.__xrDevice.controllers.right.updateButtonValue('b-button', 1)); await frames(2);
await ev(() => window.__xrDevice.controllers.right.updateButtonValue('b-button', 0)); await frames(3);
T.check('B button toggles the customise panel (no keyboard needed)', await ev(() => window.__residence.custom.state.open));
await ev(() => window.__residence.custom.close()); await frames(2);
// bring a modification across the session boundary to prove desktop/VR share one state
await ev(() => { const R = window.__residence; R.custom.state.wallId = [...R.walls.faces.keys()].find((k) => R.walls.get(k).room); R.custom.paintSelected('#7b7d56', true); R.furniture.select('living-pouf'); R.furniture.beginDrag('living-pouf'); R.furniture.dragTo(8.8, 10); R.furniture.endDrag(true); R.furniture.deselect(); window.__shared = { wall: R.custom.state.wallId, hex: R.walls.get(R.custom.state.wallId).hex }; });
// toolbar sits on the left controller; point the right ray at its Exit VR button
await ev(() => { const x = window.__residence.xr; x.ui.toolbar.visible = true; const h = window.__h.head(), V = window.__h.V; const f = x._headForward(new V()); f.y = 0; f.normalize(); window.__h.hold('left', h.clone().addScaledVector(new V(-f.z, 0, f.x), -0.28).add(new V(0, -0.6, 0)).addScaledVector(f, 0.25)); });
await frames(3);
await ev(() => { const x = window.__residence.xr; const p = x.ui.toolbar; p.update(true); const it = p.items.find((i) => i.key === 'exit'); const w = window.__h.panelPoint(p, ...window.__h.center(it)); window.__h.aim('right', w); });
await page.waitForFunction(() => window.__residence.xr.controllers.find((k) => k.hand === 'right').hover?.kind === 'ui', null, { timeout: 60000 }).catch(() => {});
const th = await ev(() => window.__residence.xr.controllers.find((k) => k.hand === 'right').hover?.kind);
T.check('controller toolbar ("Customise" / "Exit VR") can be pointed at', th === 'ui', String(th));
await ev(() => window.__xrDevice.controllers.right.updateButtonValue('trigger', 1)); await frames(2);
await ev(() => window.__xrDevice.controllers.right.updateButtonValue('trigger', 0));   // releasing activates Exit VR; no more XR frames follow
await page.waitForFunction(() => !window.__residence.xr.presenting, null, { timeout: 120000 });
await page.waitForTimeout(1500);
const ex = await ev(() => {
  const R = window.__residence, x = R.xr;
  return { xr: R.renderer.xr.isPresenting, playerXr: R.player.xr, rig: [x.rig.position.x, x.rig.position.y, x.rig.position.z, x.rig.rotation.y], cam: R.camera.position.toArray(), aspect: R.camera.aspect, wnd: innerWidth / innerHeight, proj: R.camera.projectionMatrix.elements[5], fov: R.camera.fov, hud: getComputedStyle(document.querySelector('#hud')).visibility, shared: { hex: R.walls.get(window.__shared.wall).hex, pouf: [R.furniture.get('living-pouf').cur.x, R.furniture.get('living-pouf').cur.z] }, ui: x.ui.main.visible || x.ui.toolbar.visible || x.ui.prompt.visible, mode: R.mode };
});
T.check('Exit VR ends the session', !ex.xr && !ex.playerXr);
T.check('desktop camera restored (eye height, aspect, projection)', Math.abs(ex.cam[1] - 1.65) < 0.05 && Math.abs(ex.aspect - ex.wnd) < 0.01 && Math.abs(ex.proj - 1 / Math.tan((ex.fov * Math.PI / 180) / 2)) < 1e-3 && ex.rig.every((v) => v === 0), `cam.y=${ex.cam[1].toFixed(2)} aspect=${ex.aspect.toFixed(3)}`);
T.check('VR widgets hidden and desktop HUD visible again', !ex.ui && ex.hud === 'visible');
T.check('wall colour and furniture edited in VR persist on the desktop (shared state)', ex.shared.hex === '#7b7d56' && Math.hypot(ex.shared.pouf[0] - 8.8, ex.shared.pouf[1] - 10) < 0.01);
// desktop navigation still works after the session (step the loop deterministically: software GL is slow)
const mv = await ev(() => { const R = window.__residence; const p0 = [R.player.pos.x, R.player.pos.y]; R.player.keys.add('KeyW'); R.step(60, 1 / 30, false); R.player.keys.clear(); return Math.hypot(R.player.pos.x - p0[0], R.player.pos.y - p0[1]); });
T.check('desktop walking works after leaving VR', mv > 0.5, `moved ${mv.toFixed(2)} m`);
await snap('xr-05-after-exit');
const memFirst = await ev(() => { const R = window.__residence, i = R.renderer.info; return { geo: i.memory.geometries, tex: i.memory.textures, kids: R.scene.children.length }; });

// ------------------------------------------------------------------ F. second session / leaks
await page.click('#vr-btn');
await page.waitForFunction(() => window.__residence.xr.presenting, null, { timeout: 120000 });
await frames(3);
await ev(() => window.__residence.xr.exit());
await page.waitForFunction(() => !window.__residence.xr.presenting, null, { timeout: 120000 });
await page.waitForTimeout(1500);
const after = await ev(() => { const R = window.__residence, i = R.renderer.info; return { geo: i.memory.geometries, tex: i.memory.textures, kids: R.scene.children.length, listeners: R.xr.listeners.length }; });
T.check('re-entering VR works; scene graph and listeners do not grow', after.kids === memFirst.kids && after.listeners === 12, `scene children ${memFirst.kids} -> ${after.kids}, listeners ${after.listeners}`);
T.check('no GPU resource growth between the first and second session', after.geo === memFirst.geo && after.tex === memFirst.tex, `geometries ${memFirst.geo}->${after.geo}, textures ${memFirst.tex}->${after.tex}`);

await browser.close();
process.exit(T.done(logs) ? 0 : 1);
