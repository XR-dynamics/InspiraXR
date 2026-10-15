import * as THREE from 'three';
import { roundedBox, rng } from './util.js';
import { lathe } from './living.js';

/*
 * Terrace (teak deck, lap pool, outdoor dining, loungers, topiary planters),
 * the garden beyond, and neighbouring architecture seen through the glazing.
 */

export function buildExterior(ctx) {
  const { batch: B, M, nav, scene } = ctx;
  const P = { x0: -7.4, x1: -4.6, z0: -7.0, z1: 10.0 };

  // ---- deck around the pool
  const deck = (x0, z0, x1, z1) => B.box(x0, -0.12, z0, x1, 0, z1, M.deck, { cast: false });
  deck(-8.0, -9.3, 0.0, P.z0 - 0.4);
  deck(-8.0, P.z1 + 0.4, 0.0, 14.0);
  deck(P.x1 + 0.4, P.z0 - 0.4, 0.0, P.z1 + 0.4);
  deck(-8.0, P.z0 - 0.4, P.x0 - 0.4, P.z1 + 0.4);
  // stone coping
  const cp = (x0, z0, x1, z1) => B.box(x0, -0.1, z0, x1, 0.015, z1, M.paver);
  cp(P.x0 - 0.4, P.z0 - 0.4, P.x1 + 0.4, P.z0);
  cp(P.x0 - 0.4, P.z1, P.x1 + 0.4, P.z1 + 0.4);
  cp(P.x0 - 0.4, P.z0, P.x0, P.z1);
  cp(P.x1, P.z0, P.x1 + 0.4, P.z1);
  // pool basin
  B.box(P.x0, -1.5, P.z0, P.x1, -1.45, P.z1, M.poolTile, { cast: false });
  B.box(P.x0, -1.5, P.z0, P.x0 + 0.02, -0.1, P.z1, M.poolTile, { cast: false });
  B.box(P.x1 - 0.02, -1.5, P.z0, P.x1, -0.1, P.z1, M.poolTile, { cast: false });
  B.box(P.x0, -1.5, P.z0, P.x1, -0.1, P.z0 + 0.02, M.poolTile, { cast: false });
  B.box(P.x0, -1.5, P.z1 - 0.02, P.x1, -0.1, P.z1, M.poolTile, { cast: false });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(P.x1 - P.x0, P.z1 - P.z0).rotateX(-Math.PI / 2), M.water);
  water.position.set((P.x0 + P.x1) / 2, -0.09, (P.z0 + P.z1) / 2);
  water.receiveShadow = true;
  water.renderOrder = 1;
  scene.add(water);
  const wn = M.water.normalMap;
  ctx.animated.push((dt, t) => { wn.offset.set(t * 0.012, t * 0.007); });
  const poolLight = new THREE.PointLight(0x7fd4e6, 0, 10, 2);
  poolLight.position.set(-6.0, -0.6, 1.5);
  ctx.lighting.addLight('terrace', poolLight, 9);

  // walkable terrace
  nav.allowRect(-8.0, -9.3, 0.0, 14.0);
  nav.blockRect(P.x0 - 0.15, P.z0 - 0.15, P.x1 + 0.15, P.z1 + 0.15);

  // ---- boundary: planter wall to the garden (west) and screen walls
  B.box(-8.6, -0.12, -9.3, -8.0, 0.75, 14.0, M.render);
  B.box(-8.55, 0.75, -9.25, -8.05, 0.8, 13.95, M.soil, { cast: false });
  hedge(ctx, -8.3, 0.8, -9.1, 13.8, 0.62);
  nav.blockRect(-8.7, -9.4, -7.95, 14.1);
  B.box(-8.6, -0.12, -9.6, 0.0, 2.6, -9.3, M.render);
  B.box(-8.6, -0.12, 14.0, 0.0, 2.6, 14.3, M.render);
  nav.blockRect(-8.7, -9.7, 0.1, -9.25);
  nav.blockRect(-8.7, 13.95, 0.1, 14.4);
  // wall washer sconces on the screen walls
  for (const z of [-9.29, 13.99]) {
    for (const x of [-6.5, -2.5]) {
      B.box(x - 0.06, 1.7, z + (z < 0 ? 0 : -0.06), x + 0.06, 1.95, z + (z < 0 ? 0.06 : 0), M.blackAlu);
      B.box(x - 0.04, 1.69, z + (z < 0 ? 0.01 : -0.05), x + 0.04, 1.7, z + (z < 0 ? 0.05 : -0.01), ctx.roomMat('terrace', 'downlight', 8), { cast: false });
    }
  }
  const s1 = new THREE.PointLight(0xffcf96, 0, 8, 2); s1.position.set(-4.5, 2.2, -8.6);
  const s2 = new THREE.PointLight(0xffcf96, 0, 8, 2); s2.position.set(-4.5, 2.2, 13.3);
  ctx.lighting.addLight('terrace', s1, 5);
  ctx.lighting.addLight('terrace', s2, 5);

  // ---- outdoor dining by the slider
  const tx = -2.3, tz = 5.0;
  ctx.item('terrace-table', { name: 'Outdoor dining table', room: 'terrace', category: 'furniture', movable: true }, () => {
    B.add(roundedBox(1.0, 0.05, 2.6, 0.01).translate(tx, 0.74, tz), M.slate);
    B.box(tx - 0.3, 0, tz - 1.0, tx + 0.3, 0.71, tz - 0.94, M.blackAlu);
    B.box(tx - 0.3, 0, tz + 0.94, tx + 0.3, 0.71, tz + 1.0, M.blackAlu);
    nav.blockRect(tx - 0.55, tz - 1.35, tx + 0.55, tz + 1.35);
  });
  let chairNo = 0;
  for (let i = 0; i < 3; i++) {
    for (const s of [-1, 1]) {
      ctx.item(`terrace-chair-${++chairNo}`, { name: 'Outdoor chair', room: 'terrace', category: 'furniture', movable: true },
        () => outdoorChair(ctx, tx + s * 0.85, tz - 0.85 + i * 0.85, s > 0 ? -Math.PI / 2 : Math.PI / 2));
    }
  }
  // umbrella-free pergola: slender black frame with timber slats
  for (const [x, z] of [[-4.0, 2.6], [-4.0, 7.4], [-0.6, 2.6], [-0.6, 7.4]]) {
    B.box(x - 0.05, 0, z - 0.05, x + 0.05, 2.9, z + 0.05, M.blackAlu);
    nav.blockRect(x - 0.12, z - 0.12, x + 0.12, z + 0.12);
  }
  B.box(-4.05, 2.9, 2.55, -0.55, 3.0, 2.65, M.blackAlu);
  B.box(-4.05, 2.9, 7.35, -0.55, 3.0, 7.45, M.blackAlu);
  for (let x = -3.95; x <= -0.6; x += 0.18) B.box(x, 3.0, 2.55, x + 0.06, 3.12, 7.45, M.walnut);

  // ---- loungers by the pool
  for (let i = 0; i < 3; i++) {
    ctx.item(`terrace-lounger-${i + 1}`, { name: 'Sun lounger', room: 'terrace', category: 'furniture', movable: true }, () => lounger(ctx, -3.6, -6.8 + i * 1.3));
  }
  // ---- topiary planters (as in the reference photo)
  topiary(ctx, -0.8, -8.5);
  topiary(ctx, -0.8, 13.3);
  topiary(ctx, -3.6, -0.4, 0.8);
  topiary(ctx, -3.6, 10.6, 0.8);

  // ---- garden
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(220, 220).rotateX(-Math.PI / 2), M.grass);
  lawn.position.set(-20, -0.9, 0);
  lawn.receiveShadow = true;
  scene.add(lawn);
  // retaining wall face below the terrace edge
  B.box(-8.62, -0.9, -9.6, -8.6, -0.12, 14.3, M.render);
  const r = rng(77);
  const trees = [[-16, -6, 1.2], [-18, 4, 1.4], [-14, 13, 1.0], [-24, -14, 1.6], [-26, 10, 1.7], [-12, -15, 1.1], [-30, 0, 1.8], [-20, 22, 1.5], [-11, 20, 1.0], [6, 28, 1.5], [-4, 26, 1.3], [16, -20, 1.5], [2, -19, 1.4], [26, 22, 1.4],
    [14, 19.5, 1.1], [19, 25, 1.5], [24, 18.5, 1.0], [30, 26, 1.6], [35, 16, 1.3], [36, 6, 1.5], [35, -3, 1.2], [37, -12, 1.6], [28, -15, 1.3], [22, -18, 1.2]];
  for (const [x, z, s] of trees) tree(ctx, x, z, s, r);
  for (let i = 0; i < 26; i++) {
    const x = -9.5 - r() * 22, z = -14 + r() * 36;
    if (Math.abs(x + 18) < 2 && Math.abs(z - 4) < 2) continue;
    shrub(ctx, x, -0.9, z, 0.5 + r() * 0.7, r);
  }

  // ---- neighbouring modern villa (white volumes, like the reference)
  const nx = -34;
  B.box(nx - 10, -0.9, -34, nx, 6.6, -18, M.render, { cast: false });
  B.box(nx - 4, 6.6, -36, nx + 3, 7.0, -15, M.render, { cast: false });
  B.box(nx + 0.02, 0.6, -31, nx + 0.04, 5.6, -21, M.smokedGlass, { cast: false });
  B.box(nx - 6, -0.9, -14, nx + 1, 3.4, -6, M.render, { cast: false });

  // ---- plinth under the house (the garden sits 0.9 m below floor level)
  B.box(-0.2, -0.9, -9.3, 30.3, -0.12, 12.3, M.render, { cast: false });
  B.box(3.2, -0.9, 12.3, 8.8, -0.12, 22.0, M.render, { cast: false });

  // ---- front entry court (seen through the front door)
  B.box(2.5, -0.12, 16.8, 9.5, 0.0, 22.0, M.paver, { cast: false });
  nav.allowRect(4.6, 16.8, 7.4, 18.6);
  hedge(ctx, 2.8, 0.0, 17.2, 21.8, 1.1);
  hedge(ctx, 9.2, 0.0, 17.2, 21.8, 1.1);
  B.box(-2, -0.9, 22.0, 33.5, 0.0, 22.3, M.render);
  B.box(33.2, -0.9, -16, 33.5, 0.0, 22.3, M.render);
  // planted borders seen from the bedroom and bath windows
  for (const [x, z, w, d, h] of [[11, 21.4, 21, 0.9, 1.6], [32.6, 3, 0.9, 36, 1.8], [16, -16.5, 24, 0.9, 1.7]]) {
    B.add(roundedBox(w, h, d, 0.3, 3).translate(x, -0.9 + h / 2, z), M.boxwood);
  }
  for (let i = 0; i < 14; i++) shrub(ctx, 13 + r() * 18, -0.9, 14.5 + r() * 5, 0.4 + r() * 0.5, r);
  for (let i = 0; i < 10; i++) shrub(ctx, 31.5 + r() * 1.2, -0.9, -12 + r() * 30, 0.4 + r() * 0.5, r);
  for (let i = 0; i < 10; i++) shrub(ctx, 8 + r() * 22, -0.9, -14.5 + r() * 3, 0.4 + r() * 0.5, r);
  topiary(ctx, 4.3, 17.4, 0.9);
  topiary(ctx, 7.7, 17.4, 0.9);
  // entrance canopy
  B.box(3.0, 3.6, 16.65, 9.0, 3.8, 19.0, M.render);
  B.box(3.0, 3.58, 16.65, 9.0, 3.6, 19.0, M.walnut);
}

