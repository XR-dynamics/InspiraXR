import * as THREE from 'three';
import { arcShape, extrudeShape, roundedBox, rng, projectUV } from './util.js';
import { H } from './layout.js';

/*
 * Living room, entrance hall and the shared decorative pieces used across rooms
 * (pillows, vases, plants, lamps). Proportions follow the reference photograph:
 * a pair of curved bouclé sofas around a two-tier round coffee table on a round
 * rug, beneath a cascading chandelier of glass globes in the double-height void.
 */

export const LIVING_CENTER = new THREE.Vector3(4.6, 0, 6.6);

export function buildLiving(ctx) {
  const { batch: B, M, nav } = ctx;
  const c = LIVING_CENTER;

  // ---- round rug
  const rugR = 2.35;
  const rug = new THREE.CylinderGeometry(rugR, rugR, 0.016, 128, 1);
  rug.translate(c.x, 0.008, c.z);
  B.add(rug, M.rug, { keepUV: true, cast: false });

  // ---- curved sofas (two opposed arcs)
  const sofaGroup = [];
  sofaGroup.push(curvedSofa(ctx, c, 1.62, 2.55, THREE.MathUtils.degToRad(208), THREE.MathUtils.degToRad(332)));
  sofaGroup.push(curvedSofa(ctx, c, 1.62, 2.55, THREE.MathUtils.degToRad(38), THREE.MathUtils.degToRad(142)));
  ctx.interact.material(sofaGroup.flat(), 'sofa');

  // pillows on the sofas, facing the centre
  const pillowMats = [M.linenDark, M.velvetTaupe, M.linenSlate, M.linenGrey, M.linenDark];
  const pr = rng(4);
  const placePillows = (angles, r) => {
    angles.forEach((deg, i) => {
      const a = THREE.MathUtils.degToRad(deg);
      const x = c.x + Math.cos(a) * r, z = c.z - Math.sin(a) * r;
      const geo = pillow(0.52 + pr() * 0.08, 0.48, 0.17);
      const ry = Math.atan2(c.x - x, c.z - z);
      B.addTransformed(geo, pillowMats[i % pillowMats.length], { x, y: 0.62, z, ry: ry + (pr() - 0.5) * 0.25, rx: -0.28, rz: (pr() - 0.5) * 0.12 });
    });
  };
  placePillows([216, 230, 244, 296, 310, 323], 2.22);
  placePillows([48, 64, 116, 132], 2.22);

  // folded throw on the far sofa
  const throwGeo = roundedBox(0.55, 0.06, 0.9, 0.025, 3);
  B.addTransformed(throwGeo, M.linenSlate, { x: c.x + Math.cos(1.57) * 2.0, y: 0.47, z: c.z - Math.sin(1.57) * 2.0, ry: 0.0 });

  nav.blockCircle(c.x, c.z, 0.85);
  // sofa footprints (arc sampled)
  for (const [a0, a1] of [[208, 332], [38, 142]]) {
    for (let d = a0; d <= a1; d += 6) {
      const a = THREE.MathUtils.degToRad(d);
      nav.blockCircle(c.x + Math.cos(a) * 2.08, c.z - Math.sin(a) * 2.08, 0.5);
    }
  }

  // ---- two-tier coffee table: black lacquer disc + brushed brass disc
  const t1 = new THREE.CylinderGeometry(0.7, 0.7, 0.05, 96);
  t1.translate(c.x - 0.12, 0.35, c.z + 0.05);
  B.add(t1, M.lacquerBlack);
  const t1b = new THREE.CylinderGeometry(0.66, 0.66, 0.3, 96, 1, true);
  t1b.translate(c.x - 0.12, 0.165, c.z + 0.05);
  B.add(t1b, M.bronze);
  const t2 = new THREE.CylinderGeometry(0.46, 0.46, 0.06, 96);
  t2.translate(c.x + 0.42, 0.42, c.z - 0.18);
  B.add(t2, M.brass);
  const t2b = new THREE.CylinderGeometry(0.43, 0.43, 0.39, 96, 1, true);
  t2b.translate(c.x + 0.42, 0.195, c.z - 0.18);
  B.add(t2b, M.lacquerBlack);

  // table styling: tray, books, vase with white flowers
  B.add(roundedBox(0.42, 0.03, 0.3, 0.01).translate(c.x + 0.4, 0.465, c.z - 0.12), M.leather);
  B.add(roundedBox(0.32, 0.05, 0.24, 0.005).translate(c.x - 0.35, 0.4, c.z + 0.25), M.paper);
  B.add(roundedBox(0.28, 0.04, 0.22, 0.005).translate(c.x - 0.35, 0.445, c.z + 0.25), M.linenSlate);
  vaseWithFlowers(ctx, c.x + 0.28, 0.45, c.z - 0.28, 0.9);

  // ---- ottoman / pouf near the glazing
  const pouf = new THREE.CylinderGeometry(0.34, 0.36, 0.4, 64);
  pouf.translate(1.25, 0.2, 9.4);
  B.add(pouf, M.boucle);
  nav.blockCircle(1.25, 9.4, 0.38);

  // ---- side tables with lamps at the sofa ends
  sideTable(ctx, c.x - 2.75, c.z + 0.2);
  sideTable(ctx, c.x + 2.75, c.z - 0.2);
  floorLamp(ctx, 'living', 1.0, 3.8);

  // ---- chandelier
  chandelier(ctx, new THREE.Vector3(4.2, H.roof, 5.4));

  // ---- fireplace wall (basalt) on the east wall, floating hearth bench
  B.box(11.3, 0.26, 4.6, 11.86, 0.4, 9.4, M.slate);
  B.box(11.36, 0.0, 4.66, 11.84, 0.26, 9.34, M.shadowGap, { cast: false });
  nav.blockRect(11.2, 4.5, 12, 9.5);
  fireplace(ctx, 11.84, 0.62, 7.0, 2.8, 0.42);
  // sculptural objects on the hearth
  const urn = new THREE.LatheGeometry(lathe([[0, 0], [0.12, 0.01], [0.17, 0.15], [0.12, 0.38], [0.07, 0.42], [0.075, 0.46], [0, 0.46]]), 48);
  urn.translate(11.58, 0.4, 5.2);
  B.add(urn, M.ceramicDark);
  const bowl = new THREE.LatheGeometry(lathe([[0, 0], [0.14, 0.01], [0.2, 0.09], [0.19, 0.1], [0, 0.03]]), 48);
  bowl.translate(11.58, 0.4, 8.9);
  B.add(bowl, M.ceramic);

  // ---- large plant by the glazing
  plant(ctx, 1.0, 11.0, 1.0);
  plant(ctx, 8.4, 0.9, 0.85);

  // ---- entrance hall: console, art, bench, mirror pendant
  B.box(3.7, 0.0, 13.2, 4.15, 0.82, 15.4, M.walnut);
  B.box(3.68, 0.82, 13.15, 4.2, 0.86, 15.45, M.darkMarble);
  nav.blockRect(3.5, 13.0, 4.3, 15.6);
  // art above console (on west foyer wall)
  // (west foyer wall has a slot window; art goes on the east wall)
  B.box(8.44, 1.2, 13.0, 8.5, 3.6, 15.6, M.blackMatte);
  B.add(new THREE.PlaneGeometry(2.5, 2.3).rotateY(-Math.PI / 2).translate(8.43, 2.4, 14.3), M.art, { keepUV: true });
  vaseWithFlowers(ctx, 3.92, 0.86, 13.7, 1.2);
  B.add(new THREE.LatheGeometry(lathe([[0, 0], [0.1, 0.0], [0.13, 0.12], [0.07, 0.3], [0, 0.3]]), 32).translate(3.92, 0.86, 14.9), M.ceramicDark);
  // foyer floor: inset stone mat in darker marble
  B.box(4.6, 0.0, 15.0, 7.4, 0.004, 16.3, M.slate, { cast: false });
  // grand pendant over the entrance: ring of opal globes
  const ringR = 0.8;
  const opalG = new THREE.SphereGeometry(0.09, 32, 16);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = 6 + Math.cos(a) * ringR, z = 14.2 + Math.sin(a) * ringR;
    const yy = 4.6 - (i % 2) * 0.25;
    B.add(opalG.clone().translate(x, yy, z), ctx.roomMat('foyer', 'opal', 3.0), { cast: false });
    B.add(new THREE.CylinderGeometry(0.003, 0.003, H.roof - yy, 4).translate(x, (H.roof + yy) / 2, z), M.brass, { cast: false });
  }
  const fl = new THREE.PointLight(0xffd5a1, 0, 9, 2);
  fl.position.set(6, 4.3, 14.2);
  ctx.lighting.addLight('foyer', fl, 14);

  // ceiling downlights in living soffit zone and foyer
  ctx.downlights('living', [[10.5, 1.6], [10.5, 4.4], [10.5, 7.4], [10.5, 10.4]], H.ceiling);
  ctx.downlights('living', [[2, 2], [4.5, 2], [7, 2], [2, 10], [4.5, 10], [7, 10]], H.roof - 0.16);
  ctx.downlights('foyer', [[4.3, 13.0], [7.7, 13.0], [4.3, 15.8], [7.7, 15.8]], H.roof);
}

