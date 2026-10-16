import * as THREE from 'three';
import { maker, rbox, rod, cyl, drum, bar, lathe } from './kit.js';

/* Kitchen: a run of walnut cabinets under the window with a marble top, a tall unit and a marble island with stools. */
export function kitchen(ctx) {
  const { mat, piece } = maker(ctx);
  const wood = mat('D_Veneer'), flute = mat('L_Fluted'), stone = mat('D_Marble'), steel = mat('L_BrushedSteel'), black = mat('L_BlackMatte');

  // ---- base run along the south wall, window above it
  {
    const x0 = 5.5, x1 = 10.45, y0 = 0.25, depth = 0.62, hgt = 0.9;
    const L = x1 - x0, cx = (x0 + x1) / 2;
    const p = piece('Kitchen_Run', 'Kitchen cabinets', cx, y0 + depth / 2, 0, { fixed: true });
    p.add(rbox(L, 0.1, depth - 0.04, 0.01).translate(0, 0.05, -0.02), black);                       // plinth shadow
    p.add(rbox(L, hgt - 0.14, depth, 0.01).translate(0, 0.1 + (hgt - 0.14) / 2, 0), flute);       // carcass with fluted fronts
    p.add(rbox(L + 0.02, 0.04, depth + 0.03, 0.006).translate(0, hgt + 0.02 - 0.04, 0.012), stone); // marble top
    // door and drawer joints
    const n = Math.round(L / 0.6);
    for (let i = 1; i < n; i++) p.add(rbox(0.006, hgt - 0.2, 0.004, 0.001, 1).translate(-L / 2 + (i * L) / n, 0.1 + (hgt - 0.14) / 2, depth / 2 + 0.001), black);
    // under-mount sink and tap
    p.add(rbox(0.7, 0.012, 0.4, 0.004).translate(-0.9, hgt + 0.0, 0.01), steel);
    p.add(rod([-0.9, hgt, -0.22], [-0.9, hgt + 0.3, -0.22], 0.012, 12), mat('D_Chrome'));
    p.add(rod([-0.9, hgt + 0.3, -0.22], [-0.9, hgt + 0.3, -0.1], 0.011, 12).rotateX(Math.PI / 2).translate(0, 0, 0), mat('D_Chrome'));
    // induction hob
    p.add(rbox(0.6, 0.008, 0.5, 0.004).translate(1.3, hgt + 0.002, 0.0), black);
    for (const [hx, hz] of [[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.12], [0.14, 0.12]]) p.add(cyl(0.085, 0.002, 1.3 + hx, hz, 40, 0.085, hgt + 0.006), steel);
    p.finish();
  }

  // ---- tall unit at the open end of the kitchen
  {
    const p = piece('Kitchen_Tall', 'Tall cabinet', 5.0, 0.58, 0, { fixed: true });
    p.add(rbox(0.8, 2.3, 0.62, 0.012).translate(0, 1.15, 0), flute);
    p.add(rbox(0.012, 1.4, 0.03, 0.004).translate(0.32, 1.15, 0.325), mat('D_Brass'));
    p.finish();
  }

  // ---- island
  {
    const p = piece('Kitchen_Island', 'Kitchen island', 7.7, 2.25, 0, { fixed: true });
    p.add(rbox(2.7, 0.78, 0.7, 0.012).translate(0, 0.45, 0), flute);
    p.add(rbox(2.84, 0.04, 0.88, 0.006).translate(0, 0.88, 0.05), stone);
    p.add(rbox(2.6, 0.08, 0.64, 0.01).translate(0, 0.04, 0), black);
    p.finish();
  }

  // ---- three counter stools on the dining side
  [-0.8, 0, 0.8].forEach((dx, i) => {
    const p = piece(`Stool_${i + 1}`, 'Counter stool', 7.7 + dx, 2.95, 180);
    p.add(cyl(0.2, 0.06, 0, 0, 40, 0.2, 0.62), mat('D_Boucle'));
    p.add(cyl(0.19, 0.02, 0, 0, 40, 0.19, 0.6), wood);
    for (const a of [0, 1, 2, 3]) {
      const t = (a / 4) * Math.PI * 2 + Math.PI / 4;
      p.add(rod([Math.sin(t) * 0.2, 0, Math.cos(t) * 0.2], [Math.sin(t) * 0.14, 0.6, Math.cos(t) * 0.14], 0.012, 12, 0.017), mat('D_Brass'));
    }
    p.add(lathe([[0.17, 0.24], [0.2, 0.24], [0.2, 0.255], [0.17, 0.255]], 40), mat('D_Brass'));
    p.finish();
  });
  void THREE; void drum; void bar;
}
