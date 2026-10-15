#!/usr/bin/env node
/*
 * Packs the apartment's FBX meshes and scene description into two small web files:
 *   public/apartment/pack.json   asset index, materials, placements, doors, lights, plan
 *   public/apartment/pack.bin    interleaved vertex data (one block per asset part)
 *
 * Source: assets/apartment/source/{Meshes/*.fbx, scene.json}  (override with --src <dir>)
 * Coordinates: scene.json is x east, y north, z up (metres). The web scene is x east, y up, z south,
 * so (x, y, z) -> (x, z, -y). Parsed FBX geometry arrives in centimetres in that same frame, so a
 * divide by 100 is the only extra step.
 *
 * Vertex layout (24 bytes): position f32x3, normal i8x3 (+1 pad), uv f32x2. Non-indexed triangles.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const src = path.resolve(arg('--src', path.join(root, 'assets/apartment/source')));
const out = path.resolve(arg('--out', path.join(root, 'public/apartment')));
fs.mkdirSync(out, { recursive: true });

const scene = JSON.parse(fs.readFileSync(path.join(src, 'scene.json'), 'utf8'));
const files = fs.readdirSync(path.join(src, 'Meshes')).filter((f) => f.endsWith('.fbx')).sort();

const chunks = [];
let vertexCursor = 0;
const assets = {};
const loader = new FBXLoader();

for (const f of files) {
  const name = f.replace(/\.fbx$/, '');
  const buf = fs.readFileSync(path.join(src, 'Meshes', f));
  const root3 = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  root3.updateMatrixWorld(true);
  const byMat = new Map();
  const box = new THREE.Box3();
  root3.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    g.scale(0.01, 0.01, 0.01);
    if (!g.attributes.normal) g.computeVertexNormals();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    const idx = g.index;
    const groups = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }];
    for (const grp of groups) {
      const mname = (mats[grp.materialIndex] || mats[0]).name || 'D_Plaster';
      if (!byMat.has(mname)) byMat.set(mname, []);
      const list = byMat.get(mname);
      for (let i = grp.start; i < grp.start + grp.count; i++) {
        const v = idx ? idx.getX(i) : i;
        list.push(pos.getX(v), pos.getY(v), pos.getZ(v), nor.getX(v), nor.getY(v), nor.getZ(v), uv ? uv.getX(v) : 0, uv ? uv.getY(v) : 0);
      }
    }
    g.computeBoundingBox();
    box.union(g.boundingBox);
  });
  const parts = [];
  for (const [m, arr] of byMat) {
    const n = arr.length / 8;
    const b = Buffer.alloc(n * 24);
    for (let i = 0; i < n; i++) {
      const o = i * 24, a = i * 8;
      b.writeFloatLE(arr[a], o); b.writeFloatLE(arr[a + 1], o + 4); b.writeFloatLE(arr[a + 2], o + 8);
      const nl = Math.hypot(arr[a + 3], arr[a + 4], arr[a + 5]) || 1;
      for (let k = 0; k < 3; k++) b.writeInt8(Math.max(-127, Math.min(127, Math.round((arr[a + 3 + k] / nl) * 127))), o + 12 + k);
      b.writeFloatLE(arr[a + 6], o + 16); b.writeFloatLE(arr[a + 7], o + 20);
    }
    chunks.push(b);
    parts.push({ m, v0: vertexCursor, n });
    vertexCursor += n;
  }
  assets[name] = { parts, min: box.min.toArray().map((v) => +v.toFixed(4)), max: box.max.toArray().map((v) => +v.toFixed(4)) };
}

fs.writeFileSync(path.join(out, 'pack.bin'), Buffer.concat(chunks));
const { polys, bbox, assets: assetMeta, ...rest } = scene;
for (const [k, v] of Object.entries(assetMeta)) if (assets[k]) assets[k].kind = v.kind;
fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ ...rest, meshes: assets, vertexStride: 24, vertexCount: vertexCursor }));
console.log(`packed ${files.length} meshes, ${vertexCursor} vertices (${(vertexCursor * 24 / 1e6).toFixed(2)} MB bin)`);
