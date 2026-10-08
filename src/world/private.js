import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { roundedBox, rng } from './util.js';
import { H } from './layout.js';
import { lathe, vaseWithFlowers, plant, floorLamp } from './living.js';

/*
 * Private wing: hallway, master suite with spa bathroom, second bedroom and
 * guest bathroom.
 */

export function buildHall(ctx) {
  const { batch: B, M, nav } = ctx;
  // gallery-style art along the kitchen wall side of the hall
  const arts = [[15.0, M.art], [18.2, M.art2]];
  for (const [x, mat] of arts) {
    B.box(x - 0.85, 1.0, 0.1, x + 0.85, 2.25, 0.13, M.blackMatte);
    B.add(new THREE.PlaneGeometry(1.6, 1.15).translate(x, 1.625, 0.131), mat, { keepUV: true });
  }
  // floating walnut console with sculpture
  B.box(22.4, 0.62, 0.1, 25.2, 0.78, 0.48, M.walnut);
  nav.blockRect(22.3, 0.08, 25.3, 0.52);
  B.add(new THREE.LatheGeometry(lathe([[0, 0], [0.12, 0], [0.16, 0.18], [0.1, 0.42], [0.05, 0.48], [0, 0.48]]), 40).translate(23.0, 0.78, 0.3), M.ceramicDark);
  B.add(new THREE.TorusKnotGeometry(0.11, 0.035, 120, 16, 2, 3).translate(24.4, 0.97, 0.3), M.brass);
  // runner rug
  B.box(13.2, 0.0, 0.75, 29.4, 0.012, 1.65, M.woolDark, { cast: false });
  ctx.downlights('hall', [[13.5, 1.2], [16, 1.2], [18.5, 1.2], [21, 1.2], [23.5, 1.2], [26, 1.2], [28.5, 1.2]], H.hall);
  ctx.spot('hall', 16.6, H.hall - 0.02, 1.2, 14);
  ctx.spot('hall', 23.8, H.hall - 0.02, 1.2, 14);
  // light cove LED along the dropped ceiling edges
  B.box(12.0, H.hall + 0.02, 0.0, 30, H.hall + 0.035, 0.06, ctx.roomMat('hall', 'ledStrip', 1.5), { cast: false });
  B.box(12.0, H.hall + 0.02, 2.34, 30, H.hall + 0.035, 2.4, ctx.roomMat('hall', 'ledStrip', 1.5), { cast: false });
}

export function buildMaster(ctx) {
  const { batch: B, M, nav } = ctx;
  // feature wall behind the bed: walnut with upholstered headboard
  B.box(21.86, 0, 4.6, 21.92, H.ceiling, 11.9, M.walnut);
  B.add(roundedBox(0.12, 1.25, 3.0, 0.04, 3).translate(21.78, 0.95, 8.0), M.velvetTaupe);
  const bx0 = 19.45, bx1 = 21.72, bz0 = 7.0, bz1 = 9.0;
  bed(ctx, bx0, bx1, bz0, bz1, M.linenWhite, M.linenSand);
  for (const z of [6.25, 9.75]) {
    nightstand(ctx, 21.55, z, -Math.PI / 2);
    pendantLamp(ctx, 'master', 21.4, z, 1.35);
  }
  // rug
  B.add(roundedBox(4.4, 0.016, 3.6, 0.008, 2).translate(19.6, 0.008, 8.0), M.wool, { cast: false });
  // bench at the foot of the bed
  B.add(roundedBox(0.45, 0.42, 1.7, 0.05, 3).translate(19.05, 0.23, 8.0), M.velvetTaupe);
  nav.blockRect(18.8, 7.1, 19.3, 8.9);
  // media wall on the west (x=12): walnut panel, black TV, floating console
  B.box(12.1, 0, 4.0, 12.14, H.ceiling, 11.0, M.walnut);
  B.box(12.14, 1.15, 5.9, 12.19, 2.15, 7.68, M.screen);
  B.box(12.1, 0.3, 4.8, 12.55, 0.62, 8.8, M.walnutDark);
  nav.blockRect(12.0, 4.7, 12.6, 8.9);
  // lounge chair + side table by the window
  loungeChair(ctx, 14.6, 10.6, Math.PI * 0.8);
  B.add(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 40).translate(15.5, 0.25, 11.2), M.darkMarble);
  nav.blockCircle(15.5, 11.2, 0.25);
  floorLamp(ctx, 'master', 13.6, 11.3);
  plant(ctx, 20.9, 11.2, 0.8);
  // window curtain (sheer) handled by interactions
  ctx.downlights('master', [[14.5, 4], [17, 4], [14.5, 10], [19.5, 4.5], [19.5, 11.0]], H.ceiling);
  ctx.spot('master', 17.0, H.ceiling - 0.02, 7.5, 24);
  // LED cove behind headboard
  B.box(21.84, 1.6, 6.5, 21.86, 1.62, 9.5, ctx.roomMat('master', 'ledStrip', 2), { cast: false });
}

