import * as THREE from 'three';
import { addModel } from './assets.js';
import { maker, rbox, at, drum, cyl, rod, cushion, lathe, bar } from './kit.js';

/* Living room: the supplied sectional, a rust wool rug, a travertine coffee table, a brass side table and a lounge chair. */
export function living(ctx) {
  const { mat, piece } = maker(ctx);

  // ---- sectional sofa (the supplied model, back to the study wall, facing the sea)
  {
    const S = 0.82;
    const p = piece('Sofa', 'Sectional sofa', 8.83, 6.9, 90);
    const sc = new THREE.Matrix4().makeScale(S, S, S);
    for (const { material, geo } of ctx.pack.sofa.geometries('sofa', sc)) p.add(geo, mat(material === 'pillow' ? 'D_Boucle' : 'X_SofaLinen'));
    p.finish();
  }

  // ---- rug under the seating group
  {
    const p = piece('Rug_Living', 'Wool rug', 9.15, 6.55, 0, { flat: true });
    p.add(rbox(2.6, 0.018, 2.0, 0.008, 2).translate(0, 0.009, 0), mat('L_RugRust'), { cast: false });
    p.finish();
  }

  // ---- coffee table: the supplied drum table with a stack of books
  {
    const p = piece('CoffeeTable', 'Coffee table', 9.6, 6.0);
    addModel(p, ctx, 'coffee_drum');
    addModel(p, ctx, 'books', { scale: 0.8, y: 0.37, x: -0.1, ry: 0.4 });
    p.finish();
  }

  // ---- brass and marble side table beside the sofa
  {
    const p = piece('SideTable', 'Side table', 8.2, 5.5);
    p.add(drum(0.26, 0.03, 0.01, 64), mat('D_Marble')).translate(0, 0.51, 0);
    for (const a of [0, 1, 2]) {
      const t = (a / 3) * Math.PI * 2 + 0.3;
      p.add(rod([Math.sin(t) * 0.17, 0.0, Math.cos(t) * 0.17], [Math.sin(t) * 0.20, 0.51, Math.cos(t) * 0.20], 0.012, 12, 0.009), mat('D_Brass'));
    }
    p.add(cyl(0.2, 0.012, 0, 0, 48, 0.2, 0.18), mat('D_Brass'));
    p.finish();
  }

  // ---- lounge chair, boucle on a walnut frame
  {
    const p = piece('LoungeChair', 'Lounge chair', 10.05, 5.55, -40);
    // low rounded seat and a tall curved back
    p.add(cushion(0.78, 0.2, 0.76, 0.09, 0.2).translate(0, 0.33, 0), mat('D_Boucle'));
    const back = lathe([[0.30, 0.38], [0.355, 0.5], [0.36, 0.7], [0.34, 0.86], [0.30, 0.88], [0.28, 0.86], [0.31, 0.7], [0.31, 0.52], [0.26, 0.4]], 40);
    back.scale(1.12, 1, 0.62);
    // keep only the rear half of the shell
    const keep = back.toNonIndexed(), pos = keep.attributes.position, uv = keep.attributes.uv, nor = keep.attributes.normal;
    const P = [], N = [], U = [];
    for (let i = 0; i < pos.count; i += 3) {
      const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      if (cz > -0.01) continue;
      for (let k = 0; k < 3; k++) { P.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k) - 0.04); N.push(nor.getX(i + k), nor.getY(i + k), nor.getZ(i + k)); U.push(uv.getX(i + k), uv.getY(i + k)); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    p.add(g, mat('D_Boucle'));
    p.add(rbox(0.74, 0.07, 0.7, 0.02).translate(0, 0.17, 0), mat('D_Veneer'));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(rod([sx * 0.3, 0, sz * 0.26], [sx * 0.34, 0.15, sz * 0.3], 0.017, 12, 0.026), mat('D_Veneer'));
    p.finish();
  }

  // ---- floor lamp: sculptural marble base, brass stem, linen shade
  {
    const p = piece('FloorLamp', 'Floor lamp', 10.25, 7.95);
    p.add(drum(0.17, 0.05, 0.012), mat('D_Marble'));
    p.add(rod([0, 0.05, 0], [0, 1.45, 0], 0.011, 12), mat('D_Brass'));
    p.add(lathe([[0.17, 0], [0.22, 0.34], [0.215, 0.35], [0.165, 0.01]], 48).translate(0, 1.42, 0), mat('D_Linen'));
    p.finish();
  }

  void at; void bar;
}
