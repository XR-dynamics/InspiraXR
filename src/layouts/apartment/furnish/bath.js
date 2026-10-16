import * as THREE from 'three';
import { maker, rbox, rod, cyl, lathe, superellipse, slab, drum } from './kit.js';

/**
 * A wall-hung toilet: glazed elongated bowl, slim closed seat and lid, and the concealed-cistern flush plate on the wall.
 * Local origin is on the floor against the wall; +z is into the room.
 */
function toilet(mat, piece, id, x, y, yaw) {
  const p = piece(id, 'Toilet', x, y, yaw);
  const china = mat('D_Ceramic');
  // bowl: a glazed shell, elongated front to back, wider at the rim and narrowing toward the wall-hung base
  const shell = lathe([[0.0, 0.0], [0.09, 0.0], [0.15, 0.025], [0.185, 0.085], [0.2, 0.16], [0.205, 0.215]], 56).scale(1, 1, 1.4);
  p.add(shell.translate(0, 0.2, 0.3), china);
  p.add(rbox(0.34, 0.24, 0.26, 0.08, 4).translate(0, 0.32, 0.13), china);
  // seat ring and closed lid
  p.add(slab(superellipse(0.205, 0.29, 2.3), 0.026, 0.008, 3, 64).translate(0, 0.405, 0.31), china);
  p.add(slab(superellipse(0.195, 0.28, 2.3), 0.02, 0.008, 3, 64).translate(0, 0.433, 0.31), china);
  p.add(rbox(0.3, 0.04, 0.04, 0.012).translate(0, 0.42, 0.03), mat('D_Chrome'));
  // concealed cistern panel with a dual-flush plate
  p.add(rbox(0.52, 0.95, 0.02, 0.005).translate(0, 0.85, 0.01), china);
  p.add(rbox(0.24, 0.15, 0.014, 0.006).translate(0, 0.98, 0.026), mat('D_Chrome'));
  p.add(cyl(0.02, 0.006, -0.045, 0, 24, 0.02, 0).rotateX(Math.PI / 2).translate(0, 0.98, 0.034), china);
  p.add(cyl(0.02, 0.006, 0.045, 0, 24, 0.02, 0).rotateX(Math.PI / 2).translate(0, 0.98, 0.034), china);
  p.finish();
}

export function bath(ctx) {
  const { mat, piece } = maker(ctx);
  const wood = mat('D_Veneer'), stone = mat('D_Marble'), chrome = mat('D_Chrome');

  // plan y grows to the north, so a toilet on the south wall faces north (yaw 180)
  toilet(mat, piece, 'Toilet', 1.6, 1.225, 180);

  // ---- vanity on the north wall: walnut cabinet, marble top, vessel basin, tap, round mirror
  {
    const p = piece('Vanity', 'Vanity', 1.75, 3.76, 0, { fixed: true });
    p.add(rbox(1.1, 0.5, 0.46, 0.01).translate(0, 0.5, 0), wood);
    p.add(rbox(1.14, 0.035, 0.5, 0.006).translate(0, 0.77, 0), stone);
    p.add(rbox(1.0, 0.04, 0.4, 0.01).translate(0, 0.2, 0), mat('L_BlackMatte'));
    p.add(rbox(0.012, 0.4, 0.004, 0.001, 1).translate(0, 0.5, 0.231), mat('L_BlackMatte'));
    p.add(lathe([[0.0, 0.0], [0.12, 0.0], [0.19, 0.06], [0.205, 0.12], [0.2, 0.125], [0.185, 0.115], [0.11, 0.025], [0.0, 0.015]], 48).translate(0, 0.79, 0.0), mat('D_Ceramic'));
    p.add(rod([0, 0.79, -0.19], [0, 1.0, -0.19], 0.011, 14), chrome);
    p.add(rod([0, 1.0, -0.19], [0, 1.0, -0.06], 0.009, 14).rotateX(0), chrome);
    p.add(cyl(0.45, 0.022, 0, -0.235, 64, 0.45, 0).rotateX(Math.PI / 2).translate(0, 1.55, 0), mat('D_Mirror'), { noFootprint: true });
    p.add(cyl(0.465, 0.014, 0, -0.238, 64, 0.465, 0).rotateX(Math.PI / 2).translate(0, 1.55, 0), mat('D_Brass'), { noFootprint: true });
    p.finish();
  }

  // ---- walk-in shower in the south-west corner: onyx tray, glass screens, rain head and rail
  {
    const p = piece('Shower', 'Shower', 0.78, 1.7, 0, { fixed: true });
    p.add(rbox(0.9, 0.04, 1.0, 0.008).translate(0, 0.02, 0), mat('L_MarbleScallop'), { noFootprint: true });
    const glass = mat('D_Glass');
    p.add(rbox(0.012, 2.1, 0.5, 0.002, 1).translate(0.45, 1.05, 0.25), glass, { cast: false });
    p.add(rbox(0.9, 2.1, 0.012, 0.002, 1).translate(0, 1.05, -0.5), glass, { cast: false });
    p.add(rbox(0.03, 0.03, 0.5, 0.006).translate(0.45, 2.1, 0.25), mat('L_BlackMatte'), { noFootprint: true });
    p.add(rbox(0.9, 0.03, 0.03, 0.006).translate(0, 2.1, -0.5), mat('L_BlackMatte'), { noFootprint: true });
    p.add(rod([-0.35, 2.1, 0.46], [-0.35, 2.28, 0.46], 0.012, 12), chrome, { noFootprint: true });
    p.add(rod([-0.35, 2.28, 0.46], [-0.35, 2.28, 0.2], 0.012, 12), chrome, { noFootprint: true });
    p.add(cyl(0.12, 0.012, -0.35, 0.2, 40, 0.12, 2.27), chrome, { noFootprint: true });
    p.add(rbox(0.1, 0.1, 0.05, 0.01).translate(0.0, 1.05, 0.485), chrome, { noFootprint: true });
    p.add(rod([-0.1, 0.9, 0.49], [-0.1, 1.5, 0.49], 0.008, 10), chrome, { noFootprint: true });
    p.finish();
  }

  // ---- storage stool and towels
  {
    const p = piece('Stool_Bath', 'Bath stool', 0.6, 3.3, 0);
    p.add(drum(0.19, 0.04, 0.012, 48).translate(0, 0.36, 0), wood);
    p.add(cyl(0.14, 0.36, 0, 0, 40, 0.14), wood);
    p.add(rbox(0.3, 0.07, 0.2, 0.025, 4).translate(0, 0.435, 0), mat('L_Towel0'));
    p.add(rbox(0.3, 0.06, 0.2, 0.025, 4).translate(0, 0.5, 0), mat('L_Towel1'));
    p.finish();
  }
  void THREE;
}
