import * as THREE from 'three';
import { maker, rbox, rod, cyl, drum, bar, lathe, slab, superellipse, cushion } from './kit.js';
import { addModel } from './assets.js';

/*
 * Kitchen: handle-less cabinetry with a brass pull rail, a full-height marble backsplash, an induction hob under a
 * brushed-steel hood, a tall appliance column (fridge-freezer, oven, microwave), a dishwasher, an undermount
 * sink with a pull-out tap, and a long marble island with a waterfall end and three counter stools.
 * Doors, island, worktop, backsplash and metalwork are separate customisable surfaces.
 */
export function kitchen(ctx) {
  const { mat, piece } = maker(ctx);
  const S = ctx.surf;
  const steel = mat('L_BrushedSteel'), black = mat('L_BlackMatte'), glass = mat('L_TVGlass'), hw = S.handles;

  // ---- base run along the south wall, window above
  {
    const x0 = 5.5, x1 = 10.45, y0 = 0.25, depth = 0.62, hgt = 0.9;
    const L = x1 - x0, cx = (x0 + x1) / 2;
    const p = piece('Kitchen_Run', 'Kitchen cabinets', cx, y0 + depth / 2, 180, { fixed: true })   // yaw 180: fronts face north, into the room;
    p.add(rbox(L, 0.1, depth - 0.05, 0.01).translate(0, 0.05, -0.02), black);                                  // recessed plinth
    // carcass behind the doors, then separate door and drawer fronts with 3 mm gaps
    p.add(rbox(L - 0.02, hgt - 0.14, depth - 0.04, 0.004).translate(0, 0.1 + (hgt - 0.14) / 2, -0.02), mat('D_Oak'));
    const bays = [0.9, 0.6, 0.9, 0.6, 0.9, 0.6, 0.45];
    const total = bays.reduce((a, b) => a + b, 0), k = (L - 0.02) / total;
    let xx = -L / 2 + 0.01;
    bays.forEach((bw, i) => {
      const w = bw * k;
      const cxx = xx + w / 2;
      if (i === 1 || i === 3) {   // drawer stacks
        for (let r = 0; r < 3; r++) {
          const hh = (hgt - 0.14 - 0.012) / 3 - 0.004;
          const cy = 0.1 + 0.006 + hh / 2 + r * (hh + 0.004);
          p.add(rbox(w - 0.004, hh, 0.021, 0.004).translate(cxx, cy, depth / 2 - 0.012), S.kitchenDoors);
        }
      } else if (i === 2) {      // dishwasher front
        p.add(rbox(w - 0.004, hgt - 0.15, 0.021, 0.004).translate(cxx, 0.1 + (hgt - 0.14) / 2, depth / 2 - 0.012), steel);
        p.add(rbox(w - 0.1, 0.012, 0.012, 0.004).translate(cxx, hgt - 0.12, depth / 2 + 0.004), black);
      } else {
        p.add(rbox(w - 0.004, hgt - 0.15, 0.021, 0.004).translate(cxx, 0.1 + (hgt - 0.14) / 2, depth / 2 - 0.012), S.kitchenDoors);
      }
      xx += w;
    });
    // continuous brass pull rail under the worktop edge
    p.add(rbox(L - 0.02, 0.014, 0.022, 0.005).translate(0, hgt - 0.06, depth / 2 + 0.012), hw);
    // worktop with a slightly proud, eased front edge
    p.add(rbox(L, 0.04, depth + 0.03, 0.005).translate(0, hgt + 0.02 - 0.04, 0.012), S.worktop);
    // full-height backsplash up to the window sill (1.1 m) and between the tall unit and the window
    p.add(rbox(L, 0.2, 0.015, 0.003).translate(0, hgt + 0.1 - 0.02, -depth / 2 + 0.008), S.splash);
    // sink: undermount rectangular bowl and a pull-out tap
    const sx = cx - 6.7;                       // world x 6.7: centred under the window (the piece is turned 180 degrees)
    p.add(rbox(0.72, 0.01, 0.42, 0.003).translate(sx, hgt - 0.005, 0.0), steel);
    p.add(rbox(0.7, 0.004, 0.4, 0.002).translate(sx, hgt + 0.0, 0.0), black);
    p.add(rod([sx, hgt, -0.26], [sx, hgt + 0.34, -0.26], 0.011, 14), hw);
    p.add(rod([sx, hgt + 0.34, -0.26], [sx, hgt + 0.30, -0.12], 0.009, 14).rotateX(0), hw);
    p.add(rbox(0.016, 0.07, 0.016, 0.004).translate(sx + 0.05, hgt + 0.04, -0.26), hw);
    // induction hob
    const hx = cx - 9.2;
    p.add(rbox(0.78, 0.006, 0.52, 0.003).translate(hx, hgt + 0.003 - 0.0, 0.0), black);
    for (const [ox, oz, r] of [[-0.2, -0.1, 0.1], [0.2, -0.1, 0.085], [-0.2, 0.13, 0.085], [0.2, 0.13, 0.1]]) p.add(cyl(r, 0.002, hx + ox, oz, 48, r, hgt + 0.006), mat('L_TaupeMetal'));
    // hood: tapered brushed-steel chimney
    p.add(rbox(0.9, 0.12, 0.5, 0.01).translate(hx, 1.62, -0.06), steel);
    p.add(rbox(0.26, 0.9, 0.2, 0.01).translate(hx, 2.2, -depth / 2 + 0.1), steel);
    // everyday objects: kettle, board, jar of utensils, espresso machine
    p.add(lathe([[0.001, 0], [0.09, 0.0], [0.1, 0.05], [0.085, 0.16], [0.05, 0.2], [0.001, 0.2]], 28).translate(hx - 0.55, hgt + 0.0, -0.18), mat('L_TaupeMetal'));
    p.add(rbox(0.46, 0.022, 0.3, 0.008).translate(cx - 7.7, hgt + 0.011, 0.04), mat('D_Oak'));
    p.add(cyl(0.05, 0.16, hx + 0.55, -0.22, 24, 0.05, hgt + 0.0), mat('D_Ceramic'));
    for (let i = 0; i < 4; i++) p.add(rod([hx + 0.55 + (i - 1.5) * 0.015, hgt + 0.12, -0.22], [hx + 0.55 + (i - 1.5) * 0.02, hgt + 0.3, -0.22], 0.006, 8), mat('D_Veneer'));
    p.add(rbox(0.28, 0.34, 0.34, 0.03).translate(-L / 2 + 0.4, hgt + 0.17, -0.12), black);
    p.add(rbox(0.22, 0.03, 0.22, 0.01).translate(-L / 2 + 0.4, hgt + 0.12, 0.0), steel);
    p.finish();
  }

  // ---- tall appliance column at the open end: fridge-freezer, oven, microwave, pantry doors
  {
    const p = piece('Kitchen_Tall', 'Tall appliance unit', 5.0, 0.58, 180, { fixed: true });
    const H = 2.3, W = 0.85, D = 0.62;
    p.add(rbox(W, H, D - 0.02, 0.008).translate(0, H / 2, -0.01), mat('D_Oak'));
    p.add(rbox(W - 0.004, 1.15, 0.022, 0.004).translate(0, 0.575 + 0.03, D / 2 - 0.012), steel);              // fridge-freezer doors
    p.add(rbox(W - 0.1, 0.01, 0.014, 0.003).translate(0, 0.62, D / 2 + 0.002), black);
    p.add(rbox(0.012, 0.9, 0.02, 0.004).translate(W / 2 - 0.06, 0.62, D / 2 + 0.02), hw);
    p.add(rbox(W - 0.004, 0.6, 0.022, 0.004).translate(0, 1.5, D / 2 - 0.012), S.kitchenDoors);               // oven
    p.add(rbox(W - 0.1, 0.4, 0.004, 0.002).translate(0, 1.5, D / 2 + 0.004), glass);
    p.add(rbox(0.5, 0.014, 0.014, 0.004).translate(0, 1.73, D / 2 + 0.02), hw);
    p.add(rbox(W - 0.004, 0.38, 0.022, 0.004).translate(0, 1.99, D / 2 - 0.012), steel);                      // microwave
    p.add(rbox(0.5, 0.26, 0.004, 0.002).translate(-0.1, 1.99, D / 2 + 0.002), glass);
    p.add(rbox(W - 0.004, 0.2, 0.022, 0.004).translate(0, 2.2, D / 2 - 0.012), S.kitchenDoors);
    p.finish();
  }

  // ---- island with a waterfall end and a deep overhang for stools
  {
    const p = piece('Kitchen_Island', 'Kitchen island', 7.7, 2.2, 180, { fixed: true });
    p.add(rbox(2.6, 0.82, 0.62, 0.01).translate(0, 0.45, -0.1), S.islandBase);
    p.add(rbox(0.014, 0.6, 0.62, 0.003).translate(-0.6, 0.45, -0.1), black);
    p.add(rbox(2.84, 0.04, 0.96, 0.005).translate(0, 0.88, 0.06), S.worktop);
    p.add(rbox(0.04, 0.86, 0.96, 0.005).translate(1.42, 0.43, 0.06), S.worktop);                        // waterfall end
    p.add(rbox(0.04, 0.86, 0.96, 0.005).translate(-1.42, 0.43, 0.06), S.worktop);
    p.add(rbox(2.4, 0.08, 0.5, 0.01).translate(0, 0.04, -0.1), black);
    p.add(rbox(2.5, 0.014, 0.016, 0.004).translate(0, 0.82, 0.221), hw);                                // brass pull rail
    p.add(lathe([[0.001, 0], [0.16, 0], [0.2, 0.05], [0.21, 0.07], [0.0, 0.07]], 40).translate(-0.7, 0.9, 0.05), mat('D_Ceramic'));   // bowl
    p.add(drum(0.2, 0.014, 0.006, 40).translate(0.7, 0.9, 0.05), hw);
    p.finish();
  }

  // ---- stools on the dining side of the island
  [-0.8, 0, 0.8].forEach((dx, i) => {
    const p = piece(`Stool_${i + 1}`, 'Counter stool', 7.7 + dx, 2.93, 0);
    p.add(drum(0.2, 0.08, 0.03, 40).translate(0, 0.62, 0), mat('D_Boucle'));
    p.add(cyl(0.19, 0.02, 0, 0, 40, 0.19, 0.6), mat('D_Veneer'));
    for (const a of [0, 1, 2, 3]) {
      const t = (a / 4) * Math.PI * 2 + Math.PI / 4;
      p.add(rod([Math.sin(t) * 0.2, 0, Math.cos(t) * 0.2], [Math.sin(t) * 0.14, 0.6, Math.cos(t) * 0.14], 0.012, 12, 0.017), hw);
    }
    p.add(lathe([[0.17, 0.24], [0.2, 0.24], [0.2, 0.255], [0.17, 0.255]], 40), hw);
    p.finish();
  });
  void THREE; void bar; void slab; void superellipse; void cushion; void addModel;
}
