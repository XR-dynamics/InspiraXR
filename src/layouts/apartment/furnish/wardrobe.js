import * as THREE from 'three';
import { maker, rbox, rod, cyl, cushion, lathe, superellipse, slab, at, bar } from './kit.js';

/*
 * Wardrobe interiors: hangers with shirts, jackets and dresses on a rail, folded knitwear on shelves, shoes
 * on a rack and drawers underneath. Dimensions follow real wardrobes (rail at 1.7 m, shelves every ~0.35 m).
 */

const WHITE = new THREE.Vector3(1, 1, 1);

/** Taper a geometry's vertices about the vertical axis: scale x by f(y). */
function taper(geo, f) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * f(p.getY(i)));
  geo.computeVertexNormals();
  return geo;
}

/** A garment on a hanger, hung from a rail at height `top` (the hook). Kinds: shirt, jacket, dress, trousers. */
export function hangingGarment(piece, mat, kind, x, z, top, matName, ry = 0) {
  const m = mat(matName), brass = mat('D_Brass');
  const g = (geo) => { geo.rotateY(ry).translate(x, 0, z); return geo; };
  // wooden hanger: shoulders and a hook
  const sw = kind === 'dress' ? 0.38 : 0.44;
  piece.add(g(bar([-sw / 2, top - 0.12, 0], [0, top - 0.065, 0], 0.012, 0.012, 0.004)), mat('D_Veneer'), { noFootprint: true });
  piece.add(g(bar([sw / 2, top - 0.12, 0], [0, top - 0.065, 0], 0.012, 0.012, 0.004)), mat('D_Veneer'), { noFootprint: true });
  piece.add(g(rod([0, top - 0.065, 0], [0, top - 0.02, 0], 0.0025, 6)), brass, { noFootprint: true });
  piece.add(g(rod([0, top - 0.02, 0], [0.02, top, 0], 0.0025, 6)), brass, { noFootprint: true });
  const hang = top - 0.12;
  if (kind === 'shirt' || kind === 'jacket') {
    const len = kind === 'jacket' ? 0.74 : 0.7, wd = kind === 'jacket' ? 0.5 : 0.46, th = kind === 'jacket' ? 0.07 : 0.045;
    const body = taper(rbox(wd, len, th, 0.02, 3), (y) => 1 + (-y / len) * 0.12).translate(0, hang - len / 2 - 0.01, 0);
    piece.add(g(body), m, { noFootprint: true });
    for (const s of [-1, 1]) {
      const slv = rod([s * wd / 2, hang - 0.03, 0], [s * (wd / 2 + 0.03), hang - len * 0.78, 0.0], 0.034, 12, 0.026);
      piece.add(g(slv), m, { noFootprint: true });
    }
    piece.add(g(rbox(0.16, 0.03, th + 0.012, 0.01).translate(0, hang + 0.005, 0)), m, { noFootprint: true });   // collar
  } else if (kind === 'dress') {
    const len = 1.05;
    const d = lathe([[0.05, 0], [0.12, 0.08], [0.21, 0.45], [0.26, 0.85], [0.28, len]].map(([r, y]) => [r, len - y]), 28).scale(1, 1, 0.28);
    piece.add(g(d.translate(0, hang - len, 0)), m, { noFootprint: true });
  } else {
    // trousers folded over the rail bar of the hanger
    piece.add(g(rbox(0.38, 0.5, 0.05, 0.02).translate(0, hang - 0.25, 0)), m, { noFootprint: true });
  }
}

