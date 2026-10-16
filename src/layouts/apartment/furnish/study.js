import * as THREE from 'three';
import { maker, rbox, rod, cyl, cushion, lathe } from './kit.js';

/* Study: walnut desk under the window, leather-look chair, full-height bookcase with books. */
export function study(ctx) {
  const { mat, piece } = maker(ctx);
  const wood = mat('D_Veneer'), flute = mat('L_Fluted');

  {
    const p = piece('Desk', 'Writing desk', 5.9, 7.95, 0);
    p.add(rbox(1.7, 0.04, 0.75, 0.01).translate(0, 0.74, 0), wood);
    p.add(rbox(0.05, 0.72, 0.7, 0.01).translate(-0.8, 0.36, 0), wood);
    p.add(rbox(0.05, 0.72, 0.7, 0.01).translate(0.8, 0.36, 0), wood);
    p.add(rbox(1.55, 0.3, 0.02, 0.005).translate(0, 0.52, -0.32), wood);
    p.add(rbox(0.4, 0.03, 0.28, 0.008).translate(-0.4, 0.775, 0.0), mat('L_BlackMatte'));            // laptop base
    p.add(rbox(0.38, 0.24, 0.01, 0.004).translate(-0.4, 0.89, -0.13).rotateX(0.0), mat('L_TVGlass'));  // screen
    p.add(cyl(0.05, 0.02, 0.6, -0.2, 24, 0.05, 0.76), mat('D_Brass'));
    p.add(rod([0.6, 0.78, -0.2], [0.6, 1.0, -0.2], 0.007, 8), mat('D_Brass'));
    p.add(lathe([[0.06, 0], [0.1, 0.12], [0.095, 0.125], [0.055, 0.01]], 24).translate(0.6, 0.98, -0.2), mat('D_Linen'));
    p.finish();
  }
  {
    const p = piece('DeskChair', 'Desk chair', 5.9, 7.1, 180);
    p.add(cushion(0.52, 0.09, 0.5, 0.04, 0.3).translate(0, 0.46, 0), mat('L_BoucleRust'));
    p.add(cushion(0.5, 0.42, 0.1, 0.045, 0.3).translate(0, 0.78, -0.22).rotateX(-0.08), mat('L_BoucleRust'));
    p.add(rod([0, 0.1, 0], [0, 0.42, 0], 0.02, 12), mat('D_Chrome'));
    p.add(cyl(0.26, 0.015, 0, 0, 5, 0.26, 0.08), mat('D_Chrome'));
    for (let i = 0; i < 5; i++) { const t = (i / 5) * Math.PI * 2; p.add(rod([0, 0.09, 0], [Math.sin(t) * 0.26, 0.05, Math.cos(t) * 0.26], 0.012, 8), mat('D_Chrome')); }
    p.finish();
  }
  {
    const p = piece('Bookcase', 'Bookcase', 6.95, 7.0, -90, { fixed: true });
    p.add(rbox(2.2, 2.4, 0.34, 0.01).translate(0, 1.2, 0), flute);
    p.add(rbox(2.04, 2.26, 0.3, 0.004).translate(0, 1.2, 0.03), mat('D_Oak'));
    for (let s = 0; s < 5; s++) {
      const y = 0.12 + s * 0.47;
      p.add(rbox(2.06, 0.025, 0.31, 0.003).translate(0, y, 0.025), wood);
      let x = -0.98;
      let k = 0;
      while (x < 0.9) {
        const w = 0.03 + ((s * 7 + k * 13) % 5) * 0.008, h = 0.24 + ((s * 5 + k * 11) % 6) * 0.03;
        p.add(rbox(w, h, 0.22, 0.003, 1).translate(x + w / 2, y + 0.0125 + h / 2, 0.02), mat(`L_Book${(s + k) % 6}`));
        x += w + 0.002; k++;
        if (k % 9 === 8) x += 0.28;   // gap for an object
      }
    }
    p.finish();
  }
  void THREE;
}
