import * as THREE from 'three';

/*
 * Customisable finishes. A "surface" is a material dedicated to one part of the home (the kitchen doors, the
 * kitchen worktop, the bathroom floor ...). Every surface starts as a copy of one of the apartment's PBR
 * materials and can be re-finished with any option of its family: stone, cabinetry or metal. Options copy the
 * full PBR set (albedo, normal and roughness maps, colour, roughness, metalness, clear-coat) so a change looks
 * exactly like the real material, and the choice is saved with the rest of the customisation.
 */

const lac = (id, label, hex, rough = 0.32) => ({ id, label, color: hex, flat: { color: hex, rough, clearcoat: 0.35 } });
const mat = (id, label, from, swatch) => ({ id, label, color: swatch, from });

export const FAMILIES = {
  stone: [
    mat('calacatta', 'Calacatta cream', 'D_Marble', '#e8e2d6'),
    mat('statuario', 'Statuario', 'D_MarbleProp', '#d9dadb'),
    mat('rosso', 'Rosso marble', 'L_MarbleTerracotta', '#b7694f'),
    mat('onyx', 'Blue onyx', 'L_MarbleScallop', '#6d7884'),
    mat('travertine', 'Travertine', 'D_Travertine', '#d8ccb4'),
    { id: 'quartzWhite', label: 'White quartz', color: '#eceae4', flat: { color: '#eceae4', rough: 0.16, clearcoat: 0.6 } },
    { id: 'quartzCharcoal', label: 'Charcoal quartz', color: '#3a3b3e', flat: { color: '#3a3b3e', rough: 0.16, clearcoat: 0.6 } },
    { id: 'porcelain', label: 'Soft porcelain', color: '#d8d4cd', flat: { color: '#d8d4cd', rough: 0.2, clearcoat: 0.55 } },
    mat('concrete', 'Microcement', 'X_Microcement', '#b9b1a6'),
    { id: 'sandstone', label: 'Sand porcelain', color: '#d6c9b3', flat: { color: '#d6c9b3', rough: 0.22, clearcoat: 0.5 } },
  ],
  cabinet: [
    mat('flutedWalnut', 'Fluted walnut', 'L_Fluted', '#6b4a36'),
    mat('walnut', 'Walnut', 'D_Veneer', '#7a5740'),
    mat('oak', 'Natural oak', 'D_Oak', '#c9a77c'),
    lac('white', 'White lacquer', '#f1efea'),
    lac('greige', 'Greige', '#b9afa2'),
    lac('sage', 'Sage', '#a3ae98'),
    lac('terracotta', 'Terracotta', '#b8694c'),
    lac('navy', 'Midnight blue', '#2f3b52'),
    lac('charcoal', 'Charcoal', '#3b3b3e'),
  ],
  metal: [
    mat('brass', 'Brushed brass', 'D_Brass', '#c8a86a'),
    mat('chrome', 'Polished chrome', 'D_Chrome', '#d3d6d9'),
    mat('bronze', 'Bronze', 'D_Bronze', '#8a6a4a'),
    mat('copper', 'Rose copper', 'D_Copper', '#c4806a'),
    { id: 'black', label: 'Matte black', color: '#1c1c1e', flat: { color: '#1c1c1e', rough: 0.45, metal: 0.7 } },
  ],
};

export class Surfaces {
  constructor(M) {
    this.M = M;
    this.map = new Map();   // id -> { id, label, group, family, base, material, option, def }
    this.batch = null;      // the Batcher, whose per-zone clones of a surface must follow it
  }

  /** Mirror a surface's properties onto its probe-zone clones (they keep their own environment maps). */
  _sync(m) {
    for (const byMat of this.batch?.zoneMaterials?.values() || []) {
      const c = byMat.get(m);
      if (c) { this._copy(c, m); c.needsUpdate = true; }
    }
  }

  /** Register a surface and return the material to put on the geometry. */
  define(id, { label, group, family, base, option = null }) {
    const m = new THREE.MeshPhysicalMaterial();
    m.name = `surface:${id}`;
    m.userData.noZone = false;
    const s = { id, label, group, family, base, material: m, option, def: option };
    this.map.set(id, s);
    this._copy(m, this.M.get(base));
    if (option) this.set(id, option, false);
    return m;
  }