/** A leather shoe pointing toward +z, centred on (x, z), standing on y0. */
export function shoe(piece, mat, x, y0, z, ry = 0, matName = 'L_BlackMatte') {
  const sole = slab(superellipse(0.045, 0.13, 3.2), 0.018, 0.004, 2, 24).rotateY(0).translate(0, 0, 0.02);
  const upper = new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.085, 0.085, 0.27).translate(0, 0.016, 0.02);
  const heel = rbox(0.06, 0.03, 0.07, 0.01).translate(0, 0.012, -0.07);
  const f = (geo) => { geo.rotateY(ry).translate(x, y0, z); return geo; };
  piece.add(f(sole), mat('L_BlackMatte'), { noFootprint: true });
  piece.add(f(upper), mat(matName), { noFootprint: true });
  piece.add(f(heel), mat('L_BlackMatte'), { noFootprint: true });
}

/** Stack of folded knitwear / towels. */
function foldedStack(piece, mat, x, y, z, w, d, names) {
  names.forEach((n, i) => piece.add(cushion(w, 0.07, d, 0.025, 0.2).translate(x + (i % 2 ? 0.004 : -0.004), y + 0.035 + i * 0.075, z), mat(n), { noFootprint: true }));
}

/**
 * Build a wardrobe. Local frame: +z is the open front. spec: { id, name, x, y (plan), yaw, w, d, h, doors:'ajar'|'none', hanging, shelves }
 */
