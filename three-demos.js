/* =========================================================================
   InspiraXR — real-time 3D demos (Three.js, loaded lazily)
   1) Finish explorer: a small room with switchable finishes and day / night
   2) Museum viewer: procedurally modelled study objects you can rotate
   ========================================================================= */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- procedural textures (canvas) ---------- */
function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y, o = 4) { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= .5; } return s; }
const mix = (a, b, t) => a + (b - a) * t;

function makeTex(draw, size = 512, rep = [1, 1]) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), img = g.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const [r, gg, b] = draw(x, y, size); const i = (y * size + x) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 4; return t;
}
const TEX = {
  travertine: () => makeTex((x, y) => { const n = fbm(x * .006, y * .5, 3), p = fbm(x * .05, y * .05, 2), k = .78 + .22 * n - (p > .78 ? .12 : 0); return [226 * k, 211 * k, 186 * k]; }, 512, [1.6, 1]),
  walnut: () => makeTex((x, y) => { const slat = Math.floor(x / 64), lx = x % 64, gap = lx < 2 || lx > 61 ? .25 : 1; const t = fbm((x + slat * 91) * .03, y * .004, 4), k = (.55 + .6 * t) * gap; return [104 * k, 66 * k, 40 * k]; }, 512, [1.5, 1]),
  marble: () => makeTex((x, y) => { const n = fbm(x * .004, y * .004, 5), v = Math.abs(Math.sin((x * .5 + y * .22) * .012 + n * 9)); const vein = Math.pow(1 - v, 14); const base = 26 + 10 * fbm(x * .02, y * .02, 3); const k = base + vein * 175; return [k, k + 1, k + 4]; }, 512, [1.2, 1]),
  plaster: () => makeTex((x, y) => { const n = fbm(x * .02, y * .02, 4), k = .9 + .1 * n; return [206 * k, 201 * k, 192 * k]; }, 256, [3, 2]),
  floorMarble: () => makeTex((x, y) => { const n = fbm(x * .005, y * .005, 5), v = Math.abs(Math.sin((x * .6 - y * .4) * .01 + n * 8)); const vein = Math.pow(1 - v, 16) * 70; const k = 224 + 12 * n - vein; return [k, k - 1, k - 5]; }, 512, [2.4, 2]),
  oak: () => makeTex((x, y) => { const row = Math.floor(y / 64), ly = y % 64, off = hash(row, 3) * 400, gap = ly < 2 ? .3 : 1; const t = fbm((x + off) * .006, y * .3, 4), tone = .8 + hash(Math.floor((x + off) / 256), row) * .25; const k = (.62 + .5 * t) * gap * tone; return [182 * k, 140 * k, 92 * k]; }, 512, [3, 3]),
  darkstone: () => makeTex((x, y) => { const n = fbm(x * .03, y * .03, 4), s = hash(x, y) * 14, k = 36 + 26 * n + s; return [k, k, k + 2]; }, 512, [2.4, 2]),
  boucle: (c) => makeTex((x, y) => { const n = fbm(x * .09, y * .09, 3), s = hash(x >> 1, y >> 1), k = .72 + .5 * n * s + .12 * s; return [c[0] * k, c[1] * k, c[2] * k]; }, 256, [4, 4]),
  leather: (c) => makeTex((x, y) => { const n = fbm(x * .05, y * .05, 4), k = .82 + .3 * n; return [c[0] * k, c[1] * k, c[2] * k]; }, 256, [3, 3])
};

