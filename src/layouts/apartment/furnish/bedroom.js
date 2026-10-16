import * as THREE from 'three';
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

  // bed: headboard at x = 0.3, long axis along +x (local +z faces the foot -> yaw 90)
  {
    const p = piece('Bed', 'King bed', 1.4, 6.3, 90);
    p.add(rbox(2.0, 0.22, 2.1, 0.02).translate(0, 0.19, 0.0), wood);                         // base
    p.add(rbox(1.96, 0.04, 2.06, 0.015).translate(0, 0.32, 0), boucle);                       // upholstered rail
    p.add(cushion(1.88, 0.26, 1.98, 0.08, 0.3).translate(0, 0.46, 0.02), linen);              // mattress
    p.add(rbox(2.1, 1.1, 0.12, 0.03, 4).translate(0, 0.65, -1.02), boucle);                   // headboard
    p.add(rbox(2.0, 0.04, 0.05, 0.01).translate(0, 1.18, -1.02), wood);
    for (const sx of [-0.45, 0.45]) p.add(cushion(0.72, 0.16, 0.26, 0.06, 0.45).translate(sx, 0.69, -0.72), linen);   // pillows
    p.add(cushion(0.45, 0.14, 0.4, 0.06, 0.45).translate(0.0, 0.7, -0.35), boucle);
    p.add(cushion(1.92, 0.05, 0.6, 0.02, 0.5).translate(0, 0.62, 0.62), mat('L_BoucleTan'));  // folded throw
    for (const sx of [-0.9, 0.9]) for (const sz of [-0.95, 0.95]) p.add(rbox(0.06, 0.1, 0.06, 0.01).translate(sx, 0.05, sz), mat('L_BlackMatte'));
    p.finish();
  }

  for (const [id, y] of [['Bedside_1', 4.9], ['Bedside_2', 7.7]]) {
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

  // wardrobe along the east wall (doors face west)
  {
    const p = piece('Wardrobe', 'Wardrobe', 4.12, 6.9, -90, { fixed: true });
    p.add(rbox(2.8, 2.55, 0.6, 0.012).translate(0, 1.275, 0), flute);
    p.add(rbox(2.8, 0.08, 0.04, 0.004).translate(0, 0.04, 0.3), mat('L_BlackMatte'));
    for (const sx of [-0.7, 0.0, 0.7]) p.add(rbox(0.006, 2.4, 0.01, 0.002, 1).translate(sx, 1.25, 0.302), mat('L_BlackMatte'));
    for (const sx of [-0.04, 0.04, -0.66, 0.66]) p.add(rbox(0.012, 0.5, 0.02, 0.004).translate(sx + (sx > 0 ? 0.0 : 0.0), 1.2, 0.315), mat('D_Brass'));
    p.finish();
  }

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