export function wardrobe(ctx, spec) {
  const { mat, piece } = maker(ctx);
  const { id, name, x, y, yaw, w, d, h = 2.4 } = spec;
  const flute = mat('L_Fluted'), wood = mat('D_Veneer'), inner = mat('D_Oak'), black = mat('L_BlackMatte');
  const p = piece(id, name, x, y, yaw, { fixed: true });
  const t = 0.025;
  // carcass: sides, top, plinth, back
  p.add(rbox(t, h, d, 0.004).translate(-w / 2 + t / 2, h / 2, 0), flute);
  p.add(rbox(t, h, d, 0.004).translate(w / 2 - t / 2, h / 2, 0), flute);
  p.add(rbox(w, t, d, 0.004).translate(0, h - t / 2, 0), flute);
  p.add(rbox(w - 0.02, 0.08, d - 0.04, 0.004).translate(0, 0.04, -0.01), black);
  p.add(rbox(w - 2 * t, h - 0.1, 0.012, 0.002, 1).translate(0, h / 2 + 0.03, -d / 2 + 0.006), inner);
  const iw = w - 2 * t;
  if (spec.compact) { compactInterior(p, mat, { w, d, h, t, iw, flute, wood }); } else {
  // layout: left bay hangs long things, right bay has shelves, drawers and shoes
  const bay = iw / 2;
  p.add(rbox(0.012, h - 0.12, d - 0.04, 0.002, 1).translate(0, h / 2 + 0.02, -0.005), wood);          // divider
  // left bay: top shelf, rail at 1.72 m with shirts, jackets and a dress
  p.add(rbox(bay - 0.01, 0.02, d - 0.05, 0.003).translate(-bay / 2 - 0.006, h - 0.22, -0.005), wood);
  const railY = Math.min(1.72, h - 0.3), lx0 = -iw / 2 + 0.05, lx1 = -0.03;
  p.add(rod([lx0, railY, 0], [lx1, railY, 0], 0.0125, 14).rotateZ(0), mat('D_Brass'), { noFootprint: true });
  const mats = ['L_Garment0', 'L_Garment1', 'L_Garment2', 'L_Garment3', 'L_Garment4'];
  const kinds = ['shirt', 'shirt', 'jacket', 'shirt', 'dress', 'jacket', 'shirt', 'trousers', 'shirt'];
  const n = Math.max(3, Math.floor((lx1 - lx0) / 0.085));
  for (let i = 0; i < n; i++) {
    const kx = lx0 + 0.05 + (i * (lx1 - lx0 - 0.1)) / Math.max(1, n - 1);
    hangingGarment(p, mat, kinds[i % kinds.length], kx, 0.0, railY + 0.03, mats[(i * 2 + 1) % mats.length], Math.PI / 2 + (i % 3 - 1) * 0.04);
  }
  // lower left: two drawers
  for (let i = 0; i < 2; i++) {
    p.add(rbox(bay - 0.04, 0.2, 0.02, 0.004).translate(-bay / 2 - 0.006, 0.3 + i * 0.22, d / 2 - 0.02), flute);
    p.add(rbox(0.16, 0.012, 0.02, 0.004).translate(-bay / 2 - 0.006, 0.32 + i * 0.22, d / 2 - 0.005), mat('D_Brass'), { noFootprint: true });
  }
  // right bay: shelves with folded clothes, boxes and, at the bottom, shoes
  const rx0 = 0.012, rx1 = iw / 2 - 0.0;
  const rcx = (rx0 + rx1) / 2, rw = rx1 - rx0 - 0.02;
  const levels = [0.38, 0.82, 1.22, 1.62];
  if (h > 2.2) levels.push(2.02);
  levels.forEach((ly, i) => {
    p.add(rbox(rw, 0.02, d - 0.05, 0.003).translate(rcx, ly, -0.005), wood);
    const top = ly + 0.01;
    if (i === 0) {
      // shoe rack: pairs of shoes in a row
      const pairs = Math.max(2, Math.floor(rw / 0.17));
      for (let k = 0; k < pairs; k++) {
        const sx = rx0 + 0.1 + k * ((rw - 0.14) / Math.max(1, pairs - 1));
        shoe(p, mat, sx, top, 0.03, 0.05 * (k % 2), k % 3 === 0 ? 'D_Veneer' : 'L_BlackMatte');
        shoe(p, mat, sx + 0.065, top, 0.025, -0.04, k % 3 === 0 ? 'D_Veneer' : 'L_BlackMatte');
      }
    } else if (i === 1) {
      foldedStack(p, mat, rcx - rw * 0.25, top, 0.0, 0.34, 0.3, ['L_Garment2', 'L_Garment4', 'L_Garment1', 'L_Garment3']);
      foldedStack(p, mat, rcx + rw * 0.2, top, 0.0, 0.34, 0.3, ['L_Garment0', 'L_Garment2', 'L_Garment4']);
    } else if (i === 2) {
      foldedStack(p, mat, rcx - rw * 0.22, top, 0.0, 0.36, 0.3, ['L_Towel0', 'L_Towel1', 'L_Towel0', 'L_Towel1', 'L_Towel0']);
      p.add(rbox(0.26, 0.2, 0.3, 0.02).translate(rcx + rw * 0.22, top + 0.1, 0), mat('L_BoucleTan'), { noFootprint: true });
    } else {
      foldedStack(p, mat, rcx - rw * 0.2, top, 0.0, 0.32, 0.28, ['L_Garment3', 'L_Garment1', 'L_Garment0']);
      p.add(rbox(0.3, 0.16, 0.26, 0.02).translate(rcx + rw * 0.2, top + 0.08, 0), mat('D_Linen'), { noFootprint: true });
    }
  });
  }
  // doors
  if (spec.doors === 'slide1') {
    const pw = w * 0.5;
    p.add(rbox(pw, h - 0.12, 0.02, 0.004).translate(w / 2 - pw / 2 - 0.004, h / 2 + 0.03, d / 2 + 0.012), flute);
    p.add(rbox(0.012, 0.3, 0.012, 0.004).translate(w / 2 - pw + 0.04, 1.1, d / 2 + 0.026), mat('D_Brass'), { noFootprint: true });
    p.add(rbox(w, 0.02, 0.05, 0.004).translate(0, h - 0.07, d / 2 + 0.02), black);
  } else if (spec.doors === 'slide') {
    // sliding panels (no swing, so they suit a narrow nook): one parked at each end, the middle open to show the contents
    const pw = w * 0.31;
    for (const [s, dz] of [[-1, 0.012], [1, 0.036]]) {
      p.add(rbox(pw, h - 0.12, 0.02, 0.004).translate(s * (w / 2 - pw / 2 - 0.004), h / 2 + 0.03, d / 2 + dz), flute);
      p.add(rbox(0.012, 0.3, 0.012, 0.004).translate(s * (w / 2 - pw - 0.0) + (s > 0 ? 0.03 : -0.03) * -1, 1.1, d / 2 + dz + 0.014), mat('D_Brass'), { noFootprint: true });
    }
    p.add(rbox(w, 0.02, 0.07, 0.004).translate(0, h - 0.07, d / 2 + 0.024), black);     // top track
  } else if (spec.doors !== 'none') {
    // slim fluted leaves swung open 100 degrees so the contents show
    for (const s of [-1, 1]) {
      const lw = Math.min(0.5, w / 2 - 0.02);
      const hinge = new THREE.Vector3(s * (w / 2 - 0.005), 0, d / 2);
      const door = rbox(lw, h - 0.14, 0.02, 0.004).translate(-s * lw / 2, h / 2 + 0.03, 0);
      door.rotateY(s * 1.75).translate(hinge.x, hinge.y, hinge.z);   // open outward
      p.add(door, flute);
      p.add(rbox(0.012, 0.3, 0.02, 0.004).translate(-s * (lw - 0.04), 1.1, 0.012).rotateY(s * 1.75).translate(hinge.x, hinge.y, hinge.z), mat('D_Brass'), { noFootprint: true });
    }
  }
  p.finish();
  void cyl; void at; void WHITE;
}