function outdoorChair(ctx, x, z, ry) {
  const { batch: B, M } = ctx;
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  // slim powder-coated frame
  for (const [lx, lz] of [[-0.23, -0.21], [0.23, -0.21], [-0.23, 0.21], [0.23, 0.21]]) {
    const [px, pz] = at(lx, lz);
    B.add(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 8).translate(px, 0.2, pz), M.blackAlu);
  }
  for (const lx of [-0.23, 0.23]) {
    const [px, pz] = at(lx, -0.23);
    B.addTransformed(new THREE.CylinderGeometry(0.011, 0.011, 0.42, 8), M.blackAlu, { x: px, y: 0.62, z: pz, ry, rx: -0.12 });
  }
  B.addTransformed(roundedBox(0.5, 0.035, 0.48, 0.012, 2), M.blackAlu, { x, y: 0.41, z, ry });
  // cushioned seat and woven back
  B.addTransformed(roundedBox(0.5, 0.08, 0.47, 0.035, 3), M.linenGrey, { x, y: 0.47, z, ry });
  const [bx, bz] = at(0, -0.225);
  B.addTransformed(roundedBox(0.46, 0.34, 0.03, 0.012, 2), M.linenDark, { x: bx, y: 0.66, z: bz, ry, rx: -0.12 });
}

