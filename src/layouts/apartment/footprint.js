import * as THREE from 'three';

/** Oriented bounding rectangle of an asset's placed geometry, as a blocking shape. */
export function blockAsset(nav, pack, asset, mt) {
  const a = pack.meshes[asset];
  const lo = new THREE.Vector3(...a.min), hi = new THREE.Vector3(...a.max);
  const centre = lo.clone().add(hi).multiplyScalar(0.5).applyMatrix4(mt);
  const q = new THREE.Quaternion().setFromRotationMatrix(mt);
  const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
  nav.blockOriented(centre.x, centre.z, hi.x - lo.x, hi.z - lo.z, e.y);
}

/**
 * Walking footprint of a piece: every 10 cm cell its geometry covers between 5 cm and 1.5 m above
 * the floor, merged into rectangles (so an L-shaped sofa blocks an L, not its bounding square).
 */
export function footprint(geos, flat) {
  const cell = 0.1;
  const occ = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let minI = 1e9, minJ = 1e9, maxI = -1e9, maxJ = -1e9;
  const lo = flat ? -1 : 0.05, hi = flat ? 9 : 1.5;
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    const p = ng.attributes.position;
    for (let t = 0; t < p.count; t += 3) {
      a.fromBufferAttribute(p, t); b.fromBufferAttribute(p, t + 1); c.fromBufferAttribute(p, t + 2);
      if (Math.max(a.y, b.y, c.y) < lo || Math.min(a.y, b.y, c.y) > hi) continue;
      const span = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
      const n = Math.max(1, Math.ceil(span / 0.04));
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        const u = i / n, v = j / n, w = 1 - u - v;
        const x = a.x * w + b.x * u + c.x * v, z = a.z * w + b.z * u + c.z * v;
        const ci = Math.floor(x / cell), cj = Math.floor(z / cell);
        occ.set(ci * 100000 + cj, [ci, cj]);
        minI = Math.min(minI, ci); maxI = Math.max(maxI, ci); minJ = Math.min(minJ, cj); maxJ = Math.max(maxJ, cj);
      }
    }
  }
  // greedy merge: grow each unclaimed cell along x, then as far along z as the whole run stays occupied
  const has = (i, j) => occ.has(i * 100000 + j);
  const done = new Set();
  const shapes = [];
  for (let j = minJ; j <= maxJ; j++) for (let i = minI; i <= maxI; i++) {
    if (!has(i, j) || done.has(i * 100000 + j)) continue;
    let w = 1;
    while (has(i + w, j) && !done.has((i + w) * 100000 + j)) w++;
    let d = 1;
    outer: while (true) {
      for (let k = 0; k < w; k++) if (!has(i + k, j + d) || done.has((i + k) * 100000 + j + d)) break outer;
      d++;
    }
    for (let jj = 0; jj < d; jj++) for (let ii = 0; ii < w; ii++) done.add((i + ii) * 100000 + j + jj);
    shapes.push({ t: 'o', x: (i + w / 2) * cell, z: (j + d / 2) * cell, w: w * cell, d: d * cell, ry: 0 });
  }
  return shapes;
}