  get(id) { return this.map.get(id) || null; }
  list() { return [...this.map.values()]; }
  groups() { return [...new Set(this.list().map((s) => s.group))]; }
  options(id) { return FAMILIES[this.map.get(id).family]; }

  /** Switch a surface to one of its family's options. */
  set(id, optionId, notify = true) {
    const s = this.map.get(id);
    const o = FAMILIES[s.family]?.find((x) => x.id === optionId);
    if (!s || !o) return false;
    const m = s.material;
    if (o.from) this._copy(m, this.M.get(o.from));
    else {
      const f = o.flat;
      m.map = null; m.normalMap = null; m.roughnessMap = null;
      m.color.set(f.color); m.roughness = f.rough; m.metalness = f.metal ?? 0;
      m.clearcoat = f.clearcoat ?? 0; m.clearcoatRoughness = 0.08;
    }
    m.needsUpdate = true;
    this._sync(m);
    s.option = optionId;
    if (notify) this.onChange?.(id);
    return true;
  }

  /** Back to the original finish. */
  reset(id) {
    const s = this.map.get(id);
    if (!s) return;
    this._copy(s.material, this.M.get(s.base));
    s.material.needsUpdate = true;
    this._sync(s.material);
    s.option = s.def;
    if (s.def) this.set(id, s.def, false);
    this.onChange?.(id);
  }
  resetAll() { for (const s of this.map.values()) this.reset(s.id); }
  isModified() { return this.list().some((s) => s.option !== s.def); }

  /** The hex of the surface's present colour (for display). */
  hex(id) { return `#${this.map.get(id).material.color.getHexString()}`; }

  serialize() {
    const out = {};
    for (const s of this.map.values()) if (s.option !== s.def) out[s.id] = s.option;
    return out;
  }
  load(state = {}) {
    for (const [id, opt] of Object.entries(state)) if (this.map.has(id)) this.set(id, opt, false);
  }

  _copy(dst, src) {
    for (const k of ['map', 'normalMap', 'roughnessMap']) dst[k] = src[k] || null;
    if (src.normalScale) dst.normalScale.copy(src.normalScale);
    dst.color.copy(src.color);
    dst.roughness = src.roughness ?? 1;
    dst.metalness = src.metalness ?? 0;
    dst.clearcoat = src.clearcoat ?? 0;
    dst.clearcoatRoughness = src.clearcoatRoughness ?? 0.1;
    dst.sheen = src.sheen ?? 0;
    dst.vertexColors = false;
  }
}

/** Every customisable surface of the apartment. */
export function defineSurfaces(S) {
  const d = (id, label, group, family, base, option) => S.define(id, { label, group, family, base, option });
  return {
    // kitchen
    kitchenDoors: d('kitchenDoors', 'Cabinet doors', 'Kitchen', 'cabinet', 'L_Fluted'),
    islandBase: d('islandBase', 'Island base', 'Kitchen', 'cabinet', 'L_Fluted'),
    worktop: d('worktop', 'Worktop & island top', 'Kitchen', 'stone', 'D_Marble'),
    splash: d('splash', 'Backsplash', 'Kitchen', 'stone', 'D_Marble'),
    handles: d('handles', 'Handles & taps', 'Kitchen', 'metal', 'D_Brass'),
    // dining
    tableTop: d('tableTop', 'Table top', 'Dining', 'stone', 'D_Marble'),
    tableBase: d('tableBase', 'Table base', 'Dining', 'cabinet', 'D_Veneer'),
    // bathroom
    bathFloor: d('bathFloor', 'Floor', 'Bathroom', 'stone', 'L_MarbleScallop'),
    bathWalls: d('bathWalls', 'Wall tiles', 'Bathroom', 'stone', 'L_StoneBeige', 'porcelain'),
    showerWall: d('showerWall', 'Shower wall', 'Bathroom', 'stone', 'L_MarbleTerracotta'),
    vanityFront: d('vanityFront', 'Vanity', 'Bathroom', 'cabinet', 'L_Fluted'),
    vanityTop: d('vanityTop', 'Vanity top', 'Bathroom', 'stone', 'D_Marble'),
    bathMetal: d('bathMetal', 'Taps & shower', 'Bathroom', 'metal', 'D_Copper'),
  };
}
