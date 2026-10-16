import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { footprint } from '../footprint.js';
import { roomAt } from '../data.js';

/*
 * Small modelling kit for furniture. Everything is authored in a piece's own frame (origin on the floor at its
 * centre, +z = the way it faces, y up, metres) and placed with a position and a yaw.
 */

const UP = new THREE.Vector3(0, 1, 0);

/** Box with softly rounded edges, centred on the origin. */
export const rbox = (w, h, d, r = 0.012, seg = 3) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.max(0.0005, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)));

/** Move / turn a geometry in place (rotation order Y, X, Z). */
export function at(geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1)));
  return geo;
}

/** A rounded square-section bar from point a to point b (like a chair leg or rail). */
export function bar(a, b, w = 0.03, t = 0.03, r = 0.006) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = rbox(w, len, t, r, 2);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, vb.clone().sub(va).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}

/** Round bar (a cylinder) from a to b. */
export function rod(a, b, r = 0.012, seg = 16, r2 = r) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const g = new THREE.CylinderGeometry(r2, r, va.distanceTo(vb), seg, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, vb.clone().sub(va).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}

/** Surface of revolution: profile is [[radius, y], ...] from the bottom up. */
export const lathe = (profile, seg = 64) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);

/** Drum with rounded top and bottom edges. */
export function drum(r, h, edge = 0.012, seg = 96) {
  const p = [[0, 0], [r - edge, 0]];
  for (let i = 1; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; p.push([r - edge + Math.sin(a) * edge, edge - Math.cos(a) * edge]); }
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; p.push([r - edge + Math.cos(a) * edge, h - edge + Math.sin(a) * edge]); }
  p.push([r - edge, h], [0, h]);
  return lathe(p, seg);
}

/** Cylinder with real vertical flutes (rounded ribs) cut around its side. */
export function flutedColumn(r, h, flutes = 28, depth = 0.012, seg = 224) {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1, false);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    if (Math.hypot(x, z) < r * 0.9) continue;            // the caps stay round
    const a = Math.atan2(z, x);
    const k = 1 - depth * (0.5 - 0.5 * Math.cos(a * flutes)) / r;
    pos.setX(i, x * k); pos.setZ(i, z * k);
  }
  g.computeVertexNormals();
  g.translate(0, h / 2, 0);
  return g;
}

/** A rounded-rectangle outline in the XZ plane (as a THREE.Shape with y = -z). */
export function roundedRect(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  r = Math.min(r, w / 2, d / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Superellipse outline (n = 2 is an ellipse, larger n is squarer) - the shape of an oval table top. */
export function superellipse(rx, rz, n = 3, seg = 96) {
  const s = new THREE.Shape();
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * Math.PI * 2;
    const c = Math.cos(t), sn = Math.sin(t);
    const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * rx, z = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n) * rz;
    if (i === 0) s.moveTo(x, z); else s.lineTo(x, z);
  }
  return s;
}

/** Extrude an XZ outline up by `h` with a rounded edge, standing on y = 0. */
export function slab(shape, h, bevel = 0.006, bevelSeg = 4, curveSeg = 48) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, h - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: bevelSeg, curveSegments: curveSeg });
  g.rotateX(-Math.PI / 2);          // the shape's y becomes -z
  g.translate(0, bevel, 0);
  return g;
}

/** A soft, puffed cushion: a rounded box whose faces bulge outward. */
export function cushion(w, h, d, r = 0.04, puff = 0.35, seg = 8) {
  const g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2), y = pos.getY(i) / (h / 2), z = pos.getZ(i) / (d / 2);
    // bulge the broad faces; keep the rim tight
    const rim = 1 - Math.pow(Math.max(Math.abs(x), Math.abs(z)), 4);
    pos.setY(i, pos.getY(i) + Math.sign(y) * h * puff * 0.5 * Math.max(0, rim) * (Math.abs(y) > 0.6 ? 1 : 0.2));
  }
  g.computeVertexNormals();
  return g;
}

/**
 * One piece of furniture. Add geometry in the piece's own frame; `finish()` registers it as a movable item
 * (with collision from its actual shape) or as a fixed built-in that blocks walking.
 */
export class Piece {
  constructor(ctx, { id, name, x, z, yaw = 0, flat = false, fixed = false, room = null }) {
    this.ctx = ctx; this.id = id; this.name = name; this.flat = flat; this.fixed = fixed;
    this.x = x; this.z = z; this.yaw = yaw;
    this.room = room || roomAt(x, z) || 'terrace';
    this.m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(UP, yaw), new THREE.Vector3(1, 1, 1));
    this.parts = [];
  }
  /** Add a geometry (piece frame) with a material. opts: cast, receive, keepUV. */
  add(geo, material, opts = {}) {
    geo.applyMatrix4(this.m);
    this.parts.push({ geo, material, opts });
    return geo;
  }
  finish() {
    const { batch: B, nav } = this.ctx;
    const shapes = footprint(this.parts.filter((p) => !p.opts.noFootprint).map((p) => p.geo), this.flat);
    if (this.fixed) {
      for (const { geo, material, opts } of this.parts) B.add(geo, material, { cast: true, ...opts });
      for (const s of shapes) nav.blockRect(s.x - s.w / 2, s.z - s.d / 2, s.x + s.w / 2, s.z + s.d / 2);
      return;
    }
    B.beginItem(this.id, { name: this.name, room: this.room, category: 'furniture', movable: true, flat: this.flat });
    for (const { geo, material, opts } of this.parts) B.add(geo, material, { cast: !this.flat, ...opts });
    B.endItem(shapes);
  }
}
