import * as THREE from 'three';
import { roundedBox, rng } from './util.js';
import { H } from './layout.js';
import { lathe, vaseWithFlowers, plant } from './living.js';

/*
 * Dining room under the gallery (long table, upholstered chairs, sideboard,
 * art wall, glass-globe chandelier) and the walnut + Grigio marble kitchen.
 */

export function buildDining(ctx) {
  const { batch: B, M, nav } = ctx;
  const cx = 6.0, cz = -4.5;
  const L = 4.2, W = 1.25;
  // table: dark marble top on two walnut slab legs
  B.add(roundedBox(L, 0.05, W, 0.012, 2).translate(cx, 0.745, cz), M.darkMarble);
  for (const s of [-1, 1]) {
    B.box(cx + s * (L / 2 - 0.55) - 0.06, 0, cz - W / 2 + 0.22, cx + s * (L / 2 - 0.55) + 0.06, 0.72, cz + W / 2 - 0.22, M.walnut);
  }
  B.box(cx - L / 2 + 0.5, 0.66, cz - 0.04, cx + L / 2 - 0.5, 0.72, cz + 0.04, M.blackAlu);
  nav.blockRect(cx - L / 2 - 0.05, cz - W / 2 - 0.05, cx + L / 2 + 0.05, cz + W / 2 + 0.05);

  // chairs: 5 each side + heads
  const seats = [];
  for (let i = 0; i < 5; i++) {
    const x = cx - L / 2 + 0.45 + i * ((L - 0.9) / 4);
    seats.push([x, cz - W / 2 - 0.32, 0]);
    seats.push([x, cz + W / 2 + 0.32, Math.PI]);
  }
  seats.push([cx - L / 2 - 0.42, cz, Math.PI / 2]);
  seats.push([cx + L / 2 + 0.42, cz, -Math.PI / 2]);
  for (const [x, z, ry] of seats) diningChair(ctx, x, z, ry);

  // table styling
  const r = rng(5);
  for (let i = 0; i < 3; i++) {
    const x = cx - 0.9 + i * 0.9;
    const h = 0.14 + r() * 0.2;
    B.add(new THREE.LatheGeometry(lathe([[0, 0], [0.05, 0], [0.07, h * 0.5], [0.03, h], [0, h]]), 32).translate(x, 0.77, cz), [M.ceramic, M.ceramicDark, M.smokedGlass][i]);
  }
  vaseWithFlowers(ctx, cx + 1.45, 0.77, cz + 0.1, 0.9);

  // chandelier over the table: linear cluster of globes in the coffer
  const sphere = new THREE.SphereGeometry(1, 28, 16);
  for (let i = 0; i < 18; i++) {
    const x = cx - 1.6 + (i / 17) * 3.2 + (r() - 0.5) * 0.15;
    const z = cz + (r() - 0.5) * 0.5;
    const y = H.ceiling - 0.9 - r() * 0.7;
    const rad = 0.06 + r() * 0.05;
    const mat = i % 3 === 0 ? ctx.roomMat('dining', 'opal', 4) : (i % 3 === 1 ? M.clearSphere : M.smokeSphere);
    B.add(sphere.clone().scale(rad, rad, rad).translate(x, y, z), mat, { cast: false });
    B.add(new THREE.CylinderGeometry(0.002, 0.002, H.ceiling - y, 4).translate(x, (H.ceiling + y) / 2, z), M.brass, { cast: false });
  }
  const dl = new THREE.PointLight(0xffd29c, 0, 7, 2);
  dl.position.set(cx, 2.1, cz);
  ctx.lighting.addLight('dining', dl, 10);

  // sideboard + art on the north wall
  B.box(3.0, 0.12, -8.98, 9.0, 0.82, -8.45, M.walnut);
  B.box(3.04, 0.0, -8.94, 8.96, 0.12, -8.5, M.shadowGap, { cast: false });
  B.box(2.98, 0.82, -9.0, 9.02, 0.85, -8.43, M.darkMarble);
  for (let i = 1; i < 4; i++) B.box(3.0 + i * 1.5 - 0.004, 0.14, -8.452, 3.0 + i * 1.5 + 0.004, 0.8, -8.447, M.shadowGap, { cast: false });
  nav.blockRect(2.9, -9, 9.1, -8.35);
  B.box(3.6, 1.15, -8.99, 8.4, 3.05, -8.96, M.blackMatte);
  B.add(new THREE.PlaneGeometry(4.7, 1.8).translate(6.0, 2.1, -8.955), M.art2, { keepUV: true });
  // brass disc sculpture cluster (as in the reference back wall)
  for (let i = 0; i < 4; i++) {
    const rr = 0.12 + r() * 0.12;
    B.add(new THREE.CylinderGeometry(rr, rr, 0.015, 48).rotateX(Math.PI / 2).translate(3.5 + r() * 0.6, 0.96 + 0.02, -8.75), M.brass);
  }
  B.add(new THREE.LatheGeometry(lathe([[0, 0], [0.11, 0], [0.15, 0.2], [0.08, 0.5], [0.05, 0.55], [0, 0.55]]), 40).translate(8.3, 0.85, -8.7), M.ceramicDark);
  vaseWithFlowers(ctx, 7.6, 0.85, -8.7, 1.1);
  plant(ctx, 1.0, -8.2, 0.95);
  plant(ctx, 11.2, -8.2, 0.8);

  ctx.downlights('dining', [[2.5, -8.2], [9.5, -8.2], [2.5, -0.8], [9.5, -0.8]], H.ceiling - 0.14);
  ctx.spot('dining', 4.2, H.ceiling - 0.02, cz, 30);
  ctx.spot('dining', 7.8, H.ceiling - 0.02, cz, 30);
}