export function buildBedroom(ctx) {
  const { batch: B, M, nav } = ctx;
  // upholstered linen wall panels behind the bed
  for (let i = 0; i < 6; i++) {
    B.add(roundedBox(0.05, H.ceiling - 0.1, 0.88, 0.02, 2).translate(25.895, H.ceiling / 2, -7.15 + i * 0.9 + 0.44), M.linenSand);
  }
  B.add(roundedBox(0.1, 1.1, 1.9, 0.04, 3).translate(25.82, 0.85, -4.5), M.linenGrey);
  bed(ctx, 23.7, 25.77, -5.3, -3.7, M.linenWhite, M.linenSlate);
  for (const z of [-6.0, -3.0]) {
    nightstand(ctx, 25.6, z, -Math.PI / 2);
    pendantLamp(ctx, 'bedroom', 25.45, z, 1.3);
  }
  B.add(roundedBox(3.2, 0.016, 2.6, 0.008, 2).translate(24.0, 0.008, -4.5), M.woolDark, { cast: false });
  // wardrobe along the west wall
  B.box(20.08, 0.08, -8.9, 20.7, H.ceiling - 0.05, -4.2, M.walnut);
  for (let i = 1; i < 8; i++) B.box(20.698, 0.1, -8.9 + i * 0.6 - 0.003, 20.702, H.ceiling - 0.07, -8.9 + i * 0.6 + 0.003, M.shadowGap, { cast: false });
  nav.blockRect(20.0, -9.0, 20.8, -4.1);
  // desk under the window
  B.box(22.2, 0.73, -8.95, 24.0, 0.76, -8.35, M.oak);
  B.box(22.2, 0, -8.95, 22.25, 0.73, -8.35, M.oak);
  B.box(23.95, 0, -8.95, 24.0, 0.73, -8.35, M.oak);
  nav.blockRect(22.1, -9.0, 24.1, -8.3);
  B.add(roundedBox(0.46, 0.08, 0.46, 0.03).translate(23.1, 0.46, -7.95), M.leather);
  B.add(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 8).translate(23.1, 0.21, -7.95), M.blackAlu);
  vaseWithFlowers(ctx, 23.7, 0.76, -8.6, 0.7);
  ctx.downlights('bedroom', [[21.5, -7.5], [21.5, -2], [24, -1.5]], H.ceiling);
  ctx.spot('bedroom', 23.0, H.ceiling - 0.02, -5.5, 18);
}