const WALLS = [
  { id: "travertine", name: "Travertine", css: "linear-gradient(0deg,#d8c9ad,#ebdfc7)", tex: () => TEX.travertine(), rough: .75 },
  { id: "walnut", name: "Walnut slats", css: "repeating-linear-gradient(90deg,#5b3a24 0 7px,#3e2616 7px 9px)", tex: () => TEX.walnut(), rough: .5 },
  { id: "marble", name: "Dark marble", css: "linear-gradient(120deg,#17181b,#2a2c30 45%,#17181b)", tex: () => TEX.marble(), rough: .22 },
  { id: "plaster", name: "Plaster", css: "linear-gradient(#cfcabf,#c2bdb1)", tex: () => TEX.plaster(), rough: .9 }
];
const FLOORS = [
  { id: "floorMarble", name: "Honed marble", css: "linear-gradient(120deg,#e6e3dd,#cfcbc3)", tex: () => TEX.floorMarble(), rough: .3 },
  { id: "oak", name: "Oak planks", css: "repeating-linear-gradient(0deg,#b88c5c 0 9px,#9a7146 9px 11px)", tex: () => TEX.oak(), rough: .55 },
  { id: "darkstone", name: "Basalt", css: "linear-gradient(#2c2c2f,#45454a)", tex: () => TEX.darkstone(), rough: .5 }
];
const SOFAS = [
  { id: "ivory", name: "Ivory bouclé", css: "#e8e2d4", tex: () => TEX.boucle([232, 226, 212]), rough: .95 },
  { id: "stone", name: "Stone", css: "#969692", tex: () => TEX.boucle([150, 150, 146]), rough: .95 },
  { id: "char", name: "Charcoal", css: "#3a3b3e", tex: () => TEX.boucle([62, 62, 66]), rough: .95 },
  { id: "cognac", name: "Cognac leather", css: "#8c5028", tex: () => TEX.leather([150, 86, 42]), rough: .5 }
];

