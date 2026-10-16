import * as THREE from 'three';
import { maker, rbox, rod, cyl, flutedColumn, superellipse, slab, bent, drum, bar, lathe } from './kit.js';

/* Dining: an oval marble table on a fluted pedestal with FOUR cane-back chairs. */
const TABLE = { x: 8.55, y: 3.85 };

export function dining(ctx) {
  const { mat, piece } = maker(ctx);

  {
    const p = piece('DiningTable', 'Dining table', TABLE.x, TABLE.y, 0);
    p.add(slab(superellipse(1.1, 0.52, 2.7), 0.04, 0.008, 4, 96).translate(0, 0.70, 0), mat('D_Marble'));
    p.add(flutedColumn(0.22, 0.68, 32, 0.012).translate(0, 0.02, 0), mat('D_Veneer'));
    p.add(drum(0.52, 0.03, 0.01, 72), mat('D_Veneer'));
    p.add(drum(0.26, 0.05, 0.015, 48).translate(0, 0.66, 0), mat('D_Veneer'));
    // centrepiece: a brass tray carrying a ceramic vase and two candles (travels with the table)
    p.add(drum(0.2, 0.012, 0.005, 48).translate(0, 0.74, 0), mat('D_Brass'));
    p.add(lathe([[0, 0], [0.07, 0], [0.11, 0.1], [0.075, 0.24], [0.04, 0.32], [0.05, 0.4], [0.045, 0.4], [0.032, 0.32], [0.065, 0.24], [0.1, 0.1], [0, 0.01]], 40).translate(-0.04, 0.752, 0), mat('D_Ceramic'));
    for (const cx of [0.09, 0.15]) p.add(cyl(0.017, 0.14 + cx * 0.2, cx, 0.04, 16, 0.017, 0.752), mat('L_Candle'));
    p.finish();
  }

  const chair = (id, px, py, yaw) => {
    const p = piece(id, 'Dining chair', px, py, yaw);
    const wood = mat('D_Veneer');
    // seat: walnut frame under a boucle cushion
    p.add(rbox(0.46, 0.035, 0.44, 0.012).translate(0, 0.43, 0.01), wood);
    p.add(rbox(0.44, 0.07, 0.42, 0.03, 4).translate(0, 0.485, 0.015), mat('D_Boucle'));
    // legs: tapered, front pair straight, back pair sweeping up into the backrest
    for (const sx of [-1, 1]) {
      p.add(rod([sx * 0.2, 0, 0.2], [sx * 0.21, 0.42, 0.2], 0.012, 12, 0.019), wood);
      p.add(rod([sx * 0.2, 0, -0.2], [sx * 0.2, 0.44, -0.2], 0.012, 12, 0.019), wood);
      p.add(rod([sx * 0.2, 0.43, -0.2], [sx * 0.205, 0.88, -0.255], 0.017, 12, 0.014), wood);
    }
    // stretcher rails
    p.add(bar([-0.2, 0.17, 0.2], [0.2, 0.17, 0.2], 0.018, 0.018, 0.006), wood);
    p.add(bar([-0.2, 0.17, -0.2], [0.2, 0.17, -0.2], 0.018, 0.018, 0.006), wood);
    // curved cane panel between two walnut rails
    p.add(bent(0.42, 0.26, 0.012, 0.55, 20).translate(0, 0.66, -0.235), mat('L_Cane'));
    p.add(bent(0.46, 0.035, 0.028, 0.55, 20).translate(0, 0.865, -0.235), wood);
    p.add(bent(0.46, 0.03, 0.026, 0.55, 20).translate(0, 0.515, -0.235), wood);
    p.finish();
  };
  // two chairs along each long side of the table, all facing it
  const dx = 0.5, dy = 0.78;
  // plan y grows to the north (web -z): chairs on the north side face south (yaw 0), the others face north (yaw 180)
  chair('DiningChair_1', TABLE.x - dx, TABLE.y + dy, 0);
  chair('DiningChair_2', TABLE.x + dx, TABLE.y + dy, 0);
  chair('DiningChair_3', TABLE.x - dx, TABLE.y - dy, 180);
  chair('DiningChair_4', TABLE.x + dx, TABLE.y - dy, 180);
  void THREE;
}
