/*
 * End-to-end test of the apartment layout in a real (headless) browser: the plan loaded and built,
 * every room reachable, doors, wall targeting and painting on the plan's own walls, furniture rules,
 * the Home panel (lights, curtains, breeze, terrace door), the blueprint view, the ocean, and that the
 * original residence still loads when chosen.
 *
 *   npm run dev            (in another terminal)
 *   npm run test:apartment
 */
import { launch, openApp, suite } from './lib.mjs';

const { browser, page, logs } = await launch({ width: 960, height: 600 });
const T = suite('Apartment');
const ev = (fn, arg) => page.evaluate(fn, arg);

await openApp(page, 'home=apartment&enter&still&reset');
page.setDefaultTimeout(60000);

// ---- the plan is built
const built = await ev(() => {
  const R = window.__residence, W = R.world;
  return {
    layout: document.body.dataset.layout, mode: R.mode,
    items: W.items.size, movable: [...W.items.values()].filter((i) => i.meta.movable).length,
    faces: W.faceDefs.size, interior: R.walls.interiorIds().length,
    statics: W.staticMeshes.length, curtains: W.curtains.length, rooms: [...R.lighting.rooms.keys()].sort().join(','),
    doors: [...new Set([...W.interact.doors.values()])].length, eye: R.camera.position.y,
  };
});
T.check('the apartment layout is active and walking', built.layout === 'apartment' && built.mode === 'walk', JSON.stringify({ l: built.layout, m: built.mode }));
T.check('the plan\'s furniture became individually movable pieces', built.items >= 30 && built.movable === built.items, `${built.items} pieces`);
T.check('wall faces are separately paintable', built.interior >= 20, `${built.interior} interior faces of ${built.faces}`);
T.check('every room has its own light group', built.rooms === 'bath,bedroom,dining,entry,kitchen,living,study,terrace', built.rooms);
T.check('four hinged doors and the sliding terrace door exist', built.doors === 5, `${built.doors}`);
T.check('eye height is 1.65 m', Math.abs(built.eye - 1.65) < 0.05);

// ---- every room can be reached on foot from the front door
const routes = await ev(() => {
  const R = window.__residence, L = R.world;
  const views = { living: [10.0, -3.2], dining: [10.0, -4.2], kitchen: [9.9, -1.2], entry: [3.1, -1.3], bedroom: [3.9, -4.55], study: [6.6, -5.9], bath: [2.1, -3.7], terrace: [13.2, -0.8] };
  const out = {};
  for (const [k, [x, z]] of Object.entries(views)) {
    const p = L.nav.findPath(3.1, -1.5, x, z);
    out[k] = p ? p.length : 0;
  }
  return out;
});
T.check('a walking route exists from the front door to every room', Object.values(routes).every((n) => n > 0), JSON.stringify(routes));

// ---- walking really goes through doors, and closed doors really block
const walk = await ev(() => {
  const R = window.__residence;
  R.player.setPose(3.1, -1.5, 0); R.step(2, 1 / 30, false);
  R.goToRoom('bedroom');
  R.step(30 * 40, 1 / 30, false);
  return { x: R.player.pos.x, z: R.player.pos.y, room: R.world.nav ? true : false, door: R.world.interact.doors.get('Door_Bedroom').open };
});
T.check('selecting the bedroom walks there through the bedroom door', walk.z < -4.3 && walk.x < 4.5, `(${walk.x.toFixed(1)}, ${walk.z.toFixed(1)})`);
T.check('the bedroom door opened on the way', walk.door === true);
const blocked = await ev(() => {
  const R = window.__residence, nav = R.world.nav;
  R.world.interact.doors.get('Door_Study').set(false);
  R.step(120, 1 / 30, false);
  // a point on the door line is solid while the door is closed
  return nav.free(5.99, -5.4, true);
});
T.check('a closed door blocks the doorway', blocked === false);

// ---- wall targeting and painting on the plan's own walls
const targeting = await ev(() => {
  const R = window.__residence, W = R.walls, V = R.camera.position.constructor;
  let ok = 0, tried = 0, wrong = 0;
  for (const f of W.faces.values()) {
    if (!f.room) continue;
    const r = f.ranges[0], p = r.mesh.geometry.attributes.position;
    // aim at the middle of the first triangle of the face, from 0.9 m in front of it
    const c = new V((p.getX(r.start) + p.getX(r.start + 1) + p.getX(r.start + 2)) / 3, 0, (p.getZ(r.start) + p.getZ(r.start + 1) + p.getZ(r.start + 2)) / 3);
    const ox = c.x + f.normal[0] * 0.9, oz = c.z + f.normal[1] * 0.9;
    if (!R.world.nav.free(ox, oz, false)) continue;
    tried++;
    R.player.setPose(ox, oz, 0, 0);
    R.player.lookAt(c.x, 1.65, c.z, true);
    R.step(2, 1 / 30, false);
    const d = new V(); R.camera.getWorldDirection(d);
    const q = R.custom.queryWall(R.camera.position.clone(), d);
    if (q && q.id === f.id) ok++; else if (q && q.id !== f.id) wrong++;
  }
  return { ok, tried, wrong };
});
T.check('looking at a plan wall from 0.9 m targets that very wall', targeting.ok >= 6 && targeting.wrong === 0, JSON.stringify(targeting));