/* ========================== FINISH EXPLORER ========================== */
export function mountExplorer({ canvas, controlsEl, loadEl }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0d10);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
  const camera = new THREE.PerspectiveCamera(38, 16 / 11, .1, 60); camera.position.set(5.6, 3.1, 7.4);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(-.1, 1.05, -.4); controls.enableDamping = true; controls.dampingFactor = .07;
  controls.minDistance = 4; controls.maxDistance = 11; controls.maxPolarAngle = Math.PI * .49; controls.minPolarAngle = .35;
  controls.minAzimuthAngle = -.9; controls.maxAzimuthAngle = 1.15; controls.autoRotate = !reduce; controls.autoRotateSpeed = .45; controls.enablePan = false;
  let resumeT = 0; controls.addEventListener("start", () => { controls.autoRotate = false; }); controls.addEventListener("end", () => { resumeT = 5; });

  const mat = (o = {}) => new THREE.MeshStandardMaterial({ roughness: .6, metalness: 0, envMapIntensity: 1, ...o });
  const M = { floor: mat(), wall: mat(), side: mat({ color: 0xc9c4ba, roughness: .9 }), sofa: mat(), wood: mat({ color: 0x4a3322, roughness: .45 }), stone: mat({ color: 0x1a1b1d, roughness: .18, metalness: .1 }), rug: mat({ color: 0x2b2d31, roughness: 1 }), brass: mat({ color: 0xc7a56a, metalness: 1, roughness: .28 }), shade: new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffc27a, emissiveIntensity: .3, roughness: .8 }), glass: new THREE.MeshBasicMaterial({ color: 0xbfd8f2 }), white: mat({ color: 0xf0ede6, roughness: .8 }) };
  const add = (geo, m, x, y, z, o = {}) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = o.cast !== false; me.receiveShadow = o.recv !== false; if (o.rot) me.rotation.set(...o.rot); scene.add(me); return me; };
  const RW = 7, RD = 6, RH = 3;
  // floor, back wall, left wall with window
  add(new THREE.PlaneGeometry(RW, RD), M.floor, 0, 0, 0, { rot: [-Math.PI / 2, 0, 0], cast: false });
  add(new THREE.BoxGeometry(RW, RH, .16), M.wall, 0, RH / 2, -RD / 2 - .08);
  const wx = -RW / 2 - .08;
  add(new THREE.BoxGeometry(.16, .9, RD), M.side, wx, .45, 0);
  add(new THREE.BoxGeometry(.16, .6, RD), M.side, wx, RH - .3, 0);
  add(new THREE.BoxGeometry(.16, 1.5, 1.0), M.side, wx, 1.65, -2.5); add(new THREE.BoxGeometry(.16, 1.5, 1.0), M.side, wx, 1.65, 2.5);
  add(new THREE.BoxGeometry(.16, 1.5, .08), M.side, wx, 1.65, -.0);
  const sky = add(new THREE.PlaneGeometry(RD + 2, RH + 2), M.glass, -RW / 2 - 1.6, 1.5, 0, { rot: [0, Math.PI / 2, 0], cast: false, recv: false });
  // skirting + ceiling cove strip
  add(new THREE.BoxGeometry(RW, .09, .03), M.white, 0, .045, -RD / 2 + .02, { cast: false });
  const cove = add(new THREE.BoxGeometry(RW - .4, .03, .06), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), 0, RH - .08, -RD / 2 + .12, { cast: false, recv: false });
  const coveMat = cove.material; coveMat.transparent = true;
  // rug, sofa, table, lamp, art, vase
  add(new THREE.BoxGeometry(3.6, .02, 2.5), M.rug, .2, .012, .1, { cast: false });
  const sx = .3, sz = -1.35;
  add(new RoundedBoxGeometry(3.0, .42, 1.08, 4, .09), M.sofa, sx, .3, sz);
  add(new RoundedBoxGeometry(3.0, .62, .3, 4, .1), M.sofa, sx, .72, sz - .42);
  add(new RoundedBoxGeometry(.3, .66, 1.08, 4, .1), M.sofa, sx - 1.35, .54, sz); add(new RoundedBoxGeometry(.3, .66, 1.08, 4, .1), M.sofa, sx + 1.35, .54, sz);
  for (let i = -1; i <= 1; i++) add(new RoundedBoxGeometry(.9, .2, .82, 4, .08), M.sofa, sx + i * .92, .6, sz + .06);
  add(new RoundedBoxGeometry(.5, .5, .16, 4, .06), M.white, sx - .85, .86, sz - .1, { rot: [-.12, .2, 0] });
  add(new THREE.CylinderGeometry(.62, .62, .34, 48), M.stone, .35, .19, .55);
  add(new THREE.CylinderGeometry(.18, .22, .04, 32), M.brass, .35, .38, .55);
  const lampX = 2.6, lampZ = -1.9;
  add(new THREE.CylinderGeometry(.14, .16, .03, 32), M.brass, lampX, .015, lampZ);
  add(new THREE.CylinderGeometry(.012, .012, 1.55, 12), M.brass, lampX, .8, lampZ);
  const shade = add(new THREE.SphereGeometry(.26, 32, 24), M.shade, lampX, 1.72, lampZ, { cast: false });
  const art = add(new THREE.BoxGeometry(1.1, 1.5, .04), mat({ color: 0x15171a, roughness: .5 }), -2.1, 1.65, -RD / 2 + .04);
  add(new THREE.BoxGeometry(.86, 1.26, .02), mat({ color: 0xcdbb9a, roughness: .9 }), -2.1, 1.65, -RD / 2 + .07);
  add(new THREE.CircleGeometry(.3, 40), mat({ color: 0x8a5c3a, roughness: .9 }), -2.1, 1.75, -RD / 2 + .085, { cast: false });
  const vase = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.1, 0], [.17, .12], [.13, .3], [.07, .42], [.09, .5]].map(p => new THREE.Vector2(...p)), 40), M.white);
  vase.position.set(2.2, 0, -2.5); vase.castShadow = true; scene.add(vase);

  // lights
  const hemi = new THREE.HemisphereLight(0xdfe9f5, 0x4a4036, .6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 3); sun.position.set(-9, 6.5, 3.5); sun.target.position.set(0, 0, -.5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 24 }); sun.shadow.bias = -.0005; sun.shadow.normalBias = .03;
  scene.add(sun, sun.target);
  const lamp = new THREE.PointLight(0xffc88a, 0, 9, 1.6); lamp.position.set(lampX, 1.7, lampZ + .2); scene.add(lamp);
  const coveL = new THREE.PointLight(0xffd9a8, 0, 8, 1.8); coveL.position.set(0, RH - .25, -RD / 2 + .6); scene.add(coveL);

  // state + finishes
  const cache = {}; const pick = (list, id) => list.find(x => x.id === id);
  const apply = (m, list, id) => {
    const f = pick(list, id), key = list === WALLS ? "w" + id : list === FLOORS ? "f" + id : "s" + id;
    const t = cache[key] || (cache[key] = f.tex());
    m.map = t; m.color.set(0xffffff); m.roughness = f.rough; m.metalness = 0; m.needsUpdate = true;
  };
  const state = { wall: "travertine", floor: "floorMarble", sofa: "ivory", night: false };
  const refresh = () => { apply(M.wall, WALLS, state.wall); apply(M.floor, FLOORS, state.floor); apply(M.sofa, SOFAS, state.sofa); };
  refresh();
  let dn = 0;                                // 0 day … 1 night, animated
  const day = { sun: 3, hemi: .65, env: 1, bg: new THREE.Color(0x14181d), sky: new THREE.Color(0xc4dcf5), exp: 1 };
  const nite = { sun: .22, hemi: .12, env: .22, bg: new THREE.Color(0x07080a), sky: new THREE.Color(0x0e1830), exp: 1.15 };
  const envMats = Object.values(M);
  const light = () => {
    sun.intensity = mix(day.sun, nite.sun, dn); hemi.intensity = mix(day.hemi, nite.hemi, dn);
    sun.color.set(dn > .5 ? 0x9db8ff : 0xfff0d8);
    envMats.forEach(m => { if ("envMapIntensity" in m) m.envMapIntensity = mix(day.env, nite.env, dn); });
    M.glass.color.copy(day.sky).lerp(nite.sky, dn); renderer.toneMappingExposure = mix(day.exp, nite.exp, dn);
    lamp.intensity = dn * 9; coveL.intensity = dn * 4; M.shade.emissiveIntensity = mix(.25, 2.2, dn); coveMat.opacity = mix(.12, 1, dn);
  };
  light();

  // controls UI
  controlsEl.innerHTML = "";
  const group = (label, list, key) => {
    const w = document.createElement("div"); w.innerHTML = `<p class="ctl-label">${label}</p><div class="swatches"></div>`;
    const box = w.querySelector(".swatches");
    list.forEach(f => {
      const b = document.createElement("button"); b.className = "sw"; b.style.background = f.css; b.setAttribute("aria-label", `${label}: ${f.name}`); b.setAttribute("aria-pressed", String(state[key] === f.id)); b.innerHTML = `<span>${f.name}</span>`;
      b.addEventListener("click", () => { state[key] = f.id; box.querySelectorAll(".sw").forEach(x => x.setAttribute("aria-pressed", String(x === b))); refresh(); });
      box.append(b);
    });
    controlsEl.append(w);
  };
  group("Feature wall", WALLS, "wall"); group("Floor", FLOORS, "floor"); group("Sofa", SOFAS, "sofa");
  const tg = document.createElement("div"); tg.innerHTML = `<p class="ctl-label">Lighting</p><div class="toggle" role="group" aria-label="Lighting"><button aria-pressed="true" data-n="0">Day</button><button aria-pressed="false" data-n="1">Night</button></div>`;
  tg.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { state.night = b.dataset.n === "1"; tg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); if (reduce) { dn = state.night ? 1 : 0; light(); } }));
  controlsEl.append(tg);

  // sizing + loop (only while visible)
  const resize = () => { const r = canvas.getBoundingClientRect(); if (!r.width) return; renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  let on = false, raf = 0, last = performance.now();
  const frame = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const tgt = state.night ? 1 : 0; if (dn !== tgt) { dn += Math.sign(tgt - dn) * Math.min(Math.abs(tgt - dn), dt * 1.3); light(); }
    if (resumeT > 0) { resumeT -= dt; if (resumeT <= 0 && !reduce) controls.autoRotate = true; }
    controls.update(); renderer.render(scene, camera);
    if (on) raf = requestAnimationFrame(frame);
  };
  const io = new IntersectionObserver(es => { on = es[0].isIntersecting; cancelAnimationFrame(raf); if (on) { last = performance.now(); raf = requestAnimationFrame(frame); } });
  io.observe(canvas);
  loadEl.classList.add("done");
  return { destroy() { on = false; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); renderer.dispose(); } };
}

