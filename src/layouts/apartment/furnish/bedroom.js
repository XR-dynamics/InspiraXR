import * as THREE from 'three';
import { addModel } from './assets.js';
import { wardrobe } from './wardrobe.js';
import { maker, rbox, rod, cyl, cushion, drum, lathe } from './kit.js';

/* Bedroom: upholstered king bed against the west wall, bedside tables, bench, fluted wardrobe, rug. */
export function bedroom(ctx) {
  const { mat, piece } = maker(ctx);
  const wood = mat('D_Veneer'), flute = mat('L_Fluted'), boucle = mat('D_Boucle'), linen = mat('D_Linen');

  {
    const p = piece('Rug_Bedroom', 'Wool rug', 2.55, 6.3, 0, { flat: true });
    p.add(rbox(3.4, 0.016, 2.8, 0.008, 2).translate(0, 0.008, 0), mat('D_Rug'), { cast: false });
    p.finish();
  }

  // bed: the supplied model, headboard on the west wall (local +z faces the foot -> yaw 90)
  {
    const p = piece('Bed', 'King bed', 1.4, 6.3, 90);
    addModel(p, ctx, 'ix_bed');
    p.finish();
  }

  for (const [id, y] of [['Bedside_1', 4.55], ['Bedside_2', 8.05]]) {
    const p = piece(id, 'Bedside table', 0.55, y, 90);
    p.add(rbox(0.46, 0.46, 0.44, 0.012).translate(0, 0.34, 0), flute);
    p.add(rbox(0.5, 0.025, 0.48, 0.008).translate(0, 0.585, 0), mat('D_Marble'));
    for (const sx of [-0.2, 0.2]) for (const sz of [-0.18, 0.18]) p.add(rod([sx, 0, sz], [sx, 0.11, sz], 0.012, 10, 0.016), mat('D_Brass'));
    // little lamp
    p.add(cyl(0.05, 0.02, 0, 0, 24, 0.05, 0.6), mat('D_Brass'));
    p.add(rod([0, 0.62, 0], [0, 0.82, 0], 0.008, 8), mat('D_Brass'));
    p.add(lathe([[0.1, 0], [0.15, 0.18], [0.145, 0.185], [0.095, 0.01]], 32).translate(0, 0.8, 0), mat('D_Linen'));
    p.finish();
  }

  // bench at the foot of the bed
  {
    const p = piece('Bench', 'Bench', 2.85, 6.3, 90);
    p.add(rbox(1.5, 0.08, 0.42, 0.03, 4).translate(0, 0.43, 0), mat('L_BoucleTan'));
    p.add(rbox(1.46, 0.05, 0.38, 0.01).translate(0, 0.375, 0), wood);
    for (const sx of [-0.65, 0.65]) p.add(rbox(0.04, 0.36, 0.36, 0.01).translate(sx, 0.18, 0), wood);
    p.finish();
  }

  // wardrobe along the east wall (open front; clothes, shelves and shoes inside)
  wardrobe(ctx, { id: 'Wardrobe_Bedroom', name: 'Wardrobe', x: 4.1, y: 6.9, yaw: -90, w: 2.8, d: 0.62, h: 2.5 });

  // reading chair and a floor lamp by the window
  {
    const p = piece('Chair_Bedroom', 'Reading chair', 3.45, 7.85, -35);
    p.add(cushion(0.7, 0.16, 0.66, 0.07, 0.25).translate(0, 0.38, 0.0), mat('L_BoucleGreen'));
    p.add(cushion(0.7, 0.5, 0.18, 0.07, 0.25).translate(0, 0.66, -0.3).rotateX(-0.12), mat('L_BoucleGreen'));
    p.add(cushion(0.12, 0.3, 0.62, 0.05, 0.2).translate(-0.36, 0.5, 0), mat('L_BoucleGreen'));
    p.add(cushion(0.12, 0.3, 0.62, 0.05, 0.2).translate(0.36, 0.5, 0), mat('L_BoucleGreen'));
    for (const sx of [-0.3, 0.3]) for (const sz of [-0.26, 0.26]) p.add(rod([sx, 0, sz], [sx * 1.03, 0.3, sz], 0.012, 10, 0.017), mat('D_Brass'));
    p.finish();
  }
  void THREE; void drum;
}