const paint = await ev(() => {
  const R = window.__residence, W = R.walls;
  const ids = W.interiorIds();
  const id = ids[0], other = ids[1];
  W.restoreAll();
  W.paint(id, '#b8694c');
  const f = W.get(id), o = W.get(other);
  const col = (face) => { const r = face.ranges[0]; const a = r.mesh.geometry.attributes.color; return [a.getX(r.start), a.getY(r.start), a.getZ(r.start)].map((v) => +v.toFixed(2)); };
  return { painted: col(f), neighbour: col(o), label: f.label };
});
T.check('painting one wall tints only that wall', paint.painted[0] !== 1 && paint.neighbour.every((v) => v === 1), JSON.stringify(paint));
await ev(() => window.__residence.walls.restoreAll());

// ---- furniture rules
const furn = await ev(() => {
  const R = window.__residence, F = R.furniture;
  const home = F.get('DiningChair_3').cur;
  F.select('DiningChair_3'); F.beginDrag('DiningChair_3');
  const outside = F.dragTo(-0.5, -6.0);           // beyond the west wall
  F.endDrag(true);
  const backHome = Math.hypot(F.get('DiningChair_3').cur.x - home.x, F.get('DiningChair_3').cur.z - home.z) < 0.01;
  F.select('DiningChair_3'); F.beginDrag('DiningChair_3');
  const free = F.dragTo(home.x + 0.5, home.z + 0.4);
  F.endDrag(true);
  const moved = F.get('DiningChair_3').cur.x !== home.x;
  F.select('DiningChair_3'); F.resetItem(); F.deselect();
  // a table's place settings travel with it
  const table = F.get('DiningTable_Oval');
  const children = table.group.children.length;
  const pieces = F.countVisible('bedroom');
  const hidden = F.empty('bedroom');
  const after = F.countVisible('bedroom');
  F.restoreHidden();
  return { outside, backHome, free, moved, children, pieces, hidden, after, restored: F.countVisible('bedroom') };
});
T.check('furniture cannot be placed outside the apartment', furn.outside === false && furn.backHome);
T.check('furniture can be moved to a free spot', furn.free === true && furn.moved);
T.check('decor on a table moves with it (same piece)', furn.children >= 4, `${furn.children} materials in the dining table piece`);
T.check('Empty Room hides the room\'s movable pieces and Restore brings them back', furn.hidden > 0 && furn.after === 0 && furn.restored === furn.pieces, JSON.stringify(furn));

// ---- Home panel: lights, curtains, breeze, terrace door
const home = await ev(() => {
  const R = window.__residence, h = R.custom.home, L = R.lighting;
  R.setTimeOfDay('day'); R.step(200, 1 / 30, false);
  const before = L.isOn('living');
  h.toggleRoom('living'); R.step(60, 1 / 30, false);
  const toggled = L.isOn('living') !== before;
  h.allLights(true); R.step(60, 1 / 30, false);
  const allOn = h.rooms().every((r) => r.on);
  h.allLights(false); R.step(60, 1 / 30, false);
  const allOff = h.rooms().every((r) => !r.on);
  const level = [...L.rooms.values()].reduce((m, r) => Math.max(m, r.level), 0);
  h.curtains.set(false); R.step(200, 1 / 30, false);
  const closed = h.curtains.open() === false;
  h.curtains.set(true); R.step(200, 1 / 30, false);
  h.door.set(true); R.step(240, 1 / 30, false);
  const doorOpen = h.door.open();
  h.door.set(false); R.step(240, 1 / 30, false);
  R.custom.open({ wallId: null, tab: 'home' });
  const schema = R.custom.getSchema();
  R.custom.close();
  return { toggled, allOn, allOff, level, closed, doorOpen, tabs: schema.tabs.map((t) => t.id).join(','), buttons: schema.body.filter((b) => b.t === 'buttons').length };
});
T.check('a room\'s light can be switched on and off', home.toggled);
T.check('All on / All off switch every room', home.allOn && home.allOff && home.level < 0.05);
T.check('curtains close and open', home.closed);
T.check('the terrace door opens and closes', home.doorOpen === true);
T.check('the Home tab is part of the customise panel (shared by desktop and VR)', home.tabs.includes('home') && home.buttons >= 5, home.tabs);