/** Interior of a narrow wardrobe: a full-width hanging rail over three full-width shelves and a shoe rack. */
function compactInterior(p, mat, { w, d, h, t, iw, wood }) {
  const railY = Math.min(1.72, h - 0.3);
  p.add(rbox(iw, 0.02, d - 0.05, 0.003).translate(0, h - 0.22, -0.005), wood);
  p.add(rod([-iw / 2 + 0.03, railY, 0], [iw / 2 - 0.03, railY, 0], 0.0125, 14), mat('D_Brass'), { noFootprint: true });
  const mats = ['L_Garment0', 'L_Garment1', 'L_Garment2', 'L_Garment3', 'L_Garment4'];
  const kinds = ['shirt', 'jacket', 'shirt', 'dress', 'shirt', 'jacket', 'shirt'];
  const n = Math.max(3, Math.floor((iw - 0.1) / 0.085));
  for (let i = 0; i < n; i++) {
    const kx = -iw / 2 + 0.06 + (i * (iw - 0.12)) / Math.max(1, n - 1);
    hangingGarment(p, mat, kinds[i % kinds.length], kx, 0.0, railY + 0.03, mats[(i * 2 + 1) % mats.length], Math.PI / 2 + (i % 3 - 1) * 0.04);
  }
  const levels = [0.3, 0.62, 0.94, 1.26];
  levels.forEach((ly, i) => {
    p.add(rbox(iw, 0.02, d - 0.05, 0.003).translate(0, ly, -0.005), wood);
    const top = ly + 0.01;
    if (i === 0) {
      const pairs = Math.max(2, Math.floor(iw / 0.17));
      for (let k = 0; k < pairs; k++) {
        const sx = -iw / 2 + 0.1 + k * ((iw - 0.2) / Math.max(1, pairs - 1));
        shoe(p, mat, sx, top, 0.03, 0.05 * (k % 2), k % 3 === 0 ? 'D_Veneer' : 'L_BlackMatte');
      }
    } else if (i === 1) foldedStack(p, mat, 0, top, 0, Math.min(0.4, iw - 0.1), 0.3, ['L_Garment2', 'L_Garment4', 'L_Garment1']);
    else if (i === 2) foldedStack(p, mat, 0, top, 0, Math.min(0.4, iw - 0.1), 0.3, ['L_Towel0', 'L_Towel1', 'L_Towel0']);
    else p.add(rbox(Math.min(0.4, iw - 0.1), 0.16, 0.3, 0.02).translate(0, top + 0.08, 0), mat('L_BoucleTan'), { noFootprint: true });
  });
}
