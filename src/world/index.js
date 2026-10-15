import * as THREE from 'three';
import { Batcher, CLONES } from './util.js';
import { NavGrid } from '../nav/grid.js';
import { buildArchitecture } from './architecture.js';
import { buildLiving } from './living.js';
import { buildDining, buildKitchen } from './dining_kitchen.js';
import { buildHall, buildMaster, buildBedroom, buildMasterBath, buildGuestBath } from './private.js';
import { buildExterior } from './exterior.js';
import { Interactions } from './interactive.js';
import { H, roomAt } from './layout.js';
import { applyBoxProjection } from '../materials/boxproject.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const ZONES = {
  main: { pos: [4.8, 1.8, 5.5], size: 256, rooms: ['living', 'foyer', 'dining', 'fire'], box: [[0, 0, -9], [12, 7.4, 12]] },
  kitchen: { pos: [15.5, 1.6, -2.4], size: 128, rooms: ['kitchen'], box: [[12, 0, -9], [20, 3.4, 0]] },
  hall: { pos: [20.5, 1.6, 1.2], size: 128, rooms: ['hall'], box: [[12, 0, 0], [30, 3.0, 2.4]] },
  master: { pos: [17.0, 1.6, 7.0], size: 128, rooms: ['master'], box: [[12, 0, 2.4], [22, 3.4, 12]] },
  masterBath: { pos: [26.0, 1.6, 6.5], size: 128, rooms: ['masterBath'], box: [[22, 0, 2.4], [30, 3.4, 12]] },
  bedroom: { pos: [23.0, 1.6, -3.0], size: 128, rooms: ['bedroom'], box: [[20, 0, -9], [26, 3.4, 0]] },
  bath: { pos: [28.0, 1.6, -3.5], size: 128, rooms: ['bath'], box: [[26, 0, -9], [30, 3.4, 0]] },
  outdoor: { pos: [-3.0, 1.6, 2.0], size: 128, rooms: ['terrace'] },
};
const ROOM_ZONE = { living: 'main', foyer: 'main', dining: 'main', kitchen: 'kitchen', hall: 'hall', master: 'master', masterBath: 'masterBath', bedroom: 'bedroom', bath: 'bath', terrace: 'outdoor' };

function zoneOf(x, y, z) {
  if (x < -0.1) return 'outdoor';
  if (y > H.ceiling + 0.05 && x < 12.2) return 'main';
  const r = roomAt(x, z);
  if (!r) return x > 30.2 || z > 16.7 || z < -9.2 ? 'outdoor' : 'main';
  return ROOM_ZONE[r] || 'main';
}