function curvedSofa(ctx, c, r0, r1, a0, a1) {
  const { M, scene } = ctx;
  const parts = [];
  const add = (shape, y0, y1, bevel, mat) => {
    const g = extrudeShape(shape, y0, y1, bevel, 96);
    g.translate(c.x, 0, c.z);
    projectUV(g);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    parts.push(m);
    return m;
  };
  const da = 0.012;
  // recessed plinth
  const plinth = extrudeShape(arcShape(r0 + 0.08, r1 - 0.08, a0 + 0.02, a1 - 0.02, 96), 0, 0.06, 0, 96);
  plinth.translate(c.x, 0, c.z);
  ctx.batch.add(plinth, M.shadowGap, { cast: false });
  // seat base, seat cushion, back cushion and arm-less rounded ends
  add(arcShape(r0, r1, a0, a1), 0.05, 0.27, 0.035, M.boucle);
  // individual seat cushions (about 0.95 m each at the front edge) with soft seams
  const n = Math.max(2, Math.round(((a1 - a0) * r0) / 0.95));
  const gap = 0.012 / r0;
  for (let i = 0; i < n; i++) {
    const s0 = a0 + ((a1 - a0) * i) / n + (i ? gap : da);
    const s1 = a0 + ((a1 - a0) * (i + 1)) / n - (i < n - 1 ? gap : da);
    add(arcShape(r0 + 0.03, r1 - 0.31, s0, s1, 40), 0.27, 0.43, 0.065, M.boucle);
  }
  // continuous back, with a thin welt line where it meets the base
  add(arcShape(r1 - 0.3, r1, a0, a1), 0.28, 0.74, 0.095, M.boucle);
  return parts;
}