/* ============================= MUSEUM VIEWER ============================= */
function lathe(pts, seg = 96) { const c = new THREE.SplineCurve(pts.map(p => new THREE.Vector2(...p))); return new THREE.LatheGeometry(c.getPoints(72), seg); }
function bandTex(bands, base, ink) {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512; const g = c.getContext("2d");
  g.fillStyle = base; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .05})`; g.fillRect(Math.random() * 1024, Math.random() * 512, 3, 3); }
  g.fillStyle = ink; bands.forEach(([y0, y1, kind]) => {
    if (kind === "solid") g.fillRect(0, y0 * 512, 1024, (y1 - y0) * 512);
    else if (kind === "meander") { const h = (y1 - y0) * 512, y = y0 * 512; g.fillRect(0, y, 1024, 4); g.fillRect(0, y + h - 4, 1024, 4); for (let x = 0; x < 1024; x += h * 1.6) { g.fillRect(x, y + 6, 4, h - 10); g.fillRect(x, y + 6, h * .8, 4); g.fillRect(x + h * .8, y + 6, 4, h * .55); g.fillRect(x + h * .3, y + h * .55, h * .5, 4); } }
    else if (kind === "figures") { const h = (y1 - y0) * 512, y = y0 * 512; for (let x = 20; x < 1024; x += h * .9) { g.beginPath(); g.ellipse(x, y + h * .62, h * .13, h * .3, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x, y + h * .22, h * .1, 0, Math.PI * 2); g.fill(); g.fillRect(x - h * .3, y + h * .55, h * .6, 3); } }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
export const ARTIFACTS = [
  { n: "Amphora", role: "Storage and transport jar", d: "Tall two-handled jars like this carried wine, olive oil and grain across the ancient Mediterranean. The pointed or narrow foot let them be stacked in the hold of a ship.", mat: "Terracotta, painted bands" },
  { n: "Krater", role: "Mixing bowl", d: "A wide bowl in which wine was mixed with water before being served at a banquet. Its generous shape gave painters a large surface for decoration.", mat: "Terracotta, black-figure style bands" },
  { n: "Hydria", role: "Water jar", d: "A three-handled jar for carrying and pouring water: two side handles for lifting, one rear handle for tilting. Many were made in bronze.", mat: "Cast bronze (study model)" }
];
export function mountMuseum({ canvas, onSelect }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0b0d); scene.fog = new THREE.Fog(0x0a0b0d, 7, 14);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .35;
  const cam = new THREE.PerspectiveCamera(36, 16 / 10, .1, 40); cam.position.set(0, 1.5, 4.4);
  const ctl = new OrbitControls(cam, canvas); ctl.target.set(0, .85, 0); ctl.enableDamping = true; ctl.enablePan = false; ctl.minDistance = 2.4; ctl.maxDistance = 6.5; ctl.maxPolarAngle = Math.PI * .52; ctl.autoRotate = !reduce; ctl.autoRotateSpeed = 1.4;
  ctl.addEventListener("start", () => ctl.autoRotate = false);
  const spot = new THREE.SpotLight(0xffe7c8, 90, 14, .5, .6, 1.4); spot.position.set(2.2, 5.5, 2.6); spot.target.position.set(0, .8, 0); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); scene.add(spot, spot.target);
  const rim = new THREE.PointLight(0x86b4f0, 8, 10); rim.position.set(-3, 2.2, -2.5); scene.add(rim);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(.95, 1.05, .5, 64), new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: .25, metalness: .2 })); ped.position.y = -.25; ped.receiveShadow = true; scene.add(ped);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.97, .008, 8, 96), new THREE.MeshBasicMaterial({ color: 0x8fdccf })); ring.rotation.x = Math.PI / 2; ring.position.y = .004; scene.add(ring);
  const terra = (bands) => new THREE.MeshStandardMaterial({ map: bandTex(bands, "#b9663a", "#201510"), roughness: .75, side: THREE.DoubleSide });
  const bronze = new THREE.MeshStandardMaterial({ color: 0xb68d52, metalness: 1, roughness: .32, side: THREE.DoubleSide });
  const handle = (curve, m, r = .026) => new THREE.Mesh(new THREE.TubeGeometry(curve, 24, r, 10), m);
  const V = (...a) => new THREE.Vector3(...a);
  function build(i) {
    const g = new THREE.Group();
    if (i === 0) {
      const m = terra([[.05, .09, "solid"], [.16, .27, "meander"], [.34, .58, "figures"], [.66, .7, "solid"]]);
      g.add(new THREE.Mesh(lathe([[.001, 0], [.12, 0], [.14, .06], [.3, .24], [.42, .55], [.4, .85], [.24, 1.15], [.16, 1.32], [.17, 1.5], [.25, 1.6], [.22, 1.64], [.14, 1.6]]), m));
      for (const s of [-1, 1]) g.add(handle(new THREE.CatmullRomCurve3([V(s * .17, 1.46, 0), V(s * .38, 1.5, 0), V(s * .42, 1.26, 0), V(s * .3, 1.1, 0)]), m));
      g.scale.setScalar(.95);
    } else if (i === 1) {
      const m = terra([[.04, .1, "solid"], [.16, .3, "meander"], [.36, .66, "figures"], [.72, .78, "meander"]]);
      g.add(new THREE.Mesh(lathe([[.001, 0], [.18, 0], [.2, .1], [.14, .2], [.2, .3], [.45, .5], [.62, .8], [.65, .92], [.6, .94], [.001, .5]]), m));
      for (const s of [-1, 1]) g.add(handle(new THREE.CatmullRomCurve3([V(s * .6, .82, 0), V(s * .86, .86, 0), V(s * .84, .56, 0), V(s * .52, .5, 0)]), m, .03));
      g.scale.setScalar(1.15);
    } else {
      g.add(new THREE.Mesh(lathe([[.001, 0], [.16, 0], [.2, .06], [.38, .3], [.45, .55], [.34, .85], [.2, .98], [.2, 1.1], [.3, 1.18], [.27, 1.2], [.15, 1.14]]), bronze));
      for (const s of [-1, 1]) g.add(handle(new THREE.CatmullRomCurve3([V(s * .42, .66, 0), V(s * .62, .72, 0), V(s * .6, .52, 0), V(s * .45, .46, 0)]), bronze, .03));
      g.add(handle(new THREE.CatmullRomCurve3([V(0, 1.14, -.26), V(0, 1.12, -.5), V(0, .86, -.52), V(0, .78, -.35)]), bronze, .03));
      g.scale.setScalar(1.1);
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  let cur = null; const select = i => { if (cur) scene.remove(cur); cur = build(i); scene.add(cur); onSelect && onSelect(ARTIFACTS[i], i); };
  select(0);
  const resize = () => { const r = canvas.getBoundingClientRect(); if (!r.width) return; renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  let on = false, raf = 0; const frame = () => { ctl.update(); renderer.render(scene, cam); if (on) raf = requestAnimationFrame(frame); };
  const io = new IntersectionObserver(es => { on = es[0].isIntersecting; cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(frame); }); io.observe(canvas);
  return { select, destroy() { on = false; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); renderer.dispose(); } };
}
