import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Batcher } from '../../world/util.js';
import { NavGrid } from '../../nav/grid.js';
import { Interactions } from '../../world/interactive.js';
import { applyBoxProjection } from '../../materials/boxproject.js';
import { roomAt, ROOMS, compassOf, STEPS, Pack } from './data.js';
import { ZONES, ROOM_ZONE } from './zones.js';
import { buildLights } from './lights.js';
import { windMaterial, WIND } from '../../world/wind.js';
import { buildOcean } from './ocean.js';
import { furnish } from './furnish/index.js';
import { extraMaterials } from './furnish/assets.js';
import { Surfaces, defineSurfaces } from './surfaces.js';
import { blockAsset } from './footprint.js';

/*
 * Assembles the apartment from the packed plan: architecture (walls with paintable faces, floors,
 * ceilings, joinery), fixed furniture, individually movable furniture (with the decor standing on
 * it), hinged and sliding doors, curtains that move in the breeze, switchable lighting, and the
 * ocean beyond the terrace. Geometry is placed exactly as the plan places it; nothing is invented.
 */

const zoneOf = (x, y, z) => {
  const r = roomAt(x, z);
  return r ? ROOM_ZONE[r] : 'outdoor';
};

// Built-ins and fixtures: they stay put, but they do block walking.
const BLOCKERS = /^(Terrace_Parapet|Terrace_Post)/;
// replaced by generated cloth, doors we animate ourselves, or glass we merge
// per-placement material swaps (the plan's cane panel is the woven grasscloth on the moodboard)
const OVERRIDE = { Panel_Cane_Living_West: { L_Cane: 'X_Grasscloth' } };
// bathroom architecture takes dedicated, re-finishable surfaces
const BATH_SURFACE = { L_MarbleScallop: 'bathFloor', L_StoneBeige: 'bathWalls', L_MarbleTerracotta: 'showerWall' };
const REPLACED = /^(Door_.*_Leaf|DoorKnob_|DoorHinge_|Slider_2|Slider_3|Curtain_.*_(DrapeL|DrapeR|Sheer))/;