function pillow(w, h, d) {
  const g = roundedBox(w, h, d, Math.min(d / 2 - 0.005, 0.07), 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nx = x / (w / 2), ny = y / (h / 2);
    const k = (1 - nx * nx) * (1 - ny * ny);
    p.setZ(i, z * (0.35 + 0.65 * k));
    p.setX(i, x * (1 - 0.06 * ny * ny));
    p.setY(i, y * (1 - 0.06 * nx * nx));
  }
  g.computeVertexNormals();
  return g;
}

export function lathe(pts) {
  return pts.map(([r, y]) => new THREE.Vector2(r, y));
}

export function vaseWithFlowers(ctx, x, y, z, s = 1) {
  const { batch: B, M } = ctx;
  const v = new THREE.LatheGeometry(lathe([[0, 0], [0.07, 0.0], [0.09, 0.08], [0.06, 0.2], [0.05, 0.24], [0, 0.24]].map(([r, h]) => [r * s, h * s])), 40);
  v.translate(x, y, z);
  B.add(v, M.ceramic);
  const r = rng(Math.floor(x * 100 + z * 10));
  const bloom = new THREE.IcosahedronGeometry(0.045 * s, 2);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = r() * 0.09 * s;
    const hy = y + (0.3 + r() * 0.12) * s;
    B.add(bloom.clone().scale(1, 0.75, 1).translate(x + Math.cos(a) * d, hy, z + Math.sin(a) * d), M.flowerWhite);
    B.add(new THREE.CylinderGeometry(0.003, 0.003, hy - y - 0.1 * s, 3).translate(x + Math.cos(a) * d * 0.5, (hy + y + 0.1 * s) / 2, z + Math.sin(a) * d * 0.5), M.foliage, { cast: false });
  }
  const leaf = new THREE.PlaneGeometry(0.16 * s, 0.16 * s);
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    B.addTransformed(leaf.clone(), M.leaves, { x: x + Math.cos(a) * 0.08 * s, y: y + 0.3 * s, z: z + Math.sin(a) * 0.08 * s, ry: a, rx: -0.6, keepUV: true });
  }
}

