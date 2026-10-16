import * as THREE from 'three';
import { maker, rbox, rod, cyl, cushion, drum, bar } from './kit.js';

/* Terrace: two teak lounge chairs with linen cushions facing the sea, a side table and a daybed. */
export function terrace(ctx) {
  const { mat, piece } = maker(ctx);
  const teak = mat('P_Teak'), cush = mat('D_Linen');
  const lounger = (id, y) => {
    const p = piece(id, 'Lounge chair', 12.55, y, 90);
    // low teak frame with a reclined back
    for (const sx of [-0.33, 0.33]) {
      p.add(bar([sx, 0.0, 0.5], [sx, 0.27, 0.5], 0.05, 0.05, 0.008), teak);
      p.add(bar([sx, 0.0, -0.35], [sx, 0.27, -0.35], 0.05, 0.05, 0.008), teak);
      p.add(bar([sx, 0.27, 0.5], [sx, 0.27, -0.35], 0.05, 0.05, 0.008), teak);
      p.add(bar([sx, 0.27, -0.35], [sx, 0.75, -0.62], 0.05, 0.05, 0.008), teak);
    }
    for (let i = 0; i < 8; i++) p.add(rbox(0.68, 0.025, 0.07, 0.006).translate(0, 0.285, 0.46 - i * 0.1), teak);
    p.add(cushion(0.64, 0.1, 0.88, 0.04, 0.3).translate(0, 0.35, 0.05), cush);
    p.add(cushion(0.64, 0.1, 0.6, 0.04, 0.3).translate(0, 0.0, 0).rotateX(0.5).translate(0, 0.58, -0.45), cush);
    p.finish();
  };
  lounger('Lounger_1', 2.1);
  lounger('Lounger_2', 3.4);
  {
    const p = piece('TerraceTable', 'Side table', 12.55, 2.75);
    p.add(drum(0.26, 0.04, 0.01, 48).translate(0, 0.38, 0), teak);
    p.add(cyl(0.05, 0.38, 0, 0, 16, 0.07), teak);
    p.finish();
  }
  {
    const p = piece('Planter_Bench', 'Terrace bench', 13.45, 4.9, 90);
    p.add(rbox(1.8, 0.06, 0.5, 0.01).translate(0, 0.42, 0), teak);
    for (const sx of [-0.8, 0.8]) p.add(rbox(0.06, 0.4, 0.46, 0.008).translate(sx, 0.2, 0), teak);
    p.add(cushion(1.74, 0.09, 0.46, 0.04, 0.3).translate(0, 0.5, 0), cush);
    p.finish();
  }
  void THREE; void rod;
}
