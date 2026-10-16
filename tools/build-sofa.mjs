#!/usr/bin/env node
/*
 * Converts the supplied living-room set (a 3ds Max OBJ: an L-shaped sectional, throw pillows, a coffee
 * table, a pouf and a side table with a lamp) into a compact pack for the web app, keeping only the
 * sectional and its pillows. The OBJ is in inches (y up); the pack is in metres with the sofa's footprint
 * centred on the origin and standing on y = 0.
 *   node tools/build-sofa.mjs [obj] [outDir]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const objPath = process.argv[2] || path.join(root, 'assets/apartment/source/sofa/sofa.obj');
const out = process.argv[3] || path.join(root, 'public/apartment/models');
fs.mkdirSync(out, { recursive: true });
const INCH = 0.0254;
const FABRIC = 'wire_086086086', PILLOW = 'wire_000000000';

const group = new OBJLoader().parse(fs.readFileSync(objPath, 'latin1'));
const geos = new Map(); // material -> [positions, normals, uvs] (non-indexed)
group.traverse((o) => {
  if (!o.isMesh) return;
  const g = o.geometry;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const groups = g.groups.length ? g.groups : [{ start: 0, count: pos.count, materialIndex: 0 }];
  for (const gr of groups) {
    const name = mats[gr.materialIndex]?.name || mats[0].name;
    if (!geos.has(name)) geos.set(name, { p: [], n: [], u: [] });
    const t = geos.get(name);
    for (let i = gr.start; i < gr.start + gr.count; i++) {
      t.p.push(pos.getX(i) * INCH, pos.getY(i) * INCH, pos.getZ(i) * INCH);
      t.n.push(nor ? nor.getX(i) : 0, nor ? nor.getY(i) : 1, nor ? nor.getZ(i) : 0);
      t.u.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    }
  }
});

/** Split a triangle soup into connected pieces (triangles sharing a quantised vertex). */
function components(p) {
  const nTri = p.length / 9, parent = Array.from({ length: nTri }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const seen = new Map();
  for (let t = 0; t < nTri; t++) {
    for (let v = 0; v < 3; v++) {
      const k = `${Math.round(p[t * 9 + v * 3] * 2000)},${Math.round(p[t * 9 + v * 3 + 1] * 2000)},${Math.round(p[t * 9 + v * 3 + 2] * 2000)}`;
      if (seen.has(k)) { const a = find(seen.get(k)), b = find(t); if (a !== b) parent[a] = b; } else seen.set(k, t);
    }
  }
  const comps = new Map();
  for (let t = 0; t < nTri; t++) { const r = find(t); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(t); }
  return [...comps.values()];
}
const bboxOf = (p, tris) => { const b = new THREE.Box3(); for (const t of tris) for (let v = 0; v < 3; v++) b.expandByPoint(new THREE.Vector3(p[t * 9 + v * 3], p[t * 9 + v * 3 + 1], p[t * 9 + v * 3 + 2])); return b; };

const fab = geos.get(FABRIC);
const fabComps = components(fab.p).map((tris) => ({ tris, box: bboxOf(fab.p, tris) })).sort((a, b) => b.tris.length - a.tris.length);
console.log('upholstery pieces (tris, size m):', fabComps.slice(0, 8).map((c) => `${c.tris.length} ${c.box.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(2)).join('x')} @${c.box.getCenter(new THREE.Vector3()).toArray().map((v) => v.toFixed(2)).join(',')}`));
// the sectional is the big pieces; the pouf and anything small and far away are dropped
const big = fabComps[0];
const anchor = big.box.getCenter(new THREE.Vector3());
const sofa = fabComps.filter((c) => c.tris.length > 1500 && c.box.getCenter(new THREE.Vector3()).distanceTo(anchor) < 2.2);
const body = new THREE.Box3(); sofa.forEach((c) => body.union(c.box));
body.expandByScalar(0.12);
console.log('sofa body box', body.min.toArray().map((v) => v.toFixed(2)), body.max.toArray().map((v) => v.toFixed(2)), 'pieces kept', sofa.length);

const pick = (src, trisFilter) => { const o = { p: [], n: [], u: [] }; for (const t of trisFilter) { for (let k = 0; k < 9; k++) { o.p.push(src.p[t * 9 + k]); o.n.push(src.n[t * 9 + k]); } for (let k = 0; k < 6; k++) o.u.push(src.u[t * 6 + k]); } return o; };
const fabric = pick(fab, sofa.flatMap((c) => c.tris));
const pil = geos.get(PILLOW);
const pillowTris = [];
for (const tris of components(pil.p)) { const b = bboxOf(pil.p, tris); if (body.containsPoint(b.getCenter(new THREE.Vector3()))) pillowTris.push(...tris); }
const pillows = pick(pil, pillowTris);

// place: footprint centre on the origin, feet on y = 0
const all = new THREE.Box3(); for (const g of [fabric, pillows]) for (let i = 0; i < g.p.length; i += 3) all.expandByPoint(new THREE.Vector3(g.p[i], g.p[i + 1], g.p[i + 2]));
const cx = (all.min.x + all.max.x) / 2, cz = (all.min.z + all.max.z) / 2, y0 = all.min.y;
console.log('final size m', all.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(2)).join(' x '), 'tris', (fabric.p.length + pillows.p.length) / 9);

const chunks = []; let cursor = 0; const parts = [];
for (const [m, g] of [['fabric', fabric], ['pillow', pillows]]) {
  const n = g.p.length / 3;
  const b = Buffer.alloc(n * 24);
  for (let i = 0; i < n; i++) {
    const o = i * 24;
    b.writeFloatLE(g.p[i * 3] - cx, o); b.writeFloatLE(g.p[i * 3 + 1] - y0, o + 4); b.writeFloatLE(g.p[i * 3 + 2] - cz, o + 8);
    const nl = Math.hypot(g.n[i * 3], g.n[i * 3 + 1], g.n[i * 3 + 2]) || 1;
    for (let k = 0; k < 3; k++) b.writeInt8(Math.max(-127, Math.min(127, Math.round((g.n[i * 3 + k] / nl) * 127))), o + 12 + k);
    b.writeFloatLE(g.u[i * 2], o + 16); b.writeFloatLE(g.u[i * 2 + 1], o + 20);
  }
  chunks.push(b); parts.push({ m, v0: cursor, n }); cursor += n;
}
fs.writeFileSync(path.join(out, 'sofa.bin'), Buffer.concat(chunks));
fs.writeFileSync(path.join(out, 'sofa.json'), JSON.stringify({
  vertexStride: 24, vertexCount: cursor, units: 'metres',
  meshes: { sofa: { parts, min: [all.min.x - cx, 0, all.min.z - cz].map((v) => +v.toFixed(4)), max: [all.max.x - cx, all.max.y - y0, all.max.z - cz].map((v) => +v.toFixed(4)) } },
}));
console.log('wrote sofa pack', cursor, 'vertices');