function sideTable(ctx, x, z) {
  const { batch: B, M, nav } = ctx;
  B.add(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 64).translate(x, 0.55, z), M.darkMarble);
  B.add(new THREE.CylinderGeometry(0.035, 0.035, 0.53, 16).translate(x, 0.27, z), M.brass);
  B.add(new THREE.CylinderGeometry(0.18, 0.18, 0.015, 48).translate(x, 0.008, z), M.brass);
  // table lamp
  const base = new THREE.LatheGeometry(lathe([[0, 0], [0.09, 0], [0.11, 0.1], [0.05, 0.3], [0.02, 0.36], [0, 0.36]]), 32);
  B.add(base.translate(x, 0.565, z), M.ceramicDark);
  nav.blockCircle(x, z, 0.28);
}

export function floorLamp(ctx, room, x, z) {
  const { batch: B, M } = ctx;
  B.add(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 48).translate(x, 0.01, z), M.blackAlu);
  B.add(new THREE.CylinderGeometry(0.012, 0.012, 1.55, 12).translate(x, 0.8, z), M.brass);
  const shade = new THREE.CylinderGeometry(0.2, 0.24, 0.32, 48, 1, true);
  B.add(shade.translate(x, 1.62, z), ctx.roomMat(room, 'lampShade', 1.6), { cast: false });
  const l = new THREE.PointLight(0xffcf95, 0, 6, 2);
  l.position.set(x, 1.55, z);
  ctx.lighting.addLight(room, l, 3.5);
  ctx.nav.blockCircle(x, z, 0.22);
}

function chandelier(ctx, top) {
  const { M, scene } = ctx;
  const r = rng(11);
  const count = 84;
  const sphere = new THREE.SphereGeometry(1, 32, 20);
  const mats = [ctx.roomMat('living', 'opal', 4.5), M.clearSphere, M.smokeSphere];
  const inst = mats.map((m) => new THREE.InstancedMesh(sphere, m, count));
  const wires = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5, 1, true), M.brass, count);
  const n = [0, 0, 0];
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    // spiral cascade: denser at the centre, longer drops towards the middle
    const a = i * 2.39996 + r() * 0.3;
    const d = Math.sqrt(i / count) * 1.15;
    const x = top.x + Math.cos(a) * d, z = top.z + Math.sin(a) * d;
    const drop = 0.7 + (1 - d / 1.15) * 3.3 + r() * 0.9;
    const y = top.y - drop;
    const kind = r() < 0.45 ? 0 : r() < 0.6 ? 1 : 2;
    const rad = kind === 0 ? 0.07 + r() * 0.035 : 0.06 + r() * 0.05;
    mtx.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(rad, rad, rad));
    inst[kind].setMatrixAt(n[kind]++, mtx);
    mtx.compose(new THREE.Vector3(x, (top.y + y + rad) / 2, z), new THREE.Quaternion(), new THREE.Vector3(0.0022, top.y - y - rad, 0.0022));
    wires.setMatrixAt(i, mtx);
  }
  inst.forEach((m, k) => { m.count = n[k]; m.castShadow = k === 0; m.receiveShadow = false; scene.add(m); m.renderOrder = 2; });
  wires.castShadow = false;
  scene.add(wires);
  // ceiling canopy
  ctx.batch.add(new THREE.CylinderGeometry(0.42, 0.42, 0.025, 64).translate(top.x, top.y - 0.17, top.z), M.ceiling, { cast: false });
  const l1 = new THREE.PointLight(0xffd29c, 0, 16, 2);
  l1.position.set(top.x, top.y - 2.8, top.z);
  ctx.lighting.addLight('living', l1, 55);
}

