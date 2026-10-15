import * as THREE from 'three';
import { TextureBaker } from '../../materials/texgen.js';
import * as S from '../../materials/shaders.js';
import * as A from './shaders.js';
import { loadPhoto, deriveMaps, fit } from './photo.js';

/*
 * Physically based materials for the apartment. Every one of the plan's 73 materials is mapped to
 * a GPU-baked procedural surface (albedo + normal + roughness) or, for metals, glass and fixtures,
 * to a parameter-only material. Recipes are shared: a painted wall and a sage panel use the same
 * plaster maps with a different tint, so the whole set bakes into about twenty textures.
 *
 * The plan's materials carry sRGB colours; textured ones are tinted onto a recipe whose own
 * albedo is a known mid-tone, so the final colour lands on the plan's colour.
 */

const srgb = (c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
const clamp1 = (v) => Math.min(1, v);
const tintOver = (c, base) => new THREE.Color().setRGB(clamp1(c[0] / base), clamp1(c[1] / base), clamp1(c[2] / base), THREE.SRGBColorSpace);

// size = albedo resolution, dataSize = normal / roughness resolution
const RECIPES = {
  travertine:   { glsl: A.TRAVERTINE,     size: 2048, dataSize: 1024, normalStrength: 2.4, seed: 21, scale: 0.55 },
  cladding:     { glsl: A.CLADDING,       size: 1024, dataSize: 512,  normalStrength: 2.2, seed: 22, scale: 0.5 },
  marbleCream:  { glsl: A.MARBLE_CREAM,   size: 2048, dataSize: 1024, normalStrength: 0.8, seed: 23, scale: 0.25 },
  marbleStreak: { glsl: A.MARBLE_STREAK,  size: 1024, dataSize: 512,  normalStrength: 0.8, seed: 24, scale: 0.25 },
  marbleRosso:  { glsl: A.MARBLE_ROSSO,   size: 2048, dataSize: 1024, normalStrength: 0.8, seed: 25, scale: 0.3 },
  onyx:         { glsl: A.ONYX,           size: 2048, dataSize: 1024, normalStrength: 0.8, seed: 26, scale: 0.25 },
  relief:       { glsl: A.RELIEF,         size: 2048, dataSize: 2048, normalStrength: 6.0, seed: 27, scale: 0.9 },
  wallpaper:    { glsl: A.WALLPAPER,      size: 2048, dataSize: 512,  normalStrength: 1.0, seed: 28, scale: 0.6 },
  cane:         { glsl: A.CANE,           size: 1024, dataSize: 1024, normalStrength: 5.0, seed: 29, scale: 0.8 },
  flutedWalnut: { glsl: A.FLUTED_WALNUT,  size: 1024, dataSize: 1024, normalStrength: 4.0, seed: 30, scale: 1.0 },
  walnut:       { glsl: A.WALNUT_FINE,    size: 2048, dataSize: 1024, normalStrength: 2.5, seed: 31, scale: 0.5 },
  limestone:    { glsl: A.LIMESTONE,      size: 2048, dataSize: 1024, normalStrength: 1.2, seed: 42, scale: 0.4 },
  stripe:       { glsl: A.STRIPE,         size: 1024, dataSize: 512,  normalStrength: 4.0, seed: 32, scale: 0.8 },
  gravel:       { glsl: A.GRAVEL,         size: 1024, dataSize: 1024, normalStrength: 4.0, seed: 33, scale: 0.8 },
  rock:         { glsl: A.ROCK,           size: 1024, dataSize: 1024, normalStrength: 5.0, seed: 34, scale: 0.9 },
  plaster:      { glsl: S.PLASTER,        size: 1024, dataSize: 512,  normalStrength: 0.6, seed: 35, scale: 0.4 },
  boucle:       { glsl: S.BOUCLE,         size: 1024, dataSize: 1024, normalStrength: 3.0, seed: 36, scale: 0.7 },
  linen:        { glsl: S.LINEN,          size: 1024, dataSize: 512,  normalStrength: 4.0, seed: 37, scale: 0.6 },
  oak:          { glsl: S.OAK,            size: 1024, dataSize: 512,  normalStrength: 2.0, seed: 38, scale: 0.5 },
  deck:         { glsl: S.DECK,           size: 1024, dataSize: 512,  normalStrength: 3.0, seed: 39, scale: 0.9 },
  wool:         { glsl: S.WOOL,           size: 1024, dataSize: 1024, normalStrength: 5.0, seed: 40, scale: 0.9 },
  brushed:      { glsl: S.BRUSHED,        size: 512,  dataSize: 512,  normalStrength: 1.0, seed: 41, scale: 0.2, maps: ['normal', 'orm'] },
};

// plan material -> recipe (+ optional tint). Anything not listed falls back to its flat parameters.
const SURFACE = {
  D_Marble: ['marbleCream'], D_MarbleProp: ['marbleStreak'], D_Travertine: ['limestone'],
  D_Plaster: ['plaster', 0.9], D_Ceiling: ['plaster', 0.92],
  D_Veneer: ['walnut', null, [0.8, 0.77, 0.75]], D_Oak: ['oak'], D_Deck: ['deck'],
  D_Boucle: ['boucle', 0.85], D_Linen: ['linen', 0.8], D_Rug: ['wool', 1.0],
  L_Plaster: ['plaster', 0.9], L_PaintTaupe: ['plaster', 0.9], L_Terracotta: ['plaster', 0.9], L_Sage: ['plaster', 0.9],
  L_Cane: ['cane'], L_Fluted: ['flutedWalnut'], L_WalnutWarm: ['walnut'],
  L_BoucleGreen: ['boucle', 0.85], L_BoucleTan: ['boucle', 0.85], L_BoucleRust: ['boucle', 0.85], L_LinenTan: ['boucle', 0.85],
  L_StoneBeige: ['limestone', null, [0.97, 0.94, 0.88]], L_TravertineClad: ['cladding'],
  L_Blind: ['linen', 0.8], L_StripeThrow: ['stripe'],
  P_Teak: ['oak', null, [0.95, 0.7, 0.45]], P_Gravel: ['gravel'],
};
const CLOTH = new Set(['D_Boucle', 'D_Linen', 'D_Rug', 'L_BoucleGreen', 'L_BoucleTan', 'L_BoucleRust', 'L_LinenTan', 'L_RugRust', 'L_Blind', 'L_StripeThrow']);
// The plan's emissive strengths are tuned for a path tracer; a real-time tone-mapped view needs far less.
const EMIT_SCALE = { L_Led: 0.22, D_Downlight: 0.6, L_Halo: 0.4, L_Alabaster: 0.45 };
const RUGS = new Set(['D_Rug', 'L_RugRust']);

// Surfaces taken from the supplied photographs. w x h = real size in metres of one photograph.
const PHOTO = {
  L_Relief:           { file: 'relief_green.jpg',      w: 1.2,  h: 0.675, normal: 5.0, rough: [0.60, 0.80], blur: 1, cloth: false },
  L_WallpaperRust:    { file: 'crane_rust.jpg',        w: 1.2,  h: 0.675, normal: 1.4, rough: [0.50, 0.68], blur: 1 },
  L_MarbleTerracotta: { file: 'rosso_marble.jpg',      w: 1.0,  h: 1.446, normal: 0.8, rough: [0.10, 0.20], blur: 2, glossy: true },
  L_MarbleScallop:    { file: 'onyx.jpg',              w: 1.1,  h: 1.1,   normal: 0.8, rough: [0.08, 0.16], blur: 2, glossy: true },
  L_RugRust:          { file: 'rug_rust.jpg',          w: 1.0,  h: 1.407, normal: 3.0, rough: [0.88, 1.0],  blur: 1, cloth: true },
  X_Grasscloth:       { file: 'grasscloth_weave.jpg',  w: 0.53, h: 0.655, normal: 3.5, rough: [0.62, 0.86], blur: 1, tile: 0.24 },
  X_GrassStripe:      { file: 'grasscloth_stripe.jpg', w: 0.60, h: 0.747, normal: 3.0, rough: [0.6, 0.85],  blur: 1, tile: 1.0 },
  X_Microcement:      { file: 'microcement.jpg',       w: 1.2,  h: 1.6,   normal: 0.6, rough: [0.45, 0.6],  blur: 2, tile: 1.0 },
  X_SofaLinen:        { file: 'sofa_linen.jpg',        w: 0.45, h: 0.45,  normal: 3.0, rough: [0.85, 0.95], blur: 1, tile: 1.0, cloth: true },
};

export async function buildApartmentMaterials(renderer, specs, onProgress = () => {}) {
  const baker = new TextureBaker(renderer);
  const big = renderer.capabilities.maxTextureSize >= 4096;
  const shrink = big ? 1 : 0.5;
  const used = new Set();
  for (const name of Object.keys(specs)) if (SURFACE[name]) used.add(SURFACE[name][0]);
  used.add('brushed');
  const names = [...used];
  const T = {};
  names.forEach((k, i) => {
    const r = { ...RECIPES[k] };
    r.size = Math.max(256, r.size * shrink); r.dataSize = Math.max(256, (r.dataSize || r.size) * shrink);
    T[k] = baker.bake(r);
    onProgress((i + 1) / names.length);
  });

  const M = { byName: new Map(), T };
  const ns = (k) => new THREE.Vector2(RECIPES[k].scale, RECIPES[k].scale);

  for (const [name, s] of Object.entries(specs)) {
    let m;
    const surf = SURFACE[name];
    const color = s.color || [0.8, 0.8, 0.8];
    if (surf) {
      const [recipe, base, mul] = surf;
      const t = T[recipe];
      let tint = new THREE.Color(1, 1, 1);
      if (base) tint = tintOver(color, base);
      else if (mul) tint = new THREE.Color().setRGB(mul[0], mul[1], mul[2], THREE.SRGBColorSpace);
      const o = { map: t.map, normalMap: t.normal, roughnessMap: t.orm, roughness: 1, metalness: 0, color: tint, normalScale: ns(recipe) };
      if (CLOTH.has(name)) {
        m = new THREE.MeshPhysicalMaterial({ ...o, sheen: RUGS.has(name) ? 0.2 : 0.6, sheenRoughness: 0.55, sheenColor: tint.clone().lerp(new THREE.Color(1, 1, 1), 0.55) });
      } else if ((s.spec ?? 0) >= 0.5 && (s.rough ?? 1) < 0.3) {
        m = new THREE.MeshPhysicalMaterial({ ...o, clearcoat: 0.25, clearcoatRoughness: 0.12 });
      } else {
        m = new THREE.MeshStandardMaterial(o);
      }
    } else if (s.opacity !== undefined) {
      const sheer = name === 'D_Sheer';
      m = new THREE.MeshPhysicalMaterial({
        color: srgb(color), roughness: sheer ? 0.9 : s.rough ?? 0.02, transparent: true, opacity: sheer ? s.opacity : 0.07,
        side: THREE.DoubleSide, depthWrite: sheer, envMapIntensity: sheer ? 1 : 0.22, ior: 1.5, specularIntensity: sheer ? 1 : 0.6,
        ...(sheer ? { sheen: 0.6, sheenColor: new THREE.Color(1, 1, 1), sheenRoughness: 0.6, normalMap: T.linen?.normal || null, normalScale: new THREE.Vector2(0.4, 0.4) } : {}),
      });
      if (sheer && !T.linen) { /* the linen maps are only baked when a plan material needs them */ }
    } else if (s.emissive) {
      // fixtures glow warm white, not orange: pull the plan's emissive colour toward neutral
      const em = srgb(s.emissive).lerp(new THREE.Color(1, 0.97, 0.92), 0.55);
      m = new THREE.MeshStandardMaterial({ color: srgb(color), roughness: s.rough ?? 0.4, emissive: em, emissiveIntensity: 0 });
      m.userData.emit = (s.emit ?? 1) * (EMIT_SCALE[name] ?? 0.5);
      m.userData.emissive = true;
    } else if (name === 'D_Mirror' || name === 'L_Mirror') {
      m = new THREE.MeshStandardMaterial({ color: srgb(color), metalness: 1, roughness: 0.02 });
    } else if (s.metal > 0.5) {
      const brushed = /Steel|Brass|Chrome|Bronze|TaupeMetal/.test(name);
      m = new THREE.MeshStandardMaterial({
        color: srgb(color), metalness: s.metal, roughness: s.rough ?? 0.3,
        ...(brushed && name !== 'D_Chrome' ? { normalMap: T.brushed.normal, roughnessMap: T.brushed.orm, normalScale: new THREE.Vector2(0.15, 0.15) } : {}),
      });
      if (name === 'L_BrushedSteel') m.normalScale.set(0.3, 0.3);
    } else if (name === 'L_TVGlass' || name === 'D_Screen' || name === 'L_Ruby' || name === 'D_Ceramic' || name === 'D_Lacquer') {
      m = new THREE.MeshPhysicalMaterial({ color: srgb(color), roughness: s.rough ?? 0.1, clearcoat: 1, clearcoatRoughness: 0.06 });
    } else if (CLOTH.has(name) || /Garment|Towel/.test(name)) {
      m = new THREE.MeshPhysicalMaterial({ color: srgb(color), roughness: 0.95, sheen: 0.6, sheenRoughness: 0.55, sheenColor: srgb(color).lerp(new THREE.Color(1, 1, 1), 0.5) });
    } else {
      m = new THREE.MeshStandardMaterial({ color: srgb(color), roughness: s.rough ?? 0.6, metalness: s.metal ?? 0 });
    }
    m.name = name;
    M.byName.set(name, m);
  }

  // ---- surfaces from the supplied photographs (replace the generated ones with the real thing)
  const aniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  const names2 = Object.keys(PHOTO);
  const photos = await Promise.all(names2.map((n) => loadPhoto(PHOTO[n].file, { anisotropy: aniso })));
  names2.forEach((name, i) => {
    const d = PHOTO[name];
    const map = photos[i];
    const { normal, orm } = deriveMaps(map, { strength: d.normal, rough: d.rough, blur: d.blur });
    const tile = d.tile ?? specs[name]?.tile ?? 1;
    fit([map, normal, orm], tile, d.w, d.h);
    const o = { map, normalMap: normal, roughnessMap: orm, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1, 1) };
    let m;
    if (d.cloth) m = new THREE.MeshPhysicalMaterial({ ...o, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.9, 0.85, 0.8) });
    else if (d.glossy) m = new THREE.MeshPhysicalMaterial({ ...o, clearcoat: 0.8, clearcoatRoughness: 0.05 });
    else m = new THREE.MeshStandardMaterial(o);
    m.name = name;
    M.byName.set(name, m);
  });
  onProgress(1);

  // Walls take a per-vertex tint (white = original finish) so painting one wall face never touches any other surface.
  const plaster = M.byName.get('L_Plaster');
  M.wallPaint = plaster.clone();
  M.wallPaint.vertexColors = true;
  M.wallPaint.name = 'L_Plaster(wall)';
  // extra materials the plan does not name
  M.rock = new THREE.MeshStandardMaterial({ map: (T.rock || (T.rock = baker.bake({ ...RECIPES.rock, size: 1024 * shrink, dataSize: 1024 * shrink }))).map, normalMap: T.rock.normal, roughnessMap: T.rock.orm, roughness: 1, normalScale: new THREE.Vector2(1.2, 1.2) });
  M.shadowGap = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 });
  M.glass = M.byName.get('D_Glass');
  M.get = (n) => M.byName.get(n) || M.byName.get('D_Plaster');
  M.textures = T;
  return M;
}