function lounger(ctx, x, z) {
  const { batch: B, M, nav } = ctx;
  B.add(roundedBox(1.9, 0.12, 0.72, 0.05, 3).translate(x, 0.32, z), M.linenWhite);
  B.box(x - 0.95, 0.0, z - 0.34, x + 0.95, 0.26, z + 0.34, M.walnutDark);
  B.addTransformed(roundedBox(0.7, 0.1, 0.7, 0.05, 3), M.linenWhite, { x: x + 0.72, y: 0.55, z, rz: 0.55 });
  nav.blockRect(x - 1.0, z - 0.4, x + 1.0, z + 0.4);
}

function hedge(ctx, x, y, z0, z1, h) {
  const { batch: B, M } = ctx;
  B.add(roundedBox(0.55, h, z1 - z0, 0.18, 3).translate(x, y + h / 2, (z0 + z1) / 2), M.boxwood);
}

export function topiary(ctx, x, z, s = 1) {
  const { batch: B, M, nav } = ctx;
  const pot = new THREE.CylinderGeometry(0.32 * s, 0.28 * s, 0.6 * s, 40);
  B.add(pot.translate(x, 0.3 * s, z), M.ceramicDark);
  B.add(new THREE.CylinderGeometry(0.03 * s, 0.04 * s, 1.0 * s, 8).translate(x, 1.0 * s, z), M.bark);
  B.add(new THREE.IcosahedronGeometry(0.42 * s, 4).translate(x, 1.65 * s, z), M.boxwood);
  nav.blockCircle(x, z, 0.36 * s);
}