export function buildMasterBath(ctx) {
  const { batch: B, M, nav, scene } = ctx;
  // marble cladding on the vanity wall (hall wall z=2.4)
  B.box(22.08, 0, 2.48, 29.92, H.ceiling, 2.5, M.whiteMarble);
  // floating vanity with double basins
  B.box(24.4, 0.42, 2.5, 28.6, 0.82, 3.08, M.walnut);
  B.box(24.38, 0.82, 2.5, 28.62, 0.86, 3.1, M.whiteMarble);
  for (const x of [25.4, 27.6]) {
    const basin = new THREE.LatheGeometry(lathe([[0, 0.0], [0.18, 0.0], [0.22, 0.04], [0.22, 0.13], [0.2, 0.135], [0.17, 0.03], [0, 0.03]]), 48);
    B.add(basin.translate(x, 0.86, 2.82), M.ceramic);
    B.add(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 10).rotateX(Math.PI / 2).translate(x, 1.12, 2.62), M.brass);
    B.add(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 16).rotateX(Math.PI / 2).translate(x, 1.12, 2.52), M.brass);
  }
  nav.blockRect(24.3, 2.4, 28.7, 3.15);
  // mirror (real-time reflection) with LED halo
  const mirror = new Reflector(new THREE.PlaneGeometry(4.0, 1.25), {
    clipBias: 0.003, textureWidth: 1024, textureHeight: 320, color: 0xbcbcbc,
  });
  mirror.position.set(26.5, 1.75, 2.515);
  scene.add(mirror);
  ctx.mirrors.push(mirror);
  B.box(24.45, 1.1, 2.5, 28.55, 1.112, 2.512, ctx.roomMat('masterBath', 'ledStrip', 2.5), { cast: false });
  B.box(24.45, 2.388, 2.5, 28.55, 2.4, 2.512, ctx.roomMat('masterBath', 'ledStrip', 2.5), { cast: false });

  // freestanding tub by the east window
  const tub = new THREE.LatheGeometry(lathe([[0, 0], [0.62, 0], [0.82, 0.08], [0.9, 0.5], [0.88, 0.56], [0.8, 0.56], [0.78, 0.15], [0, 0.12]]), 72);
  tub.scale(1.0, 1.0, 0.52);
  tub.translate(28.4, 0.0, 7.2);
  tub.rotateY(0);
  const tubG = tub.clone();
  // stretch along z: rotate so long axis follows the window
  tubG.translate(-28.4, 0, -7.2).rotateY(Math.PI / 2).scale(1.0, 1, 1).translate(28.4, 0, 7.2);
  B.add(tubG, M.ceramic);
  nav.blockOriented(28.4, 7.2, 1.0, 1.85, 0);
  // floor-standing brass filler
  B.add(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 12).translate(27.5, 0.5, 7.2), M.brass);
  B.add(new THREE.TorusGeometry(0.1, 0.018, 8, 20, Math.PI).rotateY(Math.PI / 2).translate(27.5, 1.0, 7.3), M.brass);
  // stool with towels
  B.add(new THREE.CylinderGeometry(0.18, 0.2, 0.45, 32).translate(27.3, 0.225, 8.8), M.oak);
  B.add(roundedBox(0.3, 0.08, 0.3, 0.03).translate(27.3, 0.49, 8.8), M.linenWhite);
  nav.blockCircle(27.3, 8.8, 0.22);
  plant(ctx, 29.4, 11.4, 0.7);

  // walk-in shower: marble walls, glass partition, rain head
  B.box(22.08, 0, 9.2, 22.1, H.ceiling, 11.92, M.whiteMarble);
  B.box(22.08, 0, 11.9, 25.0, H.ceiling, 11.92, M.whiteMarble);
  ctx.glass.push(new THREE.BoxGeometry(0.012, 2.3, 2.6).translate(24.6, 1.17, 10.6));
  B.box(24.59, 2.3, 9.3, 24.61, 2.34, 11.9, M.brass);
  B.box(22.1, 0.0, 9.3, 24.6, 0.02, 11.9, M.slate, { cast: false });
  B.add(new THREE.CylinderGeometry(0.18, 0.18, 0.015, 48).translate(23.3, 2.5, 10.6), M.brass);
  B.add(new THREE.CylinderGeometry(0.01, 0.01, 0.9, 8).translate(23.3, 2.95, 10.6), M.brass);
  B.box(22.1, 1.0, 10.0, 22.4, 1.02, 11.2, M.whiteMarble);
  nav.blockRect(24.5, 9.2, 24.7, 11.95);
  nav.blockRect(22.0, 9.2, 24.7, 9.3);
  // WC (wall hung) on the west wall
  wc(ctx, 22.1, 6.0, Math.PI / 2);
  ctx.downlights('masterBath', [[23.5, 4.5], [26.5, 5.0], [29, 4.5], [26.5, 9.5], [23.3, 10.6]], H.ceiling);
  ctx.spot('masterBath', 26.5, H.ceiling - 0.02, 3.8, 18);
  ctx.spot('masterBath', 28.4, H.ceiling - 0.02, 7.2, 18);
}