export async function buildApartmentWorld({ scene, M, lighting, renderer, pack, onProgress = () => {} }) {
  const J = pack.json;
  const ctx = {
    scene, M, lighting, pack,
    batch: new Batcher(scene, zoneOf),
    nav: new NavGrid(-1.2, -9.8, 15.2, 5.4, 0.1),
    glass: [], animated: [], mirrors: [], roomMats: new Map(), curtains: [], viewer: null,
  };
  ctx.interact = new Interactions(ctx);
  extraMaterials(M);
  ctx.surfaces = new Surfaces(M);
  ctx.surf = defineSurfaces(ctx.surfaces);
  ctx.surfaces.batch = ctx.batch;
  const B = ctx.batch, nav = ctx.nav;

  ctx.roomMat = (room, name) => {
    const key = `${room}:${name}`;
    if (!ctx.roomMats.has(key)) {
      const m = M.get(name).clone();
      m.userData.noZone = true;
      ctx.roomMats.set(key, m);
      lighting.addEmissive(room, m, m.userData.emit ?? 1);
    }
    return ctx.roomMats.get(key);
  };
  /** Material for a part at world (x, z): lights get a per-room clone so each room switches on its own. */
  const matAt = (name, x, z) => {
    const base = M.get(name);
    if (!base.userData.emissive) return base;
    return ctx.roomMat(roomAt(x, z) || 'terrace', name);
  };

  // ---------------------------------------------------------------- nav grid
  const inSteps = (x, z) => x >= STEPS[0] && x <= STEPS[2] && -z >= STEPS[1] && -z <= STEPS[3];
  for (let j = 0; j < nav.h; j++) for (let i = 0; i < nav.w; i++) {
    const x = nav.cx(i), z = nav.cz(j);
    if (roomAt(x, z) || inSteps(x, z)) nav.walk[j * nav.w + i] = 1;
  }
  const doorsPlan = J.doors.filter((d) => d.type === 'hinged');
  // doorway openings are part of the plan's walkable floor
  const openings = [];
  for (const w of J.plan.walls) {
    const horiz = Math.abs(w.a[1] - w.b[1]) < 1e-6;
    const dir = horiz ? Math.sign(w.b[0] - w.a[0]) : Math.sign(w.b[1] - w.a[1]);
    const len = Math.abs(horiz ? w.b[0] - w.a[0] : w.b[1] - w.a[1]);
    const cuts = [];
    for (const o of w.ops) {
      const door = o.sill < 0.2 && o.head >= 2.0;
      const slider = o.sill < 0.2 && o.head > 2.5;
      const a = o.c - o.w / 2, b = o.c + o.w / 2;
      if (door && !slider) cuts.push([a, b]);
      // only the central 2.42 m of the slider is a door; the panels either side are fixed glass
      if (slider) cuts.push([o.c - 1.21, o.c + 1.21]);
    }
    // wall footprint in web coordinates, minus the openings people walk through
    const half = w.t / 2 + 0.02;
    const segs = [];
    let cursor = 0;
    cuts.sort((p, q) => p[0] - q[0]);
    for (const [a, b] of cuts) { if (a > cursor) segs.push([cursor, a]); cursor = Math.max(cursor, b); }
    if (cursor < len) segs.push([cursor, len]);
    for (const [a, b] of segs) {
      const p0 = horiz ? w.a[0] + dir * a : w.a[0], q0 = horiz ? w.a[1] : w.a[1] + dir * a;
      const p1 = horiz ? w.a[0] + dir * b : w.a[0], q1 = horiz ? w.a[1] : w.a[1] + dir * b;
      if (horiz) nav.wallRect(Math.min(p0, p1), -(q0 + half), Math.max(p0, p1), -(q0 - half));
      else nav.wallRect(p0 - half, -Math.max(q0, q1), p0 + half, -Math.min(q0, q1));
    }
    for (const [a, b] of cuts) {
      const p0 = horiz ? w.a[0] + dir * a : w.a[0], q0 = horiz ? w.a[1] : w.a[1] + dir * a;
      const p1 = horiz ? w.a[0] + dir * b : w.a[0], q1 = horiz ? w.a[1] : w.a[1] + dir * b;
      openings.push(horiz
        ? [Math.min(p0, p1), -(q0 + half), Math.max(p0, p1), -(q0 - half)]
        : [p0 - half, -Math.max(q0, q1), p0 + half, -Math.min(q0, q1)]);
    }
  }
  for (const r of openings) nav.allowRect(...r);
  void doorsPlan;

  onProgress(0.1, 'Placing walls and floors');
  await tick();

  // ---------------------------------------------------------- architecture
  // The plan's furniture, decor and fixtures are not used: the apartment starts as an empty shell and is
  // furnished by ./furnish. Only architecture, curtains and recessed downlights are taken from the plan.
  const keep = (p) => /^Architecture\//.test(p.folder) || p.folder === 'Interior/Curtains' || /^Downlight/.test(p.label);
  const byLabel = new Map(J.placements.map((p) => [p.label, p]));
  const mat4 = (p) => Pack.placement(p.loc, p.yaw);

  const paintables = new Set(['L_Plaster', 'D_Plaster', 'L_PaintTaupe', 'L_Terracotta', 'L_Sage']);
  const wallPaintMat = new Map();
  const paintMat = (name) => {
    if (!wallPaintMat.has(name)) {
      if (name === 'L_Plaster') wallPaintMat.set(name, M.wallPaint);
      else { const m = M.get(name).clone(); m.vertexColors = true; wallPaintMat.set(name, m); }
    }
    return wallPaintMat.get(name);
  };

  for (const p of J.placements) {
    if (!keep(p) || REPLACED.test(p.label)) continue;
    const asset = p.asset;
    const mt = mat4(p);
    const isWall = /^SM_Wall_/.test(asset);
    const parts = pack.geometries(asset, mt);
    const blocker = BLOCKERS.test(p.label);
    for (const { material, geo } of parts) {
      geo.computeBoundingBox();
      const c = geo.boundingBox.getCenter(new THREE.Vector3());
      if (/^(D_Glass|L_Glass)$/.test(material)) { stripToPosNor(geo); ctx.glass.push(geo); continue; }
      if (isWall && paintables.has(material)) { addWallFaces(ctx, asset, material, geo, paintMat(material)); continue; }
      const castShadow = !/Rug|Floor_ShowerPad/.test(asset);
      const own = /Bath/.test(p.label) && BATH_SURFACE[material];
      B.add(geo, own ? ctx.surf[own] : matAt(OVERRIDE[p.label]?.[material] || material, c.x, c.z), { keepUV: true, cast: castShadow });
    }
    if (blocker) blockAsset(nav, pack, asset, mt);
  }

  onProgress(0.3, 'Furnishing');
  await tick();

  // --------------------------------------------------------------- furnishing
  furnish(ctx, { matAt, byLabel, mat4 });

  onProgress(0.5, 'Hanging doors and curtains');
  await tick();
  buildDoors(ctx, pack, J, byLabel);
  buildCurtains(ctx, pack, J, M);

  // ------------------------------------------------------------- lighting
  buildLights(ctx, J.lights);
  buildSwitches(ctx);

  // ----------------------------------------------------------- exterior
  const outdoor = buildOcean(ctx);
  ctx.animated.push(...outdoor.animated);
  ctx.ocean = outdoor;

  // ----------------------------------------------------------------- finish
  const glassGeo = ctx.glass.length ? mergeGeometries(ctx.glass.map((g) => (g.index ? g.toNonIndexed() : g))) : null;
  if (glassGeo) {
    const glass = new THREE.Mesh(glassGeo, M.glass);
    glass.renderOrder = 5;
    glass.castShadow = false;
    scene.add(glass);
    ctx.glassMesh = glass;
  } else ctx.glassMesh = new THREE.Object3D();

  ctx.staticMeshes = ctx.batch.flush();
  ctx.zoneMaterials = ctx.batch.zoneMaterials;
  ctx.items = ctx.batch.items;
  ctx.faceDefs = ctx.batch.faceDefs;
  ctx.faceRanges = ctx.batch.faces;
  nav.rebuildDynamic?.();

  // parallax-corrected reflections per zone
  const all = [...new Set([...M.byName.values(), M.wallPaint, ...wallPaintMat.values(), ...ctx.roomMats.values(), ...ctx.surfaces.list().map((s) => s.material)])].filter((m) => m.isMeshStandardMaterial);
  for (const [zone, cfg] of Object.entries(ZONES)) {
    if (!cfg.box) continue;
    const mats = zone === 'main' ? all.filter((m) => !m.userData.noZone) : [...(ctx.zoneMaterials.get(zone)?.values() || [])];
    for (const m of mats) if (!m.userData.noZone) applyBoxProjection(m, cfg.box[0], cfg.box[1], cfg.pos);
  }
  // what the blueprint view outlines (the finished rooms) and what it merely hides (sky, sea)
  ctx.blueprintRoots = () => [
    ...ctx.staticMeshes, ...[...ctx.items.values()].map((i) => i.group), ctx.glassMesh,
    ...ctx.interact.items.map((i) => i.object),
  ];
  ctx.blueprintHide = () => [lighting.sky, ctx.ocean.group];
  onProgress(1, 'Ready');
  return ctx;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function stripToPosNor(g) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
}

