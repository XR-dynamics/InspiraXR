/*
 * Fast logic tests (pure Node, no browser, no GPU): collision footprints, the Batcher's
 * item/face output, wall painting isolation, furniture placement rules, and the panel schema.
 *   npm run test:logic
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NavGrid } from '../src/nav/grid.js';
import { Batcher, splitBoxFaces, boxGeo, projectUV } from '../src/world/util.js';
import { WallSystem } from '../src/custom/walls.js';
import { FurnitureSystem } from '../src/custom/furniture.js';
import { Customiser } from '../src/custom/customiser.js';
import { ENVIRONMENTS } from '../src/custom/environment.js';

const vcol = (m) => new THREE.MeshStandardMaterial({ color: m });

function room() {
  // a 10 x 10 m walkable area with a wall along z = 5 (x 0..10) except a 1 m doorway at x 4..5
  const nav = new NavGrid(-1, -1, 11, 11, 0.1);
  nav.allowRect(0, 0, 10, 10);
  nav.wallRect(0, 4.9, 4, 5.1);
  nav.wallRect(5, 4.9, 10, 5.1);
  return nav;
}

test('footprint rotation matches THREE.Object3D rotation.y', () => {
  const nav = room();
  // a long thin shape along local +x, 2 m x 0.3 m, centred on its pivot (2, 2)
  nav.beginRecord(); nav.blockOriented(2, 2, 2, 0.3, 0); const shapes = nav.endRecord();
  nav.registerItem('bar', shapes, { x: 2, z: 2 });
  for (const ry of [0, Math.PI / 6, Math.PI / 2, 2.2, -1.1]) {
    const tf = { x: 6, z: 3, ry };
    const cells = new Set();
    nav._rasterShapes(shapes, { x: 2, z: 2 }, tf, 0, (k) => cells.add(k));
    // where THREE puts the local point (+0.8, 0, 0) of an object rotated by ry at (6, 3)
    const o = new THREE.Object3D(); o.position.set(6, 0, 3); o.rotation.y = ry; o.updateMatrixWorld();
    const w = new THREE.Vector3(0.8, 0, 0).applyMatrix4(o.matrixWorld);
    const k = nav.iz(w.z) * nav.w + nav.ix(w.x);
    assert.ok(cells.has(k), `end of the bar is covered at ry=${ry.toFixed(2)}`);
    // and a point off the bar's axis (0, 0, +0.6) is NOT covered
    const off = new THREE.Vector3(0, 0, 0.6).applyMatrix4(o.matrixWorld);
    assert.ok(!cells.has(nav.iz(off.z) * nav.w + nav.ix(off.x)), `side is empty at ry=${ry.toFixed(2)}`);
  }
});

test('placement: walls, other furniture, flat items, doorway passage', () => {
  const nav = room();
  const rec = (id, w, d, x, z, flat = false) => { nav.beginRecord(); nav.blockRect(x - w / 2, z - d / 2, x + w / 2, z + d / 2); nav.registerItem(id, nav.endRecord(), { x, z }); if (flat) nav.itemNav.get(id).flat = true; };
  rec('chair', 0.5, 0.5, 2, 2); rec('table', 1.5, 1, 6, 2); rec('rug', 3, 2, 8, 8, true);
  nav.rebuildDynamic('chair');
  assert.ok(nav.itemFits('chair', { x: 3.5, z: 2, ry: 0 }), 'free floor');
  assert.ok(!nav.itemFits('chair', { x: 6, z: 2, ry: 0 }), 'on top of the table');
  assert.ok(!nav.itemFits('chair', { x: 2, z: 4.9, ry: 0 }), 'inside the wall');
  assert.ok(nav.itemFits('chair', { x: 2, z: 4.6, ry: 0 }), 'sitting flush against the wall is allowed');
  assert.ok(!nav.itemFits('chair', { x: -3, z: 2, ry: 0 }), 'outside the plan');
  nav.rebuildDynamic('rug');
  assert.ok(nav.itemFits('rug', { x: 6, z: 2, ry: 0 }), 'a rug may lie under furniture');
  assert.ok(!nav.itemFits('rug', { x: 8, z: 5, ry: 0 }), 'but not across a wall');
  assert.ok(nav.wallOnSegment(2, 4, 2, 6), 'wall between the rooms');
  assert.ok(!nav.wallOnSegment(4.5, 4, 4.5, 6), 'doorway is open');
});

test('closed doors block teleport segments; open ones do not', () => {
  const nav = room();
  nav.registerDoor(0, 4, 4.8, 5, 5.2);
  assert.ok(nav.segmentBlocked(4.5, 4, 4.5, 6));
  nav.setDoorClosed(0, false);
  assert.ok(!nav.segmentBlocked(4.5, 4, 4.5, 6));
});

function build() {
  const scene = new THREE.Scene();
  const nav = room();
  const B = new Batcher(scene, () => 'main');
  const mat = vcol(0x888888), paint = new THREE.MeshStandardMaterial({ vertexColors: true });
  // two wall faces on either side of the z = 5 wall
  for (const [id, side] of [['wA', -1], ['wB', 1]]) {
    B.defineFace(id, { id, room: 'living', label: `Test ${id}`, normal: [0, -side] });
    const g = boxGeo(0, 0, 4.9, 4, 3, 5.1); projectUV(g);
    const parts = splitBoxFaces(g, 'z');
    B.add(side < 0 ? parts.neg : parts.pos, paint, { keepUV: true, face: id });
    if (parts.rest) B.add(parts.rest, paint, { keepUV: true });
  }
  const item = (id, x, z, meta = {}) => {
    B.beginItem(id, { name: id, room: 'living', category: 'furniture', movable: true, ...meta });
    nav.beginRecord();
    B.add(boxGeo(x - 0.25, 0, z - 0.25, x + 0.25, 0.5, z + 0.25), mat);
    nav.blockRect(x - 0.25, z - 0.25, x + 0.25, z + 0.25);
    B.endItem(nav.endRecord());
  };
  item('chair', 2, 2); item('table', 6, 2); item('wallart', 3, 4.7, { movable: false, category: 'decor' });
  B.flush();
  return { scene, nav, B };
}

test('Batcher: items become pivoted groups; wall faces become vertex ranges', () => {
  const { scene, B } = build();
  const chair = B.items.get('chair');
  assert.ok(chair.group.parent === scene);
  assert.deepEqual([chair.group.position.x, chair.group.position.y, chair.group.position.z].map((n) => +n.toFixed(3)), [2, 0, 2]);
  assert.ok(chair.group.children.every((m) => m.userData.itemId === 'chair'));
  assert.equal(B.faces.size, 2);
  for (const ranges of B.faces.values()) assert.ok(ranges.every((r) => r.count > 0 && r.count % 3 === 0));
});

test('WallSystem: painting one face leaves every other vertex untouched', () => {
  const { scene, B } = build();
  const walls = new WallSystem({ scene, faceDefs: B.faceDefs, faceRanges: B.faces });
  const read = (id) => { const { mesh, start } = walls.get(id).ranges[0]; const a = mesh.geometry.attributes.color; return [a.getX(start), a.getY(start), a.getZ(start)]; };
  assert.deepEqual(read('wA'), [1, 1, 1]);
  walls.paint('wA', '#b8694c');
  assert.notDeepEqual(read('wA'), [1, 1, 1]);
  assert.deepEqual(read('wB'), [1, 1, 1], 'the other side of the same wall is unchanged');
  // every vertex outside wA's ranges is still white
  const mesh = walls.get('wA').ranges[0].mesh, a = mesh.geometry.attributes.color;
  const inA = new Set(); for (const r of walls.get('wA').ranges) for (let i = r.start; i < r.start + r.count; i++) inA.add(i);
  for (let i = 0; i < a.count; i++) if (!inA.has(i)) assert.equal(a.getX(i), 1);
  walls.paint('wA', null);
  assert.deepEqual(read('wA'), [1, 1, 1], 'restore returns the original tint');
  // picking: every triangle of the painted face maps back to it
  const { start } = walls.get('wB').ranges[0];
  assert.equal(walls.faceAt(walls.get('wB').ranges[0].mesh, start / 3), 'wB');
});

test('FurnitureSystem: grounded, collision-safe, reversible', () => {
  const { scene, nav, B } = build();
  const F = new FurnitureSystem({ scene, items: B.items, nav });
  assert.ok(!F.select('wallart'), 'wall-mounted decor is not movable');
  assert.ok(F.select('chair'));
  F.beginDrag('chair');
  assert.ok(F.dragTo(3, 3)); assert.equal(F.endDrag(true), true);
  assert.equal(F.get('chair').group.position.y, 0, 'stays on the floor');
  F.beginDrag('chair'); assert.ok(!F.dragTo(6, 2), 'onto the table'); assert.equal(F.endDrag(true), false);
  assert.deepEqual([F.get('chair').cur.x, F.get('chair').cur.z], [3, 3], 'invalid drop returns to the last valid spot');
  F.beginDrag('chair'); assert.ok(!F.dragTo(3, 6.5), 'across the wall'); F.endDrag(true);
  assert.deepEqual([F.get('chair').cur.x, F.get('chair').cur.z], [3, 3]);
  F.beginDrag('chair'); assert.ok(F.dragTo(4.5, 4.5) && F.dragTo(4.5, 5.5), 'through the open doorway in small steps'); F.endDrag(true);
  assert.ok(F.rotateBy(Math.PI / 12)); assert.ok(Math.abs(F.get('chair').cur.ry - Math.PI / 12) < 1e-9);
  F.cancel(); assert.equal(F.get('chair').cur.ry, 0, 'cancel returns to the state at selection time');
  F.resetItem('chair'); assert.deepEqual([F.get('chair').cur.x, F.get('chair').cur.z], [2, 2]);
  // snapping
  F.snap = true; F.beginDrag('chair'); F.dragTo(3.13, 3.07); F.endDrag(true);
  assert.deepEqual([F.get('chair').cur.x, F.get('chair').cur.z], [3.25, 3]);
  // empty / restore keeps positions
  F.snap = false;
  assert.equal(F.empty('all'), 3);
  assert.ok(F.items.get('chair').hidden && nav.free(3.25, 3));
  assert.equal(F.restoreHidden(), 3);
  assert.deepEqual([F.get('chair').cur.x, F.get('chair').cur.z], [3.25, 3], 'restored where the visitor left it');
  assert.ok(!nav.free(3.25, 3), 'collision is back');
  F.resetAll();
  assert.ok(!F.isModified());
  assert.deepEqual([F.get('chair').cur.x, F.get('chair').cur.z], [2, 2]);
});

test('Customiser schema: four sections, five environments, dialogs, no walls without a target', () => {
  const { scene, nav, B } = build();
  const walls = new WallSystem({ scene, faceDefs: B.faceDefs, faceRanges: B.faces });
  const F = new FurnitureSystem({ scene, items: B.items, nav });
  const modes = []; const lighting = { setMode: (m) => modes.push(m) };
  const mem = new Map();
  const C = new Customiser({
    camera: new THREE.PerspectiveCamera(), world: {}, lighting, walls, furniture: F,
    getRoom: () => 'living', getHead: (v) => v.set(2, 1.65, 2),
    storage: { get: (k) => mem.get(k) ?? null, set: (k, v) => mem.set(k, v), remove: (k) => mem.delete(k) },
  });
  C.persist = false;
  C.open({ wallId: null });
  let s = C.getSchema();
  assert.deepEqual(s.tabs.map((t) => t.label), ['Wall', 'Light', 'Furniture', 'Room']);
  assert.equal(s.subtitle, 'No wall selected');
  assert.ok(!s.body.some((w) => w.t === 'swatches'), 'no colour controls without a wall');
  C.close(); C.open({ wallId: 'wA' });
  s = C.getSchema();
  assert.equal(s.subtitle, 'Test wA');
  assert.ok(s.body.some((w) => w.t === 'swatches') && s.body.some((w) => w.t === 'color'));
  assert.deepEqual(s.body.find((w) => w.t === 'buttons').items.map((b) => b.label), ['Apply to all walls', 'Restore original']);
  C.setTab('environment'); s = C.getSchema();
  const presets = s.body.find((w) => w.t === 'presets');
  assert.deepEqual(presets.items.map((p) => p.name), ['Bright Daylight', 'Warm Golden Hour', 'Overcast Soft Light', 'Evening Interior', 'Night Interior']);
  assert.equal(ENVIRONMENTS.length, 5); presets.onPick('night'); assert.deepEqual(modes, ['night']);
  C.setTab('room'); C.askEmpty('living'); s = C.getSchema();
  assert.equal(s.body.length, 1); assert.equal(s.body[0].t, 'dialog'); assert.deepEqual(s.body[0].buttons.map((b) => b.label), ['Empty room', 'Cancel']);
  C.cancelDialog(); assert.equal(F.countHidden(), 0, 'cancel changes nothing');
  C.askEmpty('living'); C.confirmDialog(); assert.equal(F.countHidden(), 3);
  C.restoreFurniture(); assert.equal(F.countHidden(), 0);
  // painting through the controller keeps other walls untouched
  C.setTab('walls'); C.paintSelected('#336699'); assert.equal(walls.get('wA').hex, '#336699'); assert.equal(walls.get('wB').hex, null);
  C.resetRoom(); assert.equal(walls.get('wA').hex, null); assert.equal(C.environment, 'sunset');
  // activation cooldown prevents double triggers
  assert.ok(C.cooldown(1000)); assert.ok(!C.cooldown(1100)); assert.ok(C.cooldown(1500));
});