function tree(ctx, x, z, s, r) {
  const { batch: B, M } = ctx;
  const y0 = -0.9;
  const trunkH = 3.2 * s;
  const cast = Math.hypot(x - 2, z - 2) < 20;
  B.add(new THREE.CylinderGeometry(0.1 * s, 0.18 * s, trunkH, 10).translate(x, y0 + trunkH / 2, z), M.bark, { cast });
  const card = new THREE.PlaneGeometry(1.1 * s, 1.1 * s);
  const n = Math.floor(160 * s);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2;
    const rr = Math.cbrt(r()) * 2.4 * s;
    const px = x + Math.sqrt(1 - u * u) * Math.cos(th) * rr;
    const pz = z + Math.sqrt(1 - u * u) * Math.sin(th) * rr;
    const py = y0 + trunkH + 1.2 * s + u * rr * 0.8;
    B.addTransformed(card.clone(), M.leaves, { x: px, y: py, z: pz, ry: r() * Math.PI * 2, rx: (r() - 0.5) * 1.4, rz: (r() - 0.5), keepUV: true, cast });
  }
}

function shrub(ctx, x, y, z, s, r) {
  const { batch: B, M } = ctx;
  const g = new THREE.IcosahedronGeometry(s, 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * 0.7);
  g.computeVertexNormals();
  B.add(g.translate(x, y + s * 0.5, z), r() > 0.5 ? M.boxwood : M.foliage);
}

export { lathe };