/**
 * Split a wall's plaster into its big faces (one per side) so each can be painted on its own.
 * The faces are registered with the Batcher; reveals and edges stay unpainted.
 */
function addWallFaces(ctx, asset, materialName, geo, material) {
  const B = ctx.batch;
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const buckets = new Map();
  const tri = new THREE.Triangle(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let t = 0; t < pos.count / 3; t++) {
    a.fromBufferAttribute(pos, t * 3); b.fromBufferAttribute(pos, t * 3 + 1); c.fromBufferAttribute(pos, t * 3 + 2);
    tri.set(a, b, c); tri.getNormal(n);
    let key = 'rest';
    if (Math.abs(n.x) > 0.95) key = n.x > 0 ? 'xp' : 'xn';
    else if (Math.abs(n.z) > 0.95) key = n.z > 0 ? 'zp' : 'zn';
    if (!buckets.has(key)) buckets.set(key, { tris: [], area: 0, centroid: new THREE.Vector3(), n: n.clone() });
    const bk = buckets.get(key);
    bk.tris.push(t);
    const area = tri.getArea();
    bk.area += area;
    bk.centroid.add(tri.getMidpoint(new THREE.Vector3()).multiplyScalar(area));
  }
  for (const [key, bk] of buckets) {
    const out = new THREE.BufferGeometry();
    const P = new Float32Array(bk.tris.length * 9), N = new Float32Array(bk.tris.length * 9), U = new Float32Array(bk.tris.length * 6);
    bk.tris.forEach((t, i) => {
      for (let v = 0; v < 3; v++) {
        const s = t * 3 + v;
        P.set([pos.getX(s), pos.getY(s), pos.getZ(s)], i * 9 + v * 3);
        N.set([nor.getX(s), nor.getY(s), nor.getZ(s)], i * 9 + v * 3);
        U.set([uv.getX(s), uv.getY(s)], i * 6 + v * 2);
      }
    });
    out.setAttribute('position', new THREE.BufferAttribute(P, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    // end caps and jambs are not walls a person would repaint
    if (key === 'rest' || bk.area < 1.2) { B.add(out, material, { keepUV: true }); continue; }
    const centroid = bk.centroid.multiplyScalar(1 / bk.area);
    const nx = key === 'xp' ? 1 : key === 'xn' ? -1 : 0, nz = key === 'zp' ? 1 : key === 'zn' ? -1 : 0;
    // the room on the face's side, sampled just in front of its largest part
    const room = roomAt(centroid.x + nx * 0.35, centroid.z + nz * 0.35);
    const id = `${asset.replace(/^SM_Wall_|_001$/g, '')}:${key}`;
    B.defineFace(id, {
      id, room, wall: asset,
      label: `${room ? ROOMS[room].name : 'Exterior'} · ${compassOf(nx, nz)} wall`,
      normal: [nx, nz],
    });
    B.add(out, material, { keepUV: true, face: id });
  }
  geo.dispose();
}

// ----------------------------------------------------------------------- doors
function buildDoors(ctx, pack, J, byLabel) {
  const { M, scene, nav, interact: I } = ctx;
  let navId = 0;
  for (const d of J.doors) {
    if (d.type === 'hinged') {
      const group = new THREE.Group();
      const hingeP = new THREE.Vector3(d.hinge[0], 0, -d.hinge[1]);
      group.position.copy(hingeP);
      group.rotation.y = THREE.MathUtils.degToRad(d.yaw);
      for (const asset of [d.leaf, d.knob, d.hinges]) {
        for (const { material, geo } of pack.geometries(asset, null)) {
          const m = new THREE.Mesh(geo, M.get(material));
          m.castShadow = true; m.receiveShadow = true;
          group.add(m);
        }
      }
      scene.add(group);
      // doorway rectangle: where the closed leaf stands
      const box = new THREE.Box3();
      const a = pack.meshes[d.leaf];
      const place = new THREE.Matrix4().compose(hingeP, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), group.rotation.y), new THREE.Vector3(1, 1, 1));
      for (const x of [a.min[0], a.max[0]]) for (const y of [a.min[1], a.max[1]]) for (const z of [a.min[2], a.max[2]]) box.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(place));
      const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
      const hx = Math.max((box.max.x - box.min.x) / 2, 0.13), hz = Math.max((box.max.z - box.min.z) / 2, 0.13);
      I.addHinged({
        id: d.label, group, hinge: hingeP, navId, navRect: [cx - hx, cz - hz, cx + hx, cz + hz],
        label: d.label.replace(/^Door_/, '').toLowerCase() + ' door',
      });
      navId += 2;
    } else if (d.type === 'sliding') {
      const panels = d.panels.map((p) => {
        const group = new THREE.Group();
        group.position.set(p.loc[0], p.loc[2], -p.loc[1]);
        group.rotation.y = THREE.MathUtils.degToRad(p.yaw);
        for (const { material, geo } of pack.geometries(d.asset, null)) {
          const m = new THREE.Mesh(geo, material === 'D_Glass' ? M.glass : M.get(material));
          if (material === 'D_Glass') m.renderOrder = 4; else { m.castShadow = true; m.receiveShadow = true; }
          group.add(m);
        }
        scene.add(group);
        // the plan slides along the wall's plan-y axis: panel yaw 90 puts local +x along plan +y (web -z)
        const axis = new THREE.Vector3(0, 0, -1);
        return { group, axis, slide: p.slide };
      });
      const sx = d.centre[0];
      I.addSliding({ id: 'slider', panels, navId, navRect: [sx - 0.24, -d.centre[1] - 1.21, sx + 0.24, -d.centre[1] + 1.21], label: 'terrace door' });
      navId += 2;
    }
  }
  nav.doorIsLeaf = ((prev) => (i) => (i === navId - 2 ? false : prev(i)))(nav.doorIsLeaf || (() => true));
}

