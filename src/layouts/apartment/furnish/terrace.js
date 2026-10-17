import * as THREE from 'three';
import { addModel } from './assets.js';
import { maker, rbox, rod, cyl, cushion, drum, bar } from './kit.js';

/* Terrace: two teak lounge chairs with linen cushions facing the sea, a side table and a daybed. */
export function terrace(ctx) {
  const { mat, piece } = maker(ctx);
  const teak = mat('P_Teak'), cush = mat('D_Linen');
  // the supplied curved outdoor sectional, its cushions and an octagonal glass-top table
  {
    const p = piece('TerraceSofa', 'Outdoor sofa', 12.85, 4.35, 90);
    addModel(p, ctx, 'terrace_sofa');
    for (const dx of [-1.0, 0, 1.0]) addModel(p, ctx, 'terrace_cushion', { x: dx, y: 0.45, z: -0.45, ry: 0 });
    p.finish();
  }
  {
    const p = piece('TerraceTable', 'Outdoor table', 12.0, 4.35);
    addModel(p, ctx, 'terrace_table');
    p.finish();
  }
  void THREE; void rod;
}
