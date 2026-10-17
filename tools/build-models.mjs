#!/usr/bin/env node
/*
 * Packs the supplied furniture models (Unreal FBX exports in centimetres, z up; a Blender Collada toilet in
 * metres) into one compact pack for the web app: public/apartment/models/furniture.json + furniture.bin.
 *
 * Each model is converted to metres, y up, its footprint centred on the origin with its feet on y = 0. Faces
 * stay split by material "role" (fabric, wood, brass ...) so the app can give them its own PBR materials.
 *   node tools/build-models.mjs [srcDir] [outDir]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { DOMParser } from '@xmldom/xmldom';

globalThis.DOMParser = DOMParser;
THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };   // textures are rebuilt by the app

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2] || path.join(root, 'assets/apartment/source/models');
const out = process.argv[3] || path.join(root, 'public/apartment/models');
fs.mkdirSync(out, { recursive: true });

// file -> { name, kind } ; roles map a source material name to what the app should render it with
const MODELS = [
  { file: 'IX_Sofa.FBX', name: 'ix_sofa' },
  { file: 'IX_Bed.FBX', name: 'ix_bed' },
  { file: 'SM_IX_dinningTable.FBX', name: 'dining_table' },
  { file: 'SM_diiningChair.FBX', name: 'dining_chair' },
  { file: 'SM_CoffeeTable_Drum.FBX', name: 'coffee_drum' },
  { file: 'SM_BackyardSofa13.FBX', name: 'terrace_sofa' },
  { file: 'SM_BackyardSofa05Cushion01.FBX', name: 'terrace_cushion' },
  { file: 'SM_BackyardTable19.FBX', name: 'terrace_table' },
  { file: 'SM_BookGroup06.FBX', name: 'books' },
  { file: 'toilet2_5k.dae', name: 'toilet', dae: true },
];

const role = (m) => {
  const s = (m || '').toLowerCase();
  if (/glass/.test(s)) return /green/.test(s) ? 'glass_green' : 'glass';
  if (/book|notebook/.test(s)) return 'book:' + (s.match(/\d+/)?.[0] || '0');
  if (/brass|bronze|gold/.test(s)) return 'brass';
  if (/black|plate|tile_black/.test(s)) return 'black';
  if (/sheet/.test(s)) return 'sheet';
  if (/throw/.test(s)) return 'throw';
  if (/cloth|fabric|boucle|cushion|sofa0501/.test(s)) return 'fabric';
  if (/wicker|weave/.test(s)) return 'wicker';
  if (/wood|walnut|plinth|slat/.test(s)) return /gloss|slate/.test(s) ? 'wood_dark' : 'wood';
  return /toil/.test(s) ? 'ceramic' : 'other';
};

const chunks = []; let cursor = 0;
const meshes = {};
for (const def of MODELS) {
  const file = path.join(src, def.file);
  if (!fs.existsSync(file)) { console.warn('missing', def.file); continue; }
  let obj;
  if (def.dae) obj = new ColladaLoader().parse(fs.readFileSync(file, 'utf8'), '').scene;
  else { const b = fs.readFileSync(file); obj = new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); }
  obj.updateMatrixWorld(true);
  const parts = new Map(); // role -> {p,n,u}
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (/^(UCX|UBX|UCP|USP)_/i.test(o.name) || /^(UCX|UBX|UCP|USP)_/i.test(o.parent?.name || '')) return;   // Unreal collision hulls
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const groups = o.geometry.groups.length ? o.geometry.groups : [{ start: 0, count: pos.count, materialIndex: 0 }];
    // toNonIndexed keeps groups in non-indexed vertex units only when the source was indexed: recompute
    const gr2 = o.geometry.index ? (() => { let c = 0; return groups.map((x) => { const r = { start: c, count: x.count, materialIndex: x.materialIndex }; c += x.count; return r; }); })() : groups;
    const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (const gr of gr2) {
      const r = role(mats[gr.materialIndex]?.name || mats[0].name);
      if (!parts.has(r)) parts.set(r, { p: [], n: [], u: [] });
      const t = parts.get(r);
      for (let i = gr.start; i < gr.start + gr.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        n.set(nor ? nor.getX(i) : 0, nor ? nor.getY(i) : 1, nor ? nor.getZ(i) : 0).applyMatrix3(nm).normalize();
        if (def.dae) { t.p.push(v.x, v.y, v.z); t.n.push(n.x, n.y, n.z); }
        else { t.p.push(v.x * 0.01, v.z * 0.01, -v.y * 0.01); t.n.push(n.x, n.z, -n.y); }   // z up, cm -> y up, m
        t.u.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      }
    }
  });
  const box = new THREE.Box3();
  for (const t of parts.values()) for (let i = 0; i < t.p.length; i += 3) box.expandByPoint(new THREE.Vector3(t.p[i], t.p[i + 1], t.p[i + 2]));
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, y0 = box.min.y;
  const outParts = [];
  for (const [m, t] of parts) {
    const nv = t.p.length / 3;
    const b = Buffer.alloc(nv * 24);
    for (let i = 0; i < nv; i++) {
      const o = i * 24;
      b.writeFloatLE(t.p[i * 3] - cx, o); b.writeFloatLE(t.p[i * 3 + 1] - y0, o + 4); b.writeFloatLE(t.p[i * 3 + 2] - cz, o + 8);
      for (let k = 0; k < 3; k++) b.writeInt8(Math.max(-127, Math.min(127, Math.round(t.n[i * 3 + k] * 127))), o + 12 + k);
      b.writeFloatLE(t.u[i * 2], o + 16); b.writeFloatLE(t.u[i * 2 + 1], o + 20);
    }
    chunks.push(b); outParts.push({ m, v0: cursor, n: nv }); cursor += nv;
  }
  const s = box.getSize(new THREE.Vector3());
  meshes[def.name] = { parts: outParts, min: [box.min.x - cx, 0, box.min.z - cz].map((v) => +v.toFixed(4)), max: [box.max.x - cx, s.y, box.max.z - cz].map((v) => +v.toFixed(4)) };
  console.log(def.name.padEnd(16), s.toArray().map((v) => v.toFixed(2)).join(' x '), 'm', 'tris', [...parts.values()].reduce((a, t) => a + t.p.length / 9, 0), 'roles', [...parts.keys()].join(','));
}
fs.writeFileSync(path.join(out, 'furniture.bin'), Buffer.concat(chunks));
fs.writeFileSync(path.join(out, 'furniture.json'), JSON.stringify({ vertexStride: 24, vertexCount: cursor, units: 'metres', meshes }));
console.log('wrote furniture pack', cursor, 'vertices');