// -------------------------------------------------------------------- curtains
const CURTAIN_SETS = [
  { name: 'Curtain_Living_North', inward: [0, 1], sheer: true },
  { name: 'Curtain_Living_EastSliding', inward: [-1, 0], sheer: true },
  { name: 'Curtain_Study_North', inward: [0, 1], sheer: false },
  { name: 'Curtain_Bedroom_North', inward: [0, 1], sheer: false },
  { name: 'Curtain_Bath_West', inward: [1, 0], sheer: true },
];

function buildCurtains(ctx, pack, J, M) {
  const I = ctx.interact;
  const bounds = (asset) => { const a = pack.meshes[asset]; return a ? { min: new THREE.Vector3(...a.min), max: new THREE.Vector3(...a.max) } : null; };
  const drapeBase = M.get('D_Linen').clone();
  drapeBase.side = THREE.DoubleSide;
  const sheerBase = M.get('D_Sheer');
  for (const set of CURTAIN_SETS) {
    const rail = bounds(`SM_${set.name}_Rail`), L = bounds(`SM_${set.name}_DrapeL`), R = bounds(`SM_${set.name}_DrapeR`);
    if (!rail || !L || !R) continue;
    const alongX = rail.max.x - rail.min.x > rail.max.z - rail.min.z;
    const axis = alongX ? 'x' : 'z';
    const lo = (alongX ? rail.min.x : rail.min.z) + 0.04, hi = (alongX ? rail.max.x : rail.max.z) - 0.04;
    const centreOf = (b) => (alongX ? (b.min.z + b.max.z) / 2 : (b.min.x + b.max.x) / 2);
    const y0 = Math.min(L.min.y, R.min.y), y1 = Math.min(L.max.y, R.max.y);
    const stack = Math.max(alongX ? L.max.x - L.min.x : L.max.z - L.min.z, 0.35);
    const drapeMat = windMaterial(drapeBase, { dir: set.inward, amp: 0.05, top: y1, bottom: y0 });
    const drapes = I.curtain({ axis, at: centreOf(L), from: lo, to: hi, y0, y1: y1 - 0.02, material: drapeMat, gather: 'both', open: 1, label: 'curtains', stack, pleat: 0.24 });
    ctx.curtains.push(drapes);
    if (set.sheer) {
      const S = bounds(`SM_${set.name}_Sheer`);
      if (S) {
        const sheerMat = windMaterial(sheerBase, { dir: set.inward, amp: 0.16, top: S.max.y, bottom: S.min.y });
        const sh = I.curtain({
          axis, at: centreOf(S), from: alongX ? S.min.x : S.min.z, to: alongX ? S.max.x : S.max.z, y0: S.min.y, y1: S.max.y,
          material: sheerMat, gather: 'both', open: 0, label: 'sheers', stack: 0.4, pleat: 0.2,
        });
        sh.panels.forEach((p) => { p.mesh.castShadow = false; });
        ctx.curtains.push(sh);
      }
    }
    // keep the rail itself as static joinery
  }
  ctx.animated.push((dt, t) => { WIND.time.value = t; });
}

// -------------------------------------------------------------------- switches
function buildSwitches(ctx) {
  const I = ctx.interact;
  // plate position (x, z) on the wall, facing rotation about y, room it controls
  const plates = [
    ['entry', 4.1, -0.262, Math.PI], ['kitchen', 10.4, -0.262, Math.PI], ['dining', 4.634, -4.6, Math.PI / 2],
    ['living', 10.45, -8.338, 0], ['bedroom', 2.9, -4.208, Math.PI], ['study', 6.85, -5.482, Math.PI],
    ['bath', 2.468, -3.2, -Math.PI / 2], ['terrace', 10.812, -0.8, Math.PI / 2],
  ];
  for (const [room, x, z, ry] of plates) I.switchPlate(room, x, 1.1, z, ry);
}

export { ZONES, ROOM_ZONE };