function diningChair(ctx, x, z, ry) {
  const { batch: B, M, nav } = ctx;
  const seat = roundedBox(0.5, 0.12, 0.5, 0.05, 3);
  B.addTransformed(seat, M.chairFabric, { x, y: 0.47, z, ry });
  const back = roundedBox(0.48, 0.5, 0.09, 0.04, 3);
  // back rests on the far side of the seat (away from the table)
  const bx = x - Math.sin(ry) * 0.22, bz = z - Math.cos(ry) * 0.22;
  B.addTransformed(back, M.chairFabric, { x: bx, y: 0.77, z: bz, ry, rx: -0.09 });
  const leg = new THREE.CylinderGeometry(0.014, 0.011, 0.41, 8);
  for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
    const wx = x + lx * Math.cos(ry) + lz * Math.sin(ry);
    const wz = z - lx * Math.sin(ry) + lz * Math.cos(ry);
    B.add(leg.clone().translate(wx, 0.205, wz), M.blackAlu);
  }
  nav.blockCircle(x, z, 0.3);
}

export function buildKitchen(ctx) {
  const { batch: B, M, nav } = ctx;
  // ---- back run on the north wall: tall walnut columns flank a marble counter
  const backZ0 = -9.0, backZ1 = -8.35;
  tallUnit(ctx, 12.15, 14.2, backZ0, backZ1, 'z');
  tallUnit(ctx, 17.8, 19.9, backZ0, backZ1, 'z');
  // base cabinets
  B.box(14.2, 0.1, backZ0, 17.8, 0.88, backZ1, M.walnut);
  B.box(14.24, 0.0, backZ0, 17.76, 0.1, backZ1 - 0.06, M.shadowGap, { cast: false });
  for (let i = 1; i < 4; i++) B.box(14.2 + i * 0.9 - 0.003, 0.12, backZ1 - 0.002, 14.2 + i * 0.9 + 0.003, 0.86, backZ1 + 0.002, M.shadowGap, { cast: false });
  B.box(14.2, 0.88, backZ0, 17.8, 0.92, backZ1 + 0.02, ctx.islandMat);
  B.box(14.2, 0.92, backZ0, 17.8, 1.05, backZ0 + 0.02, ctx.islandMat);
  // sink + tap
  B.box(15.6, 0.9, -8.85, 16.4, 0.921, -8.5, M.steel, { cast: false });
  const tap = new THREE.TorusGeometry(0.12, 0.012, 8, 24, Math.PI);
  B.addTransformed(tap, M.blackAlu, { x: 16.0, y: 1.1, z: -8.83, ry: Math.PI / 2 });
  B.add(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 10).translate(16.0, 1.0, -8.95), M.blackAlu);
  // walnut bulkhead above window
  B.box(14.2, 2.25, backZ0, 17.8, H.ceiling, -8.6, M.walnut);
  nav.blockRect(12.1, -9.0, 20.0, backZ1 + 0.05);

  // ---- east wall tall pantry/appliance wall
  tallUnit(ctx, 19.35, 19.92, -8.35, -2.8, 'x');
  // built-in ovens (black glass) inset into tall unit
  B.box(19.33, 0.9, -6.9, 19.36, 1.5, -6.2, M.lacquerBlack);
  B.box(19.33, 1.55, -6.9, 19.36, 2.0, -6.2, M.lacquerBlack);
  B.box(19.325, 1.42, -6.85, 19.33, 1.44, -6.25, M.steel);
  nav.blockRect(19.25, -8.4, 20, -2.75);

  // ---- island: Grigio marble waterfall slab with walnut back cabinetry
  const ix0 = 14.0, ix1 = 18.6, iz0 = -5.05, iz1 = -3.85;
  const top = 0.94, th = 0.05;
  B.box(ix0, top - th, iz0, ix1, top, iz1, ctx.islandMat);
  B.box(ix0, 0, iz0, ix0 + th, top - th, iz1, ctx.islandMat);
  B.box(ix1 - th, 0, iz0, ix1, top - th, iz1, ctx.islandMat);
  B.box(ix0 + th, 0, iz1 - 0.02 - th, ix1 - th, top - th, iz1 - 0.02, ctx.islandMat);
  B.box(ix0 + th, 0.1, iz0 + 0.03, ix1 - th, top - th, iz1 - 0.3, M.walnut);
  B.box(ix0 + th, 0, iz0 + 0.06, ix1 - th, 0.1, iz1 - 0.3, M.shadowGap, { cast: false });
  // induction hob
  B.box(15.3, top, -4.85, 16.1, top + 0.006, -4.35, M.lacquerBlack, { cast: false });
  nav.blockRect(ix0 - 0.05, iz0 - 0.05, ix1 + 0.05, iz1 + 0.05);
  ctx.island = { x: (ix0 + ix1) / 2, z: (iz0 + iz1) / 2 };

  // bar stools on the dining side
  for (let i = 0; i < 4; i++) barStool(ctx, 14.75 + i * 1.05, iz1 + 0.42);

  // island styling
  B.add(new THREE.CylinderGeometry(0.2, 0.17, 0.08, 48, 1, true).translate(17.6, top + 0.04, -4.5), M.ceramic);
  B.add(new THREE.CylinderGeometry(0.17, 0.17, 0.005, 48).translate(17.6, top + 0.003, -4.5), M.ceramic);
  const fruit = new THREE.IcosahedronGeometry(0.04, 2);
  const r = rng(12);
  for (let i = 0; i < 6; i++) B.add(fruit.clone().translate(17.6 + (r() - 0.5) * 0.18, top + 0.05, -4.5 + (r() - 0.5) * 0.18), i % 2 ? M.foliage : M.brass);
  B.add(roundedBox(0.45, 0.025, 0.3, 0.01).translate(14.6, top + 0.013, -4.6), M.walnutDark);

  // pendants over the island: smoked glass cylinders on brass rods
  for (let i = 0; i < 3; i++) {
    const x = 14.9 + i * 1.4;
    B.add(new THREE.CylinderGeometry(0.006, 0.006, H.ceiling - 1.95, 6).translate(x, (H.ceiling + 1.95) / 2, -4.45), M.brass, { cast: false });
    B.add(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 40, 1, true).translate(x, 1.78, -4.45), M.smokedGlass, { cast: false });
    B.add(new THREE.SphereGeometry(0.05, 20, 12).translate(x, 1.72, -4.45), ctx.roomMat('kitchen', 'opal', 5), { cast: false });
  }
  ctx.downlights('kitchen', [[13.2, -6.5], [13.2, -2], [16, -7.6], [16, -1.6], [18.7, -1.6]], H.ceiling);
  ctx.spot('kitchen', 15.0, H.ceiling - 0.02, -4.45, 28);
  ctx.spot('kitchen', 17.6, H.ceiling - 0.02, -4.45, 28);
  ctx.spot('kitchen', 16.0, H.ceiling - 0.02, -8.0, 16);
  // under-cabinet LED strip
  B.box(14.2, 2.235, -8.98, 17.8, 2.25, -8.62, ctx.roomMat('kitchen', 'ledStrip', 3), { cast: false });
}