// ---- breeze
const wind = await ev(() => {
  const R = window.__residence;
  const mats = R.world.curtains.flatMap((c) => c.panels.map((p) => p.mesh.material));
  const u = mats.map((m) => m.userData.windUniforms).filter(Boolean);
  const t0 = u[0].uWindT.value;
  R.step(60, 1 / 30, false);
  const t1 = u[0].uWindT.value;
  R.custom.home.wind.set(false);
  const off = u[0].uWindK.value;
  R.custom.home.wind.set(true);
  return { n: u.length, moving: t1 > t0, off, on: u[0].uWindK.value };
});
T.check('every curtain has a wind-driven material that follows the clock', wind.n >= 8 && wind.moving, `${wind.n} cloth panels`);
T.check('the breeze can be switched off and on', wind.off === 0 && wind.on === 1);

// ---- ocean
const sea = await ev(() => {
  const R = window.__residence, o = R.world.ocean;
  const t0 = o.uniforms.uTime.value; R.step(30, 1 / 30, false);
  return { has: !!o.sea, moving: o.uniforms.uTime.value > t0, level: o.sea.position.y, hasCliff: !!o.cliff };
});
T.check('an animated ocean and cliff surround the plateau', sea.has && sea.moving && sea.hasCliff, `sea level ${sea.level} m`);

// ---- blueprint
const bp = await ev(() => {
  const R = window.__residence, B = R.custom.home.blueprint;
  const visibleBefore = (() => { let n = 0; R.scene.traverse((o) => { if (o.isMesh && o.visible && !o.userData.noBlueprint) n++; }); return n; })();
  B.set(true); R.step(40, 1 / 30, false);
  const visibleDuring = (() => { let n = 0; R.scene.traverse((o) => { if (o.isMesh && o.visible && !o.userData.noBlueprint) n++; }); return n; })();
  const ribbons = (() => { let n = 0; R.scene.traverse((o) => { if (o.isMesh && o.visible && o.userData.noBlueprint && o.geometry?.isInstancedBufferGeometry) n++; }); return n; })();
  const bg = R.scene.background && R.scene.background.isColor ? R.scene.background.getHex() : null;
  B.set(false); R.step(10, 1 / 30, false);
  const visibleAfter = (() => { let n = 0; R.scene.traverse((o) => { if (o.isMesh && o.visible && !o.userData.noBlueprint) n++; }); return n; })();
  return { visibleBefore, visibleDuring, ribbons, bg, visibleAfter, bodyClass: document.body.classList.contains('blueprint') };
});
T.check('blueprint view hides the finished rooms and draws neon edges', bp.visibleDuring < bp.visibleBefore * 0.2 && bp.ribbons > 100, JSON.stringify({ before: bp.visibleBefore, during: bp.visibleDuring, ribbons: bp.ribbons }));
T.check('leaving the blueprint view restores every surface', bp.visibleAfter === bp.visibleBefore && !bp.bodyClass, `${bp.visibleAfter}/${bp.visibleBefore}`);

// ---- persistence is per home
const store = await ev(async () => {
  const R = window.__residence;
  R.walls.paint(R.walls.interiorIds()[0], '#8899aa');
  R.custom.changed();
  await new Promise((r) => setTimeout(r, 600));
  return { apartment: !!localStorage.getItem('inspiraxr.customisation.apartment.v1'), residence: !!localStorage.getItem('inspiraxr.customisation.v1') };
});
T.check('customisation is stored separately for the apartment', store.apartment && !store.residence, JSON.stringify(store));

// ---- the original residence still loads and has no blueprint button
await openApp(page, 'home=residence&enter&still&reset');
const res = await ev(() => ({ layout: document.body.dataset.layout, bp: document.querySelector('#bp-btn').classList.contains('hidden'), mode: window.__residence.mode, items: window.__residence.world.items.size, tabs: window.__residence.custom.getSchema().tabs.map((t) => t.id).join(',') }));
T.check('the original residence still loads unchanged', res.layout === 'residence' && res.mode === 'walk' && res.items > 40, JSON.stringify(res));
T.check('the blueprint button only appears where it is supported', res.bp === true);
T.check('the residence gets the Home controls too', res.tabs.includes('home'), res.tabs);

const ok = T.done(logs);
await browser.close();
process.exit(ok ? 0 : 1);
