import * as THREE from 'three';

/*
 * Places the supplied furniture models (packed by tools/build-models.mjs) into a Piece. Faces are split by
 * material "role"; each model has a table mapping roles to the apartment's PBR materials.
 */

const ROLES = {
  dining_chair: { fabric: 'D_Boucle', wood: 'D_Veneer', other: 'D_Veneer' },
  dining_table: { black: 'surface:tableTop', wood: 'surface:tableBase' },
  coffee_drum: { brass: 'D_Bronze', black: 'D_Veneer' },
  ix_bed: { wood: 'D_Veneer', fabric: 'D_Boucle', brass: 'D_Brass', black: 'L_BlackMatte', sheet: 'D_Linen', throw: 'L_BoucleTan' },
  ix_sofa: { fabric: 'X_SofaLinen', wood: 'D_Veneer' },
  terrace_sofa: { wicker: 'X_Wicker', wood_dark: 'X_WoodGraphite', fabric: 'X_OutdoorFabric' },
  terrace_cushion: { fabric: 'X_OutdoorFabric' },
  terrace_table: { wood: 'P_Teak', wicker: 'X_Wicker', glass_green: 'D_Glass', glass: 'D_Glass' },
  toilet: { ceramic: 'D_Ceramic' },
  books: {},
};

/** Add every part of a pack model to the piece. opts: { scale, y, x, z, ry, roles } */
export function addModel(piece, ctx, name, opts = {}) {
  const { scale = 1, x = 0, y = 0, z = 0, ry = 0, roles = {} } = opts;
  const map = { ...ROLES[name], ...roles };
  const mt = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(scale, scale, scale));
  for (const { material, geo } of ctx.pack.furn.geometries(name, mt)) {
    let mn = map[material];
    if (mn?.startsWith('surface:')) { piece.add(geo, ctx.surf[mn.slice(8)]); continue; }
    if (!mn && material.startsWith('book:')) mn = `L_Book${parseInt(material.slice(5), 10) % 6}`;
    piece.add(geo, ctx.M.get(mn || 'D_Plaster'));
  }
}

/** Extra surface materials the supplied models need that the plan's material list does not name. */
export function extraMaterials(M) {
  const add = (name, m) => { m.name = name; M.byName.set(name, m); };
  const cane = M.textures?.cane;
  add('D_Copper', new THREE.MeshStandardMaterial({ color: 0xe0a088, metalness: 1, roughness: 0.2 }));
  add('D_Bronze', new THREE.MeshStandardMaterial({ color: 0x8a6a4a, metalness: 1, roughness: 0.28 }));
  add('X_Wicker', new THREE.MeshStandardMaterial({ color: 0x7a6552, roughness: 0.8, ...(cane ? { normalMap: cane.normal, normalScale: new THREE.Vector2(1.6, 1.6) } : {}) }));
  add('X_WoodGraphite', new THREE.MeshStandardMaterial({ color: 0x3b3d40, roughness: 0.35 }));
  add('X_OutdoorFabric', new THREE.MeshPhysicalMaterial({ color: 0xd9d4ca, roughness: 0.9, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color(1, 1, 1) }));
}
