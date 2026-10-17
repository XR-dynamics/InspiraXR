import * as THREE from 'three';
import { addModel } from './assets.js';
import { maker, rbox, rod, cyl, flutedColumn, superellipse, slab, bent, drum, bar, lathe } from './kit.js';

/* Dining: an oval marble table on a fluted pedestal with FOUR cane-back chairs. */
const TABLE = { x: 8.55, y: 3.85 };

export function dining(ctx) {
  const { mat, piece } = maker(ctx);

  {
    const p = piece('DiningTable', 'Dining table', TABLE.x, TABLE.y, 0);
    addModel(p, ctx, 'dining_table');
    // centrepiece: a brass tray carrying a ceramic vase and two candles (travels with the table)
    p.add(drum(0.2, 0.012, 0.005, 48).translate(0, 0.75, 0), mat('D_Brass'));
    p.add(lathe([[0, 0], [0.07, 0], [0.11, 0.1], [0.075, 0.24], [0.04, 0.32], [0.05, 0.4], [0.045, 0.4], [0.032, 0.32], [0.065, 0.24], [0.1, 0.1], [0, 0.01]], 40).translate(-0.04, 0.762, 0), mat('D_Ceramic'));
    for (const cx of [0.09, 0.15]) p.add(cyl(0.017, 0.14 + cx * 0.2, cx, 0.04, 16, 0.017, 0.762), mat('L_Candle'));
    p.finish();
  }

  const chair = (id, px, py, yaw) => {
    const p = piece(id, 'Dining chair', px, py, yaw);
    addModel(p, ctx, 'dining_chair');
    p.finish();
  };
  const dx = 0.62, dy = 0.78;
  // plan y grows to the north (web -z): chairs on the north side face south (yaw 0), the others face north (yaw 180)
  chair('DiningChair_1', TABLE.x - dx, TABLE.y + dy, 0);
  chair('DiningChair_2', TABLE.x + dx, TABLE.y + dy, 0);
  chair('DiningChair_3', TABLE.x - dx, TABLE.y - dy, 180);
  chair('DiningChair_4', TABLE.x + dx, TABLE.y - dy, 180);
  void THREE;
}
