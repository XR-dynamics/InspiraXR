import * as THREE from 'three';
import { maker, rbox, rod, cyl, cushion, lathe, drum } from './kit.js';

/* Entrance: a fluted console with a round brass mirror, a bench and a sculptural vase. */
export function entry(ctx) {
  const { mat, piece } = maker(ctx);
  {
    const p = piece('Console', 'Console', 2.82, 3.4, 90, { fixed: true });
    p.add(rbox(1.2, 0.22, 0.3, 0.01).translate(0, 0.78, 0), mat('L_Fluted'));
    p.add(rbox(1.24, 0.03, 0.34, 0.006).translate(0, 0.905, 0), mat('D_Marble'));
    for (const sx of [-0.55, 0.55]) p.add(rbox(0.04, 0.67, 0.28, 0.008).translate(sx, 0.335, 0), mat('D_Veneer'));
    p.add(cyl(0.5, 0.025, 0, -0.14, 64, 0.5, 0).rotateX(Math.PI / 2).translate(0, 1.6, 0.0), mat('D_Mirror'), { noFootprint: true });
    p.add(cyl(0.515, 0.015, 0, -0.145, 64, 0.515, 0).rotateX(Math.PI / 2).translate(0, 1.6, 0), mat('D_Brass'), { noFootprint: true });
    p.add(lathe([[0.0, 0], [0.07, 0], [0.11, 0.1], [0.07, 0.24], [0.04, 0.3], [0.05, 0.36], [0.045, 0.36], [0.03, 0.3], [0.06, 0.24], [0.1, 0.1], [0.0, 0.01]], 40).translate(0.35, 0.92, 0), mat('D_Ceramic'));
    p.finish();
  }
  {
    const p = piece('Bench_Entry', 'Entry bench', 3.9, 2.55, -90);
    p.add(cushion(1.1, 0.1, 0.38, 0.04, 0.25).translate(0, 0.44, 0), mat('L_BoucleTan'));
    p.add(rbox(1.06, 0.06, 0.34, 0.01).translate(0, 0.39, 0), mat('D_Veneer'));
    for (const sx of [-0.45, 0.45]) p.add(rbox(0.05, 0.36, 0.32, 0.01).translate(sx, 0.18, 0), mat('D_Veneer'));
    p.finish();
  }
  void THREE; void rod; void drum;
}
