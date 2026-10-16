import * as THREE from 'three';

/*
 * The apartment's source data: the packed meshes (public/apartment, produced by
 * tools/build-apartment-pack.mjs) and the floor plan, converted to the web scene's frame.
 *
 * scene.json uses x east, y north, z up. The web scene uses x east, y up, z south, so a plan point
 * (x, y) becomes (x, -y). Everything below is written in plan coordinates (metres) and converted
 * by the helpers at the bottom.
 */

export const H = { eye: 1.65, ceiling: 3.2 };

/* Rectangles are [x0, y0, x1, y1] in plan coordinates (y north). */
const R = {
  bedroom: [0.25, 4.2, 4.475, 8.35],
  study: [4.625, 5.475, 7.125, 8.35],
  bath: [0.25, 1.175, 2.475, 4.05],
  terrace: [10.8, 0.2, 13.85, 6.45],
  // the open-plan space is one volume; these cut it into the rooms people name
  entry: [0.25, 0.25, 4.6, 4.05],
  kitchen: [4.6, 0.25, 10.55, 2.6],
  dining: [4.6, 2.6, 10.55, 4.9],
  living: [4.6, 4.9, 10.55, 8.35],
};
// The open-plan living polygon from the plan (everything that is not a closed room).
const OPEN_PLAN = [[0.25, 0.25], [10.55, 0.25], [10.55, 8.35], [7.275, 8.35], [7.275, 5.325], [4.625, 5.325], [4.625, 4.05], [2.625, 4.05], [2.625, 1.025], [0.25, 1.025]];
// The landing and steps outside the front door are walkable but are not a room.
const STEPS = [2.35, -4.6, 3.8, 0.0];

const inRect = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
function inPoly(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export const ROOMS = {
  living: { name: 'Living Room', rect: R.living },
  dining: { name: 'Dining', rect: R.dining },
  kitchen: { name: 'Kitchen', rect: R.kitchen },
  entry: { name: 'Entrance', rect: R.entry },
  bedroom: { name: 'Bedroom', rect: R.bedroom },
  study: { name: 'Study', rect: R.study },
  bath: { name: 'Bathroom', rect: R.bath },
  terrace: { name: 'Terrace', rect: R.terrace, outdoor: true },
};

/** Room under a point of the web scene (x east, z south), or null outdoors / in a wall. */
export function roomAt(x, z) {
  const y = -z;
  for (const k of ['bedroom', 'study', 'bath', 'terrace']) if (inRect(R[k], x, y)) return k;
  if (inPoly(OPEN_PLAN, x, y)) {
    for (const k of ['entry', 'kitchen', 'dining', 'living']) if (inRect(R[k], x, y)) return k;
  }
  return null;
}

/** Floor that can be walked on (plan rects, plan coordinates). */
export const WALKABLE = [
  ...['bedroom', 'study', 'bath'].map((k) => R[k]),
  R.terrace, STEPS,
];
export { OPEN_PLAN, STEPS };

/** (plan x, plan y, height) -> web scene vector. */
export const toWorld = (x, y, h = 0) => new THREE.Vector3(x, h, -y);
export const worldXZ = (x, y) => [x, -y];

/**
 * Plan wall face normal -> compass name of the wall as seen from inside the room.
 * `nx, nz` is the face normal in web coordinates (pointing into the room); the wall lies in the
 * opposite direction. North is -z, as drawn on the blueprint.
 */
export function compassOf(nx, nz) {
  if (Math.abs(nx) > Math.abs(nz)) return nx > 0 ? 'West' : 'East';
  return nz > 0 ? 'North' : 'South';
}

export async function loadPack(base, name = 'pack') {
  const [json, bin] = await Promise.all([
    fetch(`${base}${name}.json`).then((r) => { if (!r.ok) throw new Error('apartment pack.json missing'); return r.json(); }),
    fetch(`${base}${name}.bin`).then((r) => { if (!r.ok) throw new Error('apartment pack.bin missing'); return r.arrayBuffer(); }),
  ]);
  return new Pack(json, bin);
}

export class Pack {
  constructor(json, bin) {
    this.json = json;
    this.bin = bin;
    this.f32 = new Float32Array(bin);
    this.i8 = new Int8Array(bin);
    this.stride = json.vertexStride;
    this._cache = new Map();
  }
  get meshes() { return this.json.meshes; }
  has(name) { return !!this.json.meshes[name]; }

  /** Decoded geometry of one material part of an asset (cached; clone before transforming). */
  part(name, partIndex) {
    const key = `${name}#${partIndex}`;
    if (this._cache.has(key)) return this._cache.get(key);
    const p = this.json.meshes[name].parts[partIndex];
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(p.n * 3), nor = new Float32Array(p.n * 3), uv = new Float32Array(p.n * 2);
    const w = this.stride / 4;
    for (let i = 0; i < p.n; i++) {
      const o = (p.v0 + i) * this.stride;
      const f = (p.v0 + i) * w;
      pos[i * 3] = this.f32[f]; pos[i * 3 + 1] = this.f32[f + 1]; pos[i * 3 + 2] = this.f32[f + 2];
      nor[i * 3] = this.i8[o + 12] / 127; nor[i * 3 + 1] = this.i8[o + 13] / 127; nor[i * 3 + 2] = this.i8[o + 14] / 127;
      uv[i * 2] = this.f32[f + 4]; uv[i * 2 + 1] = this.f32[f + 5];
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this._cache.set(key, g);
    return g;
  }

  /** Every part of an asset, transformed by `matrix`. [{ material, geo }] */
  geometries(name, matrix) {
    const a = this.json.meshes[name];
    if (!a) return [];
    return a.parts.map((p, i) => {
      const geo = this.part(name, i).clone();
      if (matrix) geo.applyMatrix4(matrix);
      return { material: p.m, geo };
    });
  }

  /** The matrix that puts an asset where scene.json placed it. */
  static placement(loc, yawDeg) {
    return new THREE.Matrix4().compose(
      new THREE.Vector3(loc[0], loc[2], -loc[1]),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(yawDeg || 0)),
      new THREE.Vector3(1, 1, 1),
    );
  }
}