function fireplace(ctx, x, y, z, len, h) {
  const { batch: B, M, scene } = ctx;
  B.box(x - 0.36, y, z - len / 2, x, y + h, z + len / 2, M.shadowGap, { cast: false });
  B.box(x - 0.4, y - 0.02, z - len / 2 - 0.02, x - 0.36, y + h + 0.02, z + len / 2 + 0.02, M.blackAlu);
  // bed of stones
  const r = rng(3);
  const pebble = new THREE.IcosahedronGeometry(0.04, 1);
  for (let i = 0; i < 70; i++) {
    B.addTransformed(pebble.clone(), M.ceramicDark, { x: x - 0.18 + (r() - 0.5) * 0.24, y: y + 0.02, z: z + (r() - 0.5) * (len - 0.2), s: 0.7 + r() * 0.6, ry: r() * 6 });
  }
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, level: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float time; uniform float level;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+1.),f.x), f.y); }
      void main(){
        vec2 uv = vUv;
        float t = time * 1.6;
        float q = n(vec2(uv.x * 18.0, uv.y * 3.0 - t * 2.0)) * 0.6 + n(vec2(uv.x * 40.0, uv.y * 6.0 - t * 3.5)) * 0.4;
        float shape = smoothstep(0.0, 0.25, uv.y) * (1.0 - smoothstep(0.15 + q * 0.75, 0.2 + q * 0.85, uv.y));
        shape *= smoothstep(0.0, 0.04, uv.x) * smoothstep(1.0, 0.96, uv.x);
        vec3 c = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.8, 0.45), smoothstep(0.0, 0.4, 1.0 - uv.y) * q);
        gl_FragColor = vec4(c * shape * 3.2 * level, 1.0);
      }`,
  });
  const g = new THREE.PlaneGeometry(len - 0.12, h - 0.06).rotateY(-Math.PI / 2);
  const flame = new THREE.Mesh(g, mat);
  flame.position.set(x - 0.2, y + h / 2 + 0.01, z);
  scene.add(flame);
  ctx.animated.push((dt, t) => { mat.uniforms.time.value = t; });
  const glow = new THREE.PointLight(0xff9a4a, 0, 7, 2);
  glow.position.set(x - 0.7, y + 0.25, z);
  ctx.lighting.addLight('fire', glow, 6);
  ctx.lighting.addFlicker(glow);
  ctx.fire = { mat, glow };
  ctx.interact.add(flame, {
    label: () => (ctx.lighting.isOn('fire') ? 'Extinguish fireplace' : 'Light fireplace'),
    action: () => { ctx.lighting.toggleRoom('fire'); },
  });
  ctx.animated.push(() => { mat.uniforms.level.value = ctx.lighting.room('fire').level; flame.visible = mat.uniforms.level.value > 0.01; });
}

export function plant(ctx, x, z, s = 1) {
  const { batch: B, M, nav } = ctx;
  // tall ribbed planter
  const pot = new THREE.LatheGeometry(lathe([[0, 0], [0.24, 0], [0.3, 0.05], [0.32, 0.62], [0.3, 0.64], [0, 0.6]].map(([r, h]) => [r * s, h * s])), 48);
  B.add(pot.translate(x, 0, z), M.ceramicDark);
  B.add(new THREE.CylinderGeometry(0.29 * s, 0.29 * s, 0.01, 32).translate(x, 0.6 * s, z), M.soil);
  const r = rng(Math.floor(x * 31 + z * 7));
  // olive-like multi-stem tree
  const stems = 3;
  for (let i = 0; i < stems; i++) {
    const a = (i / stems) * Math.PI * 2 + r();
    const lean = 0.12 + r() * 0.1;
    const len = (1.4 + r() * 0.5) * s;
    const g = new THREE.CylinderGeometry(0.015 * s, 0.03 * s, len, 8);
    g.translate(0, len / 2, 0);
    B.addTransformed(g, M.bark, { x, y: 0.6 * s, z, rz: Math.cos(a) * lean, rx: Math.sin(a) * lean });
  }
  const card = new THREE.PlaneGeometry(0.55 * s, 0.55 * s);
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.55 * s;
    const y = (1.5 + r() * 1.1) * s;
    B.addTransformed(card.clone(), M.leaves, {
      x: x + Math.cos(a) * d, y, z: z + Math.sin(a) * d, ry: r() * Math.PI * 2, rx: (r() - 0.5) * 1.6, rz: (r() - 0.5) * 0.8, keepUV: true, cast: true,
    });
  }
  nav.blockCircle(x, z, 0.36 * s);
}