function tallUnit(ctx, a0, a1, b0, b1, axis) {
  const { batch: B, M } = ctx;
  if (axis === 'z') {
    B.box(a0, 0.1, b0, a1, H.ceiling - 0.05, b1, M.walnut);
    B.box(a0 + 0.04, 0.0, b0, a1 - 0.04, 0.1, b1 - 0.05, M.shadowGap, { cast: false });
    const n = Math.max(1, Math.round((a1 - a0) / 0.6));
    for (let i = 1; i < n; i++) {
      const x = a0 + (i * (a1 - a0)) / n;
      B.box(x - 0.003, 0.12, b1 - 0.002, x + 0.003, H.ceiling - 0.07, b1 + 0.002, M.shadowGap, { cast: false });
    }
    B.box(a0, 2.2, b1 - 0.002, a1, 2.206, b1 + 0.002, M.shadowGap, { cast: false });
  } else {
    B.box(a0, 0.1, b0, a1, H.ceiling - 0.05, b1, M.walnut);
    B.box(a0 + 0.05, 0.0, b0 + 0.04, a1, 0.1, b1 - 0.04, M.shadowGap, { cast: false });
    const n = Math.max(1, Math.round((b1 - b0) / 0.6));
    for (let i = 1; i < n; i++) {
      const z = b0 + (i * (b1 - b0)) / n;
      B.box(a0 - 0.002, 0.12, z - 0.003, a0 + 0.002, H.ceiling - 0.07, z + 0.003, M.shadowGap, { cast: false });
    }
    B.box(a0 - 0.002, 2.2, b0, a0 + 0.002, 2.206, b1, M.shadowGap, { cast: false });
  }
}

function barStool(ctx, x, z) {
  const { batch: B, M, nav } = ctx;
  B.add(roundedBox(0.42, 0.08, 0.4, 0.035, 3).translate(x, 0.68, z), M.leather);
  B.add(roundedBox(0.42, 0.18, 0.05, 0.02, 3).translate(x, 0.82, z + 0.19), M.leather);
  B.add(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 12).translate(x, 0.32, z), M.blackAlu);
  B.add(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 40).translate(x, 0.008, z), M.blackAlu);
  B.add(new THREE.TorusGeometry(0.16, 0.008, 6, 40).rotateX(Math.PI / 2).translate(x, 0.28, z), M.blackAlu);
  nav.blockCircle(x, z, 0.24);
}
