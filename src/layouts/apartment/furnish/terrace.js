import * as THREE from 'three';
import { addModel } from './assets.js';
import { maker, rbox, rod, cyl, cushion, drum, bar } from './kit.js';

/* Terrace: two teak lounge chairs with linen cushions facing the sea, a side table and a daybed. */
export function terrace(ctx) {
  const { mat, piece } = maker(ctx);
  const teak = mat('P_Teak'), cush = mat('D_Linen');
  // the supplied curved outdoor sectional, its cushions and an octagonal glass-top table
  {
    const p = piece('TerraceSofa', 'Outdoor sofa', 12.95, 4.85, 90);
    addModel(p, ctx, 'terrace_sofa', { scale: 0.85 });
    for (const dx of [-0.85, 0, 0.85]) addModel(p, ctx, 'terrace_cushion', { x: dx, y: 0.38, z: -0.38, ry: 0, scale: 0.85 });
    p.finish();
  }
  {
    const p = piece('TerraceTable', 'Outdoor table', 11.95, 4.85);
    addModel(p, ctx, 'terrace_table');
    p.finish();
  }
  void THREE; void rod;
}