export function buildGuestBath(ctx) {
  const { batch: B, M, nav } = ctx;
  B.box(29.9, 0, -8.98, 29.92, H.ceiling, -0.08, M.whiteMarble);
  B.box(26.08, 0, -8.92, 29.92, H.ceiling, -8.9, M.whiteMarble);
  // vanity on the east wall
  B.box(29.35, 0.45, -4.1, 29.9, 0.85, -2.3, M.walnut);
  B.box(29.33, 0.85, -4.12, 29.9, 0.88, -2.28, M.slate);
  const basin = new THREE.CylinderGeometry(0.2, 0.18, 0.14, 48);
  B.add(basin.translate(29.55, 0.95, -3.2), M.ceramic);
  B.add(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 10).rotateZ(Math.PI / 2).translate(29.8, 1.12, -3.2), M.blackAlu);
  nav.blockRect(29.3, -4.15, 30, -2.25);
  const mirror = new THREE.CylinderGeometry(0.5, 0.5, 0.02, 64).rotateZ(Math.PI / 2).translate(29.88, 1.7, -3.2);
  B.add(mirror, ctx.bronzeMirror, { cast: false });
  wc(ctx, 29.9, -5.6, -Math.PI / 2);
  // shower at the north end
  ctx.glass.push(new THREE.BoxGeometry(2.4, 2.3, 0.012).translate(27.3, 1.17, -6.9));
  B.box(26.1, 0.0, -8.9, 29.9, 0.02, -6.9, M.slate, { cast: false });
  B.add(new THREE.CylinderGeometry(0.14, 0.14, 0.015, 40).translate(28.0, 2.4, -8.0), M.blackAlu);
  nav.blockRect(26.0, -6.95, 28.5, -6.85);
  ctx.downlights('bath', [[28.0, -2.5], [28.0, -5.5], [28.0, -8.0]], H.ceiling);
  ctx.spot('bath', 29.0, H.ceiling - 0.02, -3.2, 12);
}

function bed(ctx, x0, x1, z0, z1, sheet, throwMat) {
  const { batch: B, M, nav } = ctx;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, L = x1 - x0, W = z1 - z0;
  // upholstered platform
  B.add(roundedBox(L, 0.3, W + 0.1, 0.04, 3).translate(cx, 0.2, cz), M.velvetTaupe);
  B.box(x0 + 0.1, 0, z0 + 0.1, x1 - 0.1, 0.05, z1 - 0.1, M.shadowGap, { cast: false });
  // mattress + duvet with soft rounded edges
  B.add(roundedBox(L - 0.06, 0.24, W - 0.02, 0.08, 4).translate(cx, 0.47, cz), sheet);
  const duvet = roundedBox(L * 0.72, 0.1, W + 0.06, 0.05, 4);
  const p = duvet.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin(p.getX(i) * 9.0) * 0.008 + Math.sin(p.getZ(i) * 7.0) * 0.006);
  duvet.computeVertexNormals();
  B.add(duvet.translate(x0 + L * 0.36, 0.62, cz), sheet);
  // folded throw at the foot
  B.add(roundedBox(0.5, 0.05, W + 0.12, 0.024, 3).translate(x0 + 0.38, 0.69, cz), throwMat);
  // pillows at the head
  const pil = roundedBox(0.2, 0.42, 0.66, 0.09, 4);
  const n = W > 1.8 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const z = z0 + (i + 0.5) * (W / n);
    B.addTransformed(pil.clone(), sheet, { x: x1 - 0.22, y: 0.77, z, rz: 0.22 });
  }
  B.addTransformed(roundedBox(0.16, 0.36, 0.5, 0.07, 4), throwMat, { x: x1 - 0.38, y: 0.75, z: cz, rz: 0.25 });
  nav.blockRect(x0 - 0.05, z0 - 0.08, x1 + 0.2, z1 + 0.08);
}

