import * as THREE from 'three';
import { maker, rbox, rod, cyl, lathe, drum, cushion } from './kit.js';
import { addModel } from './assets.js';

/*
 * Bathroom, five-star hotel style: the supplied toilet, a floating fluted vanity with a stone top, an oval vessel
 * basin and a tall tap under a back-lit round mirror, and a walk-in shower with frameless glass, a micro-cement
 * tray, an illuminated niche and a rose-copper rain column. Wall tiles, floor, vanity and metalwork are
 * customisable surfaces (see ../surfaces.js).
 */
export function bath(ctx) {
  const { mat, piece } = maker(ctx);
  const S = ctx.surf;
  const metal = S.bathMetal, glass = mat('D_Glass'), black = mat('L_BlackMatte');
  const glow = ctx.roomMat('bath', 'L_Halo');     // switches with the bathroom lights

  // ---- toilet (the supplied model), against the south wall and facing north
  {
    const p = piece('Toilet', 'Toilet', 1.5, 1.225 + 0.385, 180);
    addModel(p, ctx, 'toilet');
    p.finish();
  }
  // toilet-roll holder and a slim shelf on the wall beside it
  {
    const p = piece('ToiletRoll', 'Toilet-roll holder', 1.88, 1.25, 180, { flat: true });
    p.add(rbox(0.12, 0.03, 0.03, 0.006).translate(0, 0.7, 0.0), metal, { noFootprint: true });
    p.add(cyl(0.055, 0.1, 0, 0, 24, 0.055, 0.0).rotateZ(Math.PI / 2).translate(0, 0.74, 0.04), mat('D_Linen'), { noFootprint: true });
    p.finish();
  }

  // ---- floating vanity on the north wall
  {
    const p = piece('Vanity', 'Vanity', 1.55, 3.78, 0, { fixed: true });
    p.add(rbox(1.2, 0.46, 0.46, 0.008).translate(0, 0.5, 0), S.vanityFront);                         // wall-hung cabinet
    p.add(rbox(1.0, 0.012, 0.012, 0.003).translate(0, 0.62, 0.232), metal, { noFootprint: true });  // pull rail
    p.add(rbox(1.26, 0.04, 0.52, 0.005).translate(0, 0.77, 0.0), S.vanityTop);                       // stone top
    p.add(rbox(1.0, 0.012, 0.02, 0.004).translate(0, 0.24, 0.0), glow, { noFootprint: true });       // under-cabinet glow
    // oval vessel basin: a lathe stretched into an ellipse
    p.add(lathe([[0.0, 0.0], [0.09, 0.0], [0.15, 0.05], [0.2, 0.11], [0.215, 0.14], [0.205, 0.145], [0.19, 0.12], [0.14, 0.06], [0.08, 0.012], [0.0, 0.008]], 56).scale(1.25, 1, 0.9).translate(0.0, 0.79, 0.02), mat('D_Ceramic'));
    // tall single-lever tap and its spout
    p.add(rod([0.0, 0.79, -0.19], [0.0, 1.07, -0.19], 0.012, 16), metal);
    p.add(rod([0.0, 1.07, -0.19], [0.0, 1.04, -0.07], 0.009, 14), metal);
    p.add(rbox(0.03, 0.06, 0.012, 0.004).translate(0.045, 0.86, -0.19), metal);
    // back-lit round mirror: mirror disc over a glowing halo
    p.add(cyl(0.46, 0.01, 0, 0, 72, 0.46, 0).rotateX(Math.PI / 2).translate(0, 1.62, -0.222), mat('D_Mirror'), { noFootprint: true });
    p.add(cyl(0.49, 0.008, 0, 0, 72, 0.49, 0).rotateX(Math.PI / 2).translate(0, 1.62, -0.229), glow, { noFootprint: true });
    // soap dispenser, tumbler and a small tray
    p.add(rbox(0.07, 0.015, 0.07, 0.005).translate(-0.42, 0.8, 0.0), S.vanityTop, { noFootprint: true });
    p.add(lathe([[0.001, 0], [0.032, 0], [0.034, 0.12], [0.012, 0.15], [0.001, 0.15]], 20).translate(-0.42, 0.81, 0.0), mat('D_Ceramic'), { noFootprint: true });
    p.add(cyl(0.014, 0.09, -0.42, 0.0, 12, 0.014, 0.96), metal, { noFootprint: true });
    p.add(cyl(0.035, 0.1, 0.44, 0.04, 20, 0.032, 0.79), glass, { noFootprint: true });
    p.finish();
  }

  // ---- walk-in shower, south-west corner
  {
    const p = piece('Shower', 'Shower', 0.7, 1.7, 0, { fixed: true });
    p.add(rbox(0.8, 0.03, 0.975, 0.006).translate(0, 0.015, -0.0125), mat('X_Microcement'), { noFootprint: true });     // low-profile tray
    p.add(rbox(0.7, 0.004, 0.02, 0.002).translate(0, 0.031, -0.38), black, { noFootprint: true });                      // linear drain
    // frameless 10 mm glass with slim bronze clamps
    p.add(rbox(0.01, 2.1, 0.525, 0.002, 1).translate(0.4, 1.05, 0.21), glass, { cast: false });
    p.add(rbox(0.8, 2.1, 0.01, 0.002, 1).translate(0, 1.05, -0.5), glass, { cast: false });
    for (const y of [0.25, 1.1, 1.95]) {
      p.add(rbox(0.03, 0.06, 0.03, 0.006).translate(0.4, y, 0.46), mat('D_Bronze'), { noFootprint: true });
      p.add(rbox(0.04, 0.06, 0.03, 0.006).translate(-0.3, y, -0.5), mat('D_Bronze'), { noFootprint: true });
    }
    p.add(rbox(0.014, 1.7, 0.014, 0.003).translate(0.4, 1.0, -0.05), mat('D_Bronze'), { noFootprint: true });              // end bar
    // thermostatic column on the south wall: rain head on an arm, hand shower and a bar valve
    p.add(rod([0.0, 0.9, 0.465], [0.0, 2.12, 0.465], 0.012, 14), metal, { noFootprint: true });
    p.add(rod([0.0, 2.12, 0.465], [0.0, 2.12, 0.1], 0.012, 14).rotateX(Math.PI / 2), metal, { noFootprint: true });
    p.add(cyl(0.14, 0.012, 0, 0.1, 56, 0.14, 2.1), metal, { noFootprint: true });
    p.add(rbox(0.26, 0.09, 0.05, 0.012).translate(0.0, 1.22, 0.45), metal, { noFootprint: true });
    p.add(cyl(0.03, 0.2, -0.09, 0.42, 16, 0.024, 0.95), metal, { noFootprint: true });
    // recessed niche on the west wall with a warm strip light and two bottles
    p.add(rbox(0.02, 0.012, 0.5, 0.003).translate(-0.395, 1.35, -0.1), glow, { noFootprint: true });
    for (const [z, h, c] of [[-0.2, 0.18, 'D_Ceramic'], [0.0, 0.14, 'L_Terracotta']]) p.add(cyl(0.03, h, -0.36, z, 16, 0.03, 1.2), mat(c), { noFootprint: true });
    p.finish();
  }

  // ---- heated towel rail on the east wall, towels, mat, stool
  {
    const p = piece('TowelRail', 'Towel rail', 2.63, 3.45, -90, { flat: true });
    for (const y of [0.9, 1.1, 1.3, 1.5, 1.7]) p.add(rod([-0.25, y, 0], [0.25, y, 0], 0.011, 12), metal, { noFootprint: true });
    for (const s of [-0.25, 0.25]) p.add(rod([s, 0.85, 0], [s, 1.75, 0], 0.014, 12), metal, { noFootprint: true });
    p.add(rbox(0.46, 0.5, 0.025, 0.012).translate(0, 1.4, 0.03), mat('L_Towel0'), { noFootprint: true });
    p.add(rbox(0.46, 0.5, 0.025, 0.012).translate(0, 1.0, 0.03), mat('L_Towel1'), { noFootprint: true });
    p.finish();
  }
  {
    const p = piece('BathMat', 'Bath mat', 1.25, 2.9, 0, { flat: true });
    p.add(rbox(0.9, 0.02, 0.55, 0.01, 2).translate(0, 0.01, 0), mat('D_Rug'), { cast: false });
    p.finish();
  }
  {
    const p = piece('Stool_Bath', 'Bath stool', 0.62, 3.25, 0);
    p.add(drum(0.2, 0.04, 0.012, 48).translate(0, 0.34, 0), mat('D_Veneer'));
    p.add(cyl(0.14, 0.34, 0, 0, 40, 0.14), mat('D_Veneer'));
    p.add(cushion(0.3, 0.07, 0.2, 0.025, 0.2).translate(0, 0.415, 0), mat('L_Towel0'));
    p.add(cushion(0.3, 0.06, 0.2, 0.025, 0.2).translate(0, 0.48, 0), mat('L_Towel1'));
    p.add(cyl(0.035, 0.08, 0.08, 0.0, 20, 0.035, 0.51), mat('L_Candle'));
    p.finish();
  }
  void THREE;
}
