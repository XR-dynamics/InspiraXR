import * as THREE from 'three';
import { TextureBaker } from './texgen.js';
import * as S from './shaders.js';

/*
 * Material library. Bakes every procedural surface and exposes physically
 * based materials tuned to match the reference: honed limestone floors,
 * warm walnut veneer, Grigio marble, off-white boucle, smoked glass,
 * blackened aluminium and brushed brass.
 */

const srgb = (hex) => new THREE.Color(hex);

export function buildMaterials(renderer, onProgress = () => {}) {
  const baker = new TextureBaker(renderer);
  const hi = renderer.capabilities.maxTextureSize >= 4096 ? 2048 : 1024;

  const defs = {
    stone: { glsl: S.STONE_FLOOR, size: hi, normalStrength: 3.0, repeat: [1 / 2.4, 1 / 2.4], seed: 1 },
    walnut: { glsl: S.WALNUT, size: hi, normalStrength: 2.0, repeat: [1 / 1.2, 1 / 3.0], seed: 2 },
    darkMarble: { glsl: S.DARK_MARBLE, size: hi, normalStrength: 1.0, repeat: [1 / 2.2, 1 / 2.2], seed: 3 },
    whiteMarble: { glsl: S.WHITE_MARBLE, size: hi, normalStrength: 1.0, repeat: [1 / 2.0, 1 / 2.0], seed: 4 },
    plaster: { glsl: S.PLASTER, size: 1024, normalStrength: 0.6, repeat: [1 / 3, 1 / 3], seed: 5 },
    boucle: { glsl: S.BOUCLE, size: 1024, normalStrength: 6.0, repeat: [1 / 0.25, 1 / 0.25], seed: 6 },
    linen: { glsl: S.LINEN, size: 1024, normalStrength: 4.0, repeat: [1 / 0.2, 1 / 0.2], seed: 7 },
    oak: { glsl: S.OAK, size: hi, normalStrength: 2.0, repeat: [1 / 2.4, 1 / 2.4], seed: 8 },
    rug: { glsl: S.RUG, size: hi, normalStrength: 4.0, seed: 9 },
    wool: { glsl: S.WOOL, size: 512, normalStrength: 5.0, repeat: [1, 1], seed: 10 },
    deck: { glsl: S.DECK, size: 1024, normalStrength: 3.0, repeat: [1 / 2.1, 1 / 2.1], seed: 11 },
    paver: { glsl: S.PAVER, size: 1024, normalStrength: 2.0, repeat: [1 / 2.0, 1 / 2.0], seed: 12 },
    grass: { glsl: S.GRASS, size: 1024, normalStrength: 3.0, repeat: [1 / 8, 1 / 8], seed: 13 },
    leaves: { glsl: S.LEAVES, size: 512, normalStrength: 2.0, seed: 14, alpha: true },
    fluted: { glsl: S.FLUTED, size: 512, normalStrength: 2.5, repeat: [1 / 0.6, 1], seed: 15 },
    brushed: { glsl: S.BRUSHED, size: 512, normalStrength: 1.0, repeat: [1, 1], seed: 16 },
    water: { glsl: S.WATER, size: 512, normalStrength: 2.0, repeat: [1 / 4, 1 / 4], seed: 17, maps: ['normal'] },
    art: { glsl: S.ART, size: 1024, normalStrength: 2.0, seed: 18 },
    art2: { glsl: S.ART, size: 1024, normalStrength: 2.0, seed: 41 },
    slate: { glsl: S.SLATE, size: 1024, normalStrength: 1.0, repeat: [1 / 2, 1 / 2], seed: 19 },
    bark: { glsl: S.BARK, size: 512, normalStrength: 3.0, repeat: [1, 1 / 2], seed: 20 },
  };

  const T = {};
  const keys = Object.keys(defs);
  keys.forEach((k, i) => {
    T[k] = baker.bake(defs[k]);
    onProgress((i + 1) / keys.length);
  });

  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const tex = (k, extra = {}) => ({
    map: T[k].map,
    normalMap: T[k].normal,
    roughnessMap: T[k].orm,
    ...extra,
  });

  const M = {};

  // ---- Architectural surfaces -------------------------------------------
  M.stone = std({ ...tex('stone'), roughness: 1, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 1.0 });
  M.plaster = std({ ...tex('plaster'), roughness: 1, normalScale: new THREE.Vector2(0.4, 0.4) });
  M.ceiling = std({ ...tex('plaster'), roughness: 1, color: srgb(0xf7f9fc), normalScale: new THREE.Vector2(0.2, 0.2) });
  M.walnut = std({ ...tex('walnut'), roughness: 1, normalScale: new THREE.Vector2(0.5, 0.5) });
  M.walnutDark = std({ ...tex('walnut'), roughness: 1, color: srgb(0x8a7462), normalScale: new THREE.Vector2(0.5, 0.5) });
  M.oak = std({ ...tex('oak'), roughness: 1, normalScale: new THREE.Vector2(0.5, 0.5) });
  M.darkMarble = std({ ...tex('darkMarble'), roughness: 1, normalScale: new THREE.Vector2(0.3, 0.3) });
  M.whiteMarble = std({ ...tex('whiteMarble'), roughness: 1, normalScale: new THREE.Vector2(0.3, 0.3) });
  M.slate = std({ ...tex('slate'), roughness: 1 });
  M.fluted = std({ ...tex('fluted'), roughness: 1, normalScale: new THREE.Vector2(1.6, 1.6) });
  M.deck = std({ ...tex('deck'), roughness: 1 });
  M.paver = std({ ...tex('paver'), roughness: 1 });
  M.render = std({ ...tex('plaster'), roughness: 1, color: srgb(0xf2f1ee), normalScale: new THREE.Vector2(1.2, 1.2) });
  M.grass = std({ ...tex('grass'), roughness: 1 });
  M.reveal = std({ color: srgb(0x111111), roughness: 0.8 });
  M.shadowGap = std({ color: srgb(0x050505), roughness: 1 });

  // ---- Metals --------------------------------------------------------------
  M.blackAlu = std({ color: srgb(0x161718), metalness: 0.15, roughness: 0.48, normalMap: T.brushed.normal, normalScale: new THREE.Vector2(0.15, 0.15) });
  M.brass = std({ color: srgb(0xc9a46a), metalness: 1, roughness: 0.28, normalMap: T.brushed.normal, roughnessMap: T.brushed.orm, normalScale: new THREE.Vector2(0.2, 0.2) });
  M.chrome = std({ color: srgb(0xe8e8e8), metalness: 1, roughness: 0.08 });
  M.steel = std({ color: srgb(0xb8b9bb), metalness: 1, roughness: 0.35, normalMap: T.brushed.normal, roughnessMap: T.brushed.orm, normalScale: new THREE.Vector2(0.3, 0.3) });
  M.bronze = std({ color: srgb(0x5a4632), metalness: 1, roughness: 0.4 });
  M.blackMatte = std({ color: srgb(0x141414), roughness: 0.65 });

  // ---- Glass ---------------------------------------------------------------
  M.glass = phys({
    color: srgb(0x9fb0ae), metalness: 0, roughness: 0.02, transparent: true, opacity: 0.07,
    envMapIntensity: 0.55, specularIntensity: 1, ior: 1.5, depthWrite: false, side: THREE.DoubleSide,
  });
  M.glassRail = phys({
    color: srgb(0xcfdedb), metalness: 0, roughness: 0.03, transparent: true, opacity: 0.18,
    envMapIntensity: 1.0, depthWrite: false, side: THREE.DoubleSide,
  });
  M.smokedGlass = phys({
    color: srgb(0x6f6a64), metalness: 0, roughness: 0.05, transparent: true, opacity: 0.45,
    envMapIntensity: 1.0, depthWrite: false, side: THREE.DoubleSide,
  });
  M.clearSphere = phys({
    color: srgb(0xf2efe8), metalness: 0, roughness: 0.02, transparent: true, opacity: 0.28,
    envMapIntensity: 2.0, clearcoat: 1, depthWrite: false,
  });
  M.smokeSphere = phys({
    color: srgb(0xa58e72), metalness: 0, roughness: 0.04, transparent: true, opacity: 0.5,
    envMapIntensity: 2.0, clearcoat: 1, depthWrite: false,
  });
  M.opal = phys({
    color: srgb(0xf6f1e8), roughness: 0.35, emissive: srgb(0xffd9a8), emissiveIntensity: 0,
    sheen: 0.4, sheenColor: srgb(0xffffff),
  });
  M.mirror = std({ color: srgb(0xf0f0f0), metalness: 1, roughness: 0.02 });
  M.water = phys({
    color: srgb(0x6fa8b4), metalness: 0, roughness: 0.04, transmission: 0, transparent: true, opacity: 0.82,
    normalMap: T.water.normal, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.4, clearcoat: 1,
  });
  M.poolTile = std({ color: srgb(0x3d7d88), roughness: 0.3 });

  // ---- Soft furnishings ----------------------------------------------------
  M.boucle = phys({
    ...tex('boucle'), roughness: 1, color: srgb(0xd9d5cd), normalScale: new THREE.Vector2(0.9, 0.9),
    sheen: 0.6, sheenRoughness: 0.6, sheenColor: srgb(0xf4f0e8),
  });
  M.linenGrey = phys({ ...tex('linen'), roughness: 1, color: srgb(0x8e9196), sheen: 0.5, sheenRoughness: 0.5, sheenColor: srgb(0xcfd2d6) });
  M.linenDark = phys({ ...tex('linen'), roughness: 1, color: srgb(0x3d4148), sheen: 0.5, sheenRoughness: 0.5, sheenColor: srgb(0x9aa2ad) });
  M.linenSlate = phys({ ...tex('linen'), roughness: 1, color: srgb(0x5f6c78), sheen: 0.5, sheenRoughness: 0.5, sheenColor: srgb(0xaab6c2) });
  M.linenWhite = phys({ ...tex('linen'), roughness: 1, color: srgb(0xf3f1ec), sheen: 0.4, sheenRoughness: 0.5, sheenColor: srgb(0xffffff) });
  M.linenSand = phys({ ...tex('linen'), roughness: 1, color: srgb(0xc9bba6), sheen: 0.5, sheenRoughness: 0.5, sheenColor: srgb(0xf2e8d8) });
  M.velvetTaupe = phys({ ...tex('linen'), roughness: 1, color: srgb(0x7b6f66), sheen: 1, sheenRoughness: 0.35, sheenColor: srgb(0xc7b8aa) });
  M.chairFabric = phys({ ...tex('linen'), roughness: 1, color: srgb(0x9a9c9f), sheen: 0.6, sheenRoughness: 0.5, sheenColor: srgb(0xdadcde) });
  M.rug = std({ map: T.rug.map, normalMap: T.rug.normal, roughness: 1, normalScale: new THREE.Vector2(0.8, 0.8) });
  M.wool = std({ ...tex('wool'), roughness: 1, color: srgb(0xb8b2a8) });
  M.woolDark = std({ ...tex('wool'), roughness: 1, color: srgb(0x6d6a66) });
  M.sheer = phys({
    color: srgb(0xc9c7c2), roughness: 0.9, transparent: true, opacity: 0.78, side: THREE.DoubleSide,
    sheen: 0.6, sheenColor: srgb(0xffffff), sheenRoughness: 0.6, depthWrite: true,
    normalMap: T.linen.normal, normalScale: new THREE.Vector2(0.4, 0.4),
  });
  M.blackout = phys({ ...tex('linen'), roughness: 1, color: srgb(0x6b6964), side: THREE.DoubleSide, sheen: 0.6, sheenColor: srgb(0xbbb6ae) });
  M.leather = phys({ color: srgb(0x6e4a32), roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.5 });

  // ---- Lacquer / joinery ------------------------------------------------------
  M.lacquerBlack = phys({ color: srgb(0x0e0e0f), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
  M.lacquerWhite = phys({ color: srgb(0xeeece8), roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.2 });
  M.lacquerGreige = phys({ color: srgb(0x9b958c), roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.3 });
  M.ceramic = phys({ color: srgb(0xf7f6f3), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  M.ceramicDark = phys({ color: srgb(0x2b2a29), roughness: 0.3, clearcoat: 0.6 });
  M.screen = phys({ color: srgb(0x050505), roughness: 0.05, clearcoat: 1, emissive: srgb(0x000000) });
  M.art = std({ map: T.art.map, normalMap: T.art.normal, roughnessMap: T.art.orm, roughness: 1 });
  M.art2 = std({ map: T.art2.map, normalMap: T.art2.normal, roughnessMap: T.art2.orm, roughness: 1, color: srgb(0xd9e0e6) });
  M.bark = std({ ...tex('bark'), roughness: 1 });
  M.leaves = std({ map: T.leaves.map, normalMap: T.leaves.normal, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
  M.foliage = std({ color: srgb(0x40562a), roughness: 0.8 });
  M.boxwood = std({ ...tex('wool'), color: srgb(0x51683a), roughness: 1, normalScale: new THREE.Vector2(3, 3) });
  M.soil = std({ color: srgb(0x2a231c), roughness: 1 });
  M.flowerWhite = std({ color: srgb(0xf4f1ea), roughness: 0.6 });
  M.paper = std({ color: srgb(0xe8e2d6), roughness: 0.9 });

  // ---- Emissive fixtures ---------------------------------------------------
  M.downlight = std({ color: srgb(0x222222), emissive: srgb(0xffe2bd), emissiveIntensity: 0, roughness: 0.4 });
  M.ledStrip = std({ color: srgb(0x111111), emissive: srgb(0xffd7a8), emissiveIntensity: 0 });
  M.lampShade = phys({ color: srgb(0xefe7da), roughness: 0.8, emissive: srgb(0xffd6a0), emissiveIntensity: 0, side: THREE.DoubleSide, transmission: 0 });

  // Finish variants exposed to the material interaction feature.
  M.variants = {
    sofa: [
      { name: 'Ivory Bouclé', color: 0xd9d5cd },
      { name: 'Oat Bouclé', color: 0xc4b39a },
      { name: 'Dove Grey Bouclé', color: 0x9fa1a3 },
      { name: 'Moss Bouclé', color: 0x7c8068 },
    ],
    island: [
      { name: 'Grigio Carnico Marble', key: 'darkMarble' },
      { name: 'Calacatta Oro Marble', key: 'whiteMarble' },
      { name: 'Nero Basalt', key: 'slate' },
    ],
    wood: [
      { name: 'American Walnut', color: 0xffffff },
      { name: 'Smoked Oak', color: 0x8a7462 },
      { name: 'Natural Teak', color: 0xffe2c4 },
    ],
  };
  M.textures = T;
  return M;
}
