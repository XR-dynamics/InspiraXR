import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Zone clones of a base material (see Batcher.zoneMaterial). */
export const CLONES = new WeakMap();

/** Box-project UVs in world metres, so textures keep true scale on every surface. */
export function projectUV(geo, opts = {}) {
  const pos = geo.attributes.position;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const rot = opts.rotate || 0;
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = -z; }
    else if (nx >= nz) { u = nor.getX(i) > 0 ? -z : z; v = y; }
    else { u = nor.getZ(i) > 0 ? x : -x; v = y; }
    uv[i * 2] = u * c - v * s;
    uv[i * 2 + 1] = u * s + v * c;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Geometry for an axis-aligned box defined by min/max corners (world space). */
export function boxGeo(x0, y0, z0, x1, y1, z1) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

export function roundedBox(w, h, d, r = 0.02, seg = 3) {
  const g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
  return g;
}

/**
 * Collects static geometry and merges it per material to keep draw calls low.
 */
export class Batcher {
  constructor(scene, zoneOf = null) {
    this.scene = scene;
    this.groups = new Map();
    this.zoneOf = zoneOf; // (x, y, z) => zone name, for per-zone environment probes
    this.zoneMaterials = new Map(); // zone -> Map(baseMaterial -> clone)
  }

  /** Clone of `material` dedicated to a probe zone (shares all textures). */
  zoneMaterial(material, zone) {
    if (!zone || zone === 'main' || material.userData.noZone) return material;
    if (!this.zoneMaterials.has(zone)) this.zoneMaterials.set(zone, new Map());
    const map = this.zoneMaterials.get(zone);
    if (!map.has(material)) {
      const c = material.clone();
      c.userData.zone = zone;
      if (!CLONES.has(material)) CLONES.set(material, []);
      CLONES.get(material).push(c);
      map.set(material, c);
    }
    return map.get(material);
  }

  /** geometry must already be in world space. */
  add(geo, material, { cast = true, receive = true, keepUV = false, uvRotate = 0 } = {}) {
    if (!keepUV) projectUV(geo, { rotate: uvRotate });
    if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
    }
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    let zone = 'main';
    if (this.zoneOf) {
      geo.computeBoundingBox();
      const c = geo.boundingBox.getCenter(new THREE.Vector3());
      zone = this.zoneOf(c.x, c.y, c.z);
    }
    const key = `${material.uuid}|${zone}|${cast}|${receive}`;
    if (!this.groups.has(key)) this.groups.set(key, { material: this.zoneMaterial(material, zone), cast, receive, list: [] });
    this.groups.get(key).list.push(geo);
    return geo;
  }

  box(x0, y0, z0, x1, y1, z1, material, opts) {
    return this.add(boxGeo(x0, y0, z0, x1, y1, z1), material, opts);
  }

  /** Add geometry transformed by a matrix or by (position, rotationY, scale). */
  addTransformed(geo, material, { x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1, ...opts } = {}) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
      new THREE.Vector3(s, s, s),
    );
    geo.applyMatrix4(m);
    return this.add(geo, material, opts);
  }

  /** Bake an Object3D hierarchy of meshes into the batch. */
  addObject(obj, opts = {}) {
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      if (o.isMesh) {
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        this.add(g, o.material, {
          cast: o.castShadow, receive: o.receiveShadow, keepUV: o.userData.keepUV ?? opts.keepUV ?? false,
        });
      }
    });
  }

  flush() {
    const meshes = [];
    for (const { material, cast, receive, list } of this.groups.values()) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      meshes.push(mesh);
    }
    this.groups.clear();
    return meshes;
  }
}

export function mesh(geo, material, { cast = true, receive = true, uv = true } = {}) {
  if (uv) projectUV(geo);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** Extrude a 2D shape (in XZ plane, y up) from y0 to y1. Shape points are [x, z]. */
export function extrudeXZ(points, y0, y1, bevel = 0, curveSegments = 24) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  return extrudeShape(shape, y0, y1, bevel, curveSegments);
}

export function extrudeShape(shape, y0, y1, bevel = 0, curveSegments = 24) {
  const depth = y1 - y0 - bevel * 2;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(depth, 0.001), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: bevel > 0 ? 5 : 0, curveSegments, steps: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + bevel, 0);
  return g;
}

/** Annular sector shape (for curved sofas), angles in radians around +y, xz plane. */
export function arcShape(r0, r1, a0, a1, seg = 64) {
  const s = new THREE.Shape();
  for (let i = 0; i <= seg; i++) {
    const a = a0 + (a1 - a0) * (i / seg);
    const p = new THREE.Vector2(Math.cos(a) * r1, Math.sin(a) * r1);
    if (i === 0) s.moveTo(p.x, p.y); else s.lineTo(p.x, p.y);
  }
  for (let i = seg; i >= 0; i--) {
    const a = a0 + (a1 - a0) * (i / seg);
    s.lineTo(Math.cos(a) * r0, Math.sin(a) * r0);
  }
  s.closePath();
  return s;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Deterministic random generator. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
