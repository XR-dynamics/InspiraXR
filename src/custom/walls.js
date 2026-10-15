import * as THREE from 'three';

/*
 * Paintable wall faces. Every wall face (wall entry + side + room) is a range of
 * vertices inside one of the merged wall meshes; painting rewrites that range of the
 * per-vertex tint, so a single draw call per probe zone is kept and no other object —
 * not even another wall that shares the same plaster maps — can be affected.
 */
export class WallSystem {
  constructor({ scene, faceDefs, faceRanges }) {
    this.scene = scene;
    this.faces = new Map();
    const meshes = new Set();
    for (const [id, ranges] of faceRanges) {
      const def = faceDefs.get(id);
      if (!def) continue;
      this.faces.set(id, { ...def, ranges, hex: null });
      ranges.forEach((r) => meshes.add(r.mesh));
    }
    this.meshes = [...meshes];
    this._color = new THREE.Color();

    this.overlay = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: 0xffc27d, transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }),
    );
    this.overlay.visible = false;
    this.overlay.frustumCulled = false;
    this.overlay.renderOrder = 4;
    this.overlay.raycast = () => {}; // never pickable
    this.overlay.userData.noAO = true;
    scene.add(this.overlay);
    this.highlighted = null;
  }

  get(id) { return this.faces.get(id) || null; }

  /** Face id for a triangle of a wall mesh (non-indexed geometry), or null for edges/returns. */
  faceAt(mesh, triIndex) {
    const ranges = mesh.userData.faceRanges;
    if (!ranges) return null;
    const v = triIndex * 3;
    let lo = 0, hi = ranges.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const r = ranges[mid];
      if (v < r.start) hi = mid - 1;
      else if (v >= r.start + r.count) lo = mid + 1;
      else return r.id;
    }
    return null;
  }

  paint(id, hex) {
    const f = this.faces.get(id);
    if (!f) return;
    f.hex = hex || null;
    if (hex) this._color.set(hex); else this._color.setRGB(1, 1, 1);
    const { r, g, b } = this._color;
    const touched = new Set();
    for (const { mesh, start, count } of f.ranges) {
      const attr = mesh.geometry.attributes.color;
      for (let i = start; i < start + count; i++) {
        attr.array[i * 3] = r; attr.array[i * 3 + 1] = g; attr.array[i * 3 + 2] = b;
      }
      touched.add(attr);
    }
    touched.forEach((a) => { a.needsUpdate = true; });
  }

  /** Interior walls only: surfaces that face a room of the house. */
  interiorIds() { return [...this.faces.values()].filter((f) => f.room).map((f) => f.id); }
  paintAll(hex) { for (const id of this.interiorIds()) this.paint(id, hex); }
  restoreAll() { for (const id of this.faces.keys()) this.paint(id, null); }

  highlight(id) {
    if (id === this.highlighted) return;
    this.highlighted = id;
    const f = id && this.faces.get(id);
    if (!f) { this.overlay.visible = false; return; }
    const pos = [];
    const nrm = f.normal;
    for (const { mesh, start, count } of f.ranges) {
      const p = mesh.geometry.attributes.position;
      for (let i = start; i < start + count; i++) {
        pos.push(p.getX(i) + nrm[0] * 0.004, p.getY(i), p.getZ(i) + nrm[1] * 0.004);
      }
    }
    this.overlay.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    this.overlay.geometry = g;
    this.overlay.visible = true;
  }

  /** Gentle pulse so the highlight reads as "selectable" without shouting. */
  tick(t) { if (this.overlay.visible) this.overlay.material.opacity = 0.15 + 0.06 * Math.sin(t * 3.2); }

  serialize() {
    const out = {};
    for (const f of this.faces.values()) if (f.hex) out[f.id] = f.hex;
    return out;
  }
  load(state = {}) { for (const [id, hex] of Object.entries(state)) this.paint(id, hex); }
}