/** Assemble the complete residence into the scene. */
export function buildWorld({ scene, M, lighting }) {
  const ctx = {
    scene, M, lighting,
    batch: new Batcher(scene, zoneOf),
    nav: new NavGrid(-9.5, -10.5, 31.5, 19.5, 0.1),
    glass: [],
    animated: [],
    mirrors: [],
    roomMats: new Map(),
  };
  ctx.interact = new Interactions(ctx);
  ctx.islandMat = M.darkMarble.clone();
  ctx.bronzeMirror = new THREE.MeshStandardMaterial({ color: 0x9c8a74, metalness: 1, roughness: 0.12 });

  /**
   * Build one individually movable / hideable piece of furniture or decor. Everything the
   * callback adds to the batch, and every collision shape it records, belongs to the piece.
   * meta: { name, room, category: 'furniture'|'decor', movable, flat?, finish? }
   */
  ctx.item = (id, meta, fn) => {
    ctx.batch.beginItem(id, meta);
    ctx.nav.beginRecord();
    try { fn(); } finally { ctx.batch.endItem(ctx.nav.endRecord()); }
  };

  /** Per-room clone of an emissive material so each room switches independently. */
  ctx.roomMat = (room, kind, intensity) => {
    const key = `${room}:${kind}`;
    if (!ctx.roomMats.has(key)) {
      const m = M[kind].clone();
      m.userData.noZone = true;
      ctx.roomMats.set(key, m);
      lighting.addEmissive(room, m, intensity);
    }
    return ctx.roomMats.get(key);
  };

  /** Recessed trimless downlights (emissive apertures). */
  ctx.downlights = (room, pts, y) => {
    const mat = ctx.roomMat(room, 'downlight', 18);
    for (const [x, z] of pts) {
      ctx.batch.add(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 24).translate(x, y - 0.004, z), mat, { cast: false });
      ctx.batch.add(new THREE.CylinderGeometry(0.06, 0.06, 0.006, 24).translate(x, y - 0.002, z), M.shadowGap, { cast: false });
    }
  };

  /** A real light source (spot) aimed straight down. */
  ctx.spot = (room, x, y, z, intensity, angle = 0.95) => {
    const l = new THREE.SpotLight(0xffd3a6, 0, 12, angle, 0.85, 2);
    l.position.set(x, y, z);
    l.target.position.set(x, 0, z);
    lighting.addLight(room, l, intensity);
    return l;
  };

  buildArchitecture(ctx);
  buildLiving(ctx);
  buildDining(ctx);
  buildKitchen(ctx);
  buildHall(ctx);
  buildMaster(ctx);
  buildBedroom(ctx);
  buildMasterBath(ctx);
  buildGuestBath(ctx);
  buildExterior(ctx);

  // living lights (spots from the high coffer)
  ctx.spot('living', 3.0, H.roof - 0.2, 6.6, 160, 0.5);
  ctx.spot('living', 6.4, H.roof - 0.2, 6.6, 160, 0.5);
  ctx.spot('living', 10.5, H.ceiling - 0.02, 7.0, 22);
  const up = new THREE.PointLight(0xffd7aa, 0, 10, 2);
  up.position.set(6, 6.2, -5.5);
  lighting.addLight('living', up, 14);

  // interactions
  const I = ctx.interact;
  I.buildDoors();
  ctx.curtains = [];
  ctx.curtains.push(I.curtain({ axis: 'z', at: 0.32, from: 0.25, to: 11.8, y0: 0.02, y1: H.roof - 0.06, material: M.sheer, gather: 'both', open: 1, label: 'sheers' }));
  ctx.curtains.push(I.curtain({ axis: 'z', at: 0.3, from: -8.8, to: -0.4, y0: 0.02, y1: H.ceiling - 0.02, material: M.sheer, gather: 'both', open: 1, label: 'sheers' }));
  ctx.curtains.push(I.curtain({ axis: 'x', at: 11.8, from: 13.5, to: 20.5, y0: 0.02, y1: H.ceiling - 0.02, material: M.sheer, gather: 'both', open: 1, label: 'sheers' }));
  ctx.curtains.push(I.curtain({ axis: 'x', at: -8.75, from: 21.5, to: 24.7, y0: 0.02, y1: H.ceiling - 0.02, material: M.blackout, gather: 'both', open: 1, label: 'curtains' }));
  // curtain tracks (recessed)
  ctx.batch.box(0.22, H.roof - 0.06, 0.2, 0.42, H.roof, 11.85, M.shadowGap, { cast: false });
  ctx.batch.box(0.2, H.ceiling - 0.02, -8.85, 0.42, H.ceiling, -0.35, M.shadowGap, { cast: false });
  ctx.batch.box(13.4, H.ceiling - 0.02, 11.7, 20.6, H.ceiling, 11.9, M.shadowGap, { cast: false });
  ctx.batch.box(21.4, H.ceiling - 0.02, -8.85, 24.8, H.ceiling, -8.65, M.shadowGap, { cast: false });

  I.switchPlate('living', 11.865, 1.1, 2.75, -Math.PI / 2);
  I.switchPlate('dining', 2.3, 1.1, -8.99, 0);
  I.switchPlate('kitchen', 12.75, 1.1, -0.105, Math.PI);
  I.switchPlate('hall', 12.45, 1.1, 2.315, Math.PI);
  I.switchPlate('master', 14.35, 1.1, 2.485, 0);
  I.switchPlate('masterBath', 22.085, 1.1, 4.35, Math.PI / 2);
  I.switchPlate('bedroom', 22.0, 1.1, -0.085, Math.PI);
  I.switchPlate('bath', 26.35, 1.1, -0.085, Math.PI);
  I.switchPlate('foyer', 8.495, 1.1, 15.9, -Math.PI / 2);
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.96, 1.2), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.position.set(16.3, 0.48, -4.45);
  scene.add(proxy);
  I.material([proxy], 'island');

  // glass: merged, non shadow casting, drawn after opaque
  const glassGeo = mergeGeometries(ctx.glass.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    return g;
  }));
  const glass = new THREE.Mesh(glassGeo, M.glass);
  glass.renderOrder = 5;
  glass.castShadow = false;
  scene.add(glass);
  ctx.glassMesh = glass;

  ctx.staticMeshes = ctx.batch.flush();
  ctx.zoneMaterials = ctx.batch.zoneMaterials;
  ctx.items = ctx.batch.items;
  ctx.faceDefs = ctx.batch.faceDefs;
  ctx.faceRanges = ctx.batch.faces;
  // clicking a sofa still cycles its upholstery, now on the individual sofa groups
  const boucle = new Set([M.boucle, ...(CLONES.get(M.boucle) || [])]);
  for (const it of ctx.items.values()) {
    if (it.meta.finish !== 'sofa') continue;
    I.material(it.group.children.filter((m) => boucle.has(m.material)), 'sofa');
  }
  // parallax-corrected reflections per zone
  for (const [zone, cfg] of Object.entries(ZONES)) {
    if (!cfg.box) continue;
    const mats = zone === 'main'
      ? Object.values(M).filter((m) => m && m.isMeshStandardMaterial)
      : [...(ctx.zoneMaterials.get(zone)?.values() || [])];
    for (const m of mats) if (!m.userData.noZone) applyBoxProjection(m, cfg.box[0], cfg.box[1], cfg.pos);
  }
  return ctx;
}