function nightstand(ctx, x, z) {
  const { batch: B, M, nav } = ctx;
  B.box(x - 0.25, 0.3, z - 0.32, x + 0.25, 0.58, z + 0.32, M.walnut);
  B.box(x - 0.26, 0.58, z - 0.33, x + 0.26, 0.6, z + 0.33, M.darkMarble);
  B.add(roundedBox(0.16, 0.04, 0.22, 0.004).translate(x, 0.62, z - 0.12), M.paper);
  nav.blockRect(x - 0.27, z - 0.34, x + 0.27, z + 0.34);
}

function pendantLamp(ctx, room, x, z, y) {
  const { batch: B, M } = ctx;
  B.add(new THREE.CylinderGeometry(0.003, 0.003, H.ceiling - y, 4).translate(x, (H.ceiling + y) / 2, z), M.blackAlu, { cast: false });
  B.add(new THREE.SphereGeometry(0.11, 32, 20).translate(x, y, z), ctx.roomMat(room, 'opal', 3.5), { cast: false });
  const l = new THREE.PointLight(0xffd2a0, 0, 4.5, 2);
  l.position.set(x - 0.15, y - 0.12, z);
  ctx.lighting.addLight(room, l, 1.6);
}

function loungeChair(ctx, x, z, ry) {
  const { batch: B, M, nav } = ctx;
  B.addTransformed(roundedBox(0.78, 0.16, 0.74, 0.06, 3), M.boucle, { x, y: 0.36, z, ry });
  const bx = x - Math.sin(ry) * 0.32, bz = z - Math.cos(ry) * 0.32;
  B.addTransformed(roundedBox(0.8, 0.62, 0.16, 0.07, 3), M.boucle, { x: bx, y: 0.68, z: bz, ry, rx: -0.18 });
  for (const s of [-1, 1]) {
    const ax = x + Math.cos(ry) * 0.38 * s, az = z - Math.sin(ry) * 0.38 * s;
    B.addTransformed(roundedBox(0.06, 0.24, 0.7, 0.025, 3), M.walnut, { x: ax, y: 0.5, z: az, ry });
    B.addTransformed(roundedBox(0.04, 0.3, 0.7, 0.015, 2), M.walnut, { x: ax, y: 0.15, z: az, ry });
  }
  nav.blockCircle(x, z, 0.5);
}

function wc(ctx, x, z, ry) {
  const { batch: B, M, nav } = ctx;
  const off = Math.sin(ry) * 0.3, offz = Math.cos(ry) * 0.3;
  B.addTransformed(roundedBox(0.38, 0.32, 0.56, 0.12, 4), M.ceramic, { x: x + off, y: 0.4, z: z + offz, ry });
  B.addTransformed(roundedBox(0.38, 0.03, 0.54, 0.012, 3), M.ceramic, { x: x + off, y: 0.575, z: z + offz, ry });
  // flush plate
  B.addTransformed(roundedBox(0.22, 0.14, 0.01, 0.004, 2), M.brass, { x: x + Math.sin(ry) * 0.012, y: 1.05, z: z + Math.cos(ry) * 0.012, ry });
  nav.blockCircle(x + off * 1.1, z + offz * 1.1, 0.32);
}
