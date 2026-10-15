import { H, ROOMS, WALLS, DOORS, CURTAIN, roomAt } from './layout.js';
import { boxGeo, projectUV, splitBoxFaces } from './util.js';

/*
 * Builds the architectural shell: floors, walls (with openings, glazing and
 * shadow-gap skirtings), ceilings with black reveals and coffers, the gallery
 * slab and parapets, the curtain wall, roofs and columns.
 */
export function buildArchitecture(ctx) {
  const { batch: B, M, nav } = ctx;

  // ---------------------------------------------------------------- floors
  for (const [key, r] of Object.entries(ROOMS)) {
    if (key === 'terrace') continue;
    B.box(r.x0, -0.12, r.z0, r.x1, 0, r.z1, M[r.floor], { cast: false });
    nav.allowRect(r.x0, r.z0, r.x1, r.z1);
  }

  // ----------------------------------------------------------------- walls
  const doorOpenings = new Map();
  for (const d of DOORS) {
    const key = `${d.wall}:${d.at}`;
    if (!doorOpenings.has(key)) doorOpenings.set(key, []);
    doorOpenings.get(key).push([d.from, d.to, 0, d.height, 'door']);
  }

  WALLS.forEach((w, wi) => {
    w.index = wi;
    const extra = doorOpenings.get(`${w.axis}:${w.at}`) || [];
    const ops = [...(w.openings || []).map((o) => [...o, w.ext ? 'glazing' : 'open']),
      ...extra.filter((o) => o[0] >= w.from - 1e-3 && o[1] <= w.to + 1e-3)];
    buildWall(ctx, w, ops);
  });

  buildCurtainWall(ctx);
  buildCeilings(ctx);
  buildGallery(ctx);
  buildColumnsAndCladding(ctx);
}

/** Room on one side of a wall at position `t` along it (null = outdoors). */
function roomOnSide(w, side, t) {
  return w.axis === 'x'
    ? roomAt(t, w.at + side * (w.t / 2 + 0.4))
    : roomAt(w.at + side * (w.t / 2 + 0.4), t);
}

const COMPASS = {
  x: { 1: 'North', '-1': 'South' }, // wall runs along x; its +z face is the room's north wall
  z: { 1: 'West', '-1': 'East' },
};

/**
 * One solid piece of wall. It is cut wherever a room boundary crosses it, and each
 * big face is registered as its own paintable "wall" (wall entry + side + room), so
 * painting the kitchen side of a partition never touches the hallway side.
 */
function wallBox(ctx, w, a, b, y0, y1) {
  const { batch: B, M } = ctx;
  const h = w.t / 2;
  const cuts = new Set([a, b]);
  for (const r of Object.values(ROOMS)) {
    for (const v of w.axis === 'x' ? [r.x0, r.x1] : [r.z0, r.z1]) if (v > a + 0.02 && v < b - 0.02) cuts.add(v);
  }
  const edges = [...cuts].sort((p, q) => p - q);
  for (let i = 0; i < edges.length - 1; i++) {
    const s0 = edges[i], s1 = edges[i + 1];
    const mid = (s0 + s1) / 2;
    const geo = w.axis === 'x'
      ? boxGeo(s0, y0, w.at - h, s1, y1, w.at + h)
      : boxGeo(w.at - h, y0, s0, w.at + h, y1, s1);
    projectUV(geo);
    const parts = splitBoxFaces(geo, w.axis === 'x' ? 'z' : 'x');
    for (const [key, side] of [['neg', -1], ['pos', 1]]) {
      if (!parts[key]) continue;
      const room = roomOnSide(w, side, mid);
      const id = `w${w.index}${side < 0 ? 'n' : 'p'}:${room || 'out'}`;
      B.defineFace(id, {
        id, room, wall: w.index,
        label: `${room ? ROOMS[room].name : 'Exterior'} \u00b7 ${COMPASS[w.axis][side]} wall`,
        normal: w.axis === 'x' ? [0, side] : [side, 0],
      });
      B.add(parts[key], M.wallPaint, { keepUV: true, face: id });
    }
    if (parts.rest) B.add(parts.rest, M.wallPaint, { keepUV: true });
    geo.dispose();
  }
}

function buildWall(ctx, w, openings) {
  const { batch: B, M, nav } = ctx;
  const ops = openings.slice().sort((p, q) => p[0] - q[0]);
  let cursor = w.from;
  const solid = [];
  for (const o of ops) {
    const [a, b, oy0, oy1, kind] = o;
    if (a > cursor) solid.push([cursor, a]);
    // below + above the opening
    if (oy0 > w.y0) wallBox(ctx, w, a, b, w.y0, oy0);
    if (oy1 < w.y1) wallBox(ctx, w, a, b, oy1, w.y1);
    if (kind === 'glazing') buildWindow(ctx, w, a, b, Math.max(oy0, w.y0), Math.min(oy1, w.y1));
    if (kind === 'open' && w.y0 < 1) liningReveal(ctx, w, a, b, oy1);
    if (oy0 > 0.2 && w.y0 < 1.8) blockFootprint(nav, w, a, b);
    if (kind === 'glazing' && oy0 <= 0.2) blockFootprint(nav, w, a, b);
    cursor = b;
  }
  if (cursor < w.to) solid.push([cursor, w.to]);
  for (const [a, b] of solid) {
    wallBox(ctx, w, a, b, w.y0, w.y1);
    if (w.y0 < 1.8) blockFootprint(nav, w, a, b);
    if (w.y0 === 0) {
      // recessed shadow-gap skirting on both faces
      const h = w.t / 2 + 0.004;
      if (w.axis === 'x') {
        B.box(a, 0, w.at - h, b, 0.035, w.at - h + 0.01, M.shadowGap, { cast: false });
        B.box(a, 0, w.at + h - 0.01, b, 0.035, w.at + h, M.shadowGap, { cast: false });
      } else {
        B.box(w.at - h, 0, a, w.at - h + 0.01, 0.035, b, M.shadowGap, { cast: false });
        B.box(w.at + h - 0.01, 0, a, w.at + h, 0.035, b, M.shadowGap, { cast: false });
      }
    }
  }
}

function blockFootprint(nav, w, a, b) {
  const h = w.t / 2 + 0.02;
  if (w.axis === 'x') nav.wallRect(a, w.at - h, b, w.at + h);
  else nav.wallRect(w.at - h, a, w.at + h, b);
}

/** Walnut lining for large open passages (living <-> foyer, etc). */
function liningReveal(ctx, w, a, b, top) {
  const { batch: B, M } = ctx;
  const h = w.t / 2 + 0.012;
  const th = 0.025;
  if (w.axis === 'x') {
    B.box(a, 0, w.at - h, a + th, top, w.at + h, M.walnut);
    B.box(b - th, 0, w.at - h, b, top, w.at + h, M.walnut);
    B.box(a, top - th, w.at - h, b, top, w.at + h, M.walnut);
  } else {
    B.box(w.at - h, 0, a, w.at + h, top, a + th, M.walnut);
    B.box(w.at - h, 0, b - th, w.at + h, top, b, M.walnut);
    B.box(w.at - h, top - th, a, w.at + h, top, b, M.walnut);
  }
}

/** Minimal black aluminium window with slim frame and a single large pane. */
function buildWindow(ctx, w, a, b, y0, y1) {
  const { batch: B, M, glass } = ctx;
  const f = 0.05;
  const d = 0.12;
  const c = w.at;
  const frame = (x0, yy0, z0, x1, yy1, z1) => B.box(x0, yy0, z0, x1, yy1, z1, M.blackAlu);
  if (w.axis === 'x') {
    frame(a, y0, c - d / 2, a + f, y1, c + d / 2);
    frame(b - f, y0, c - d / 2, b, y1, c + d / 2);
    frame(a, y0, c - d / 2, b, y0 + f, c + d / 2);
    frame(a, y1 - f, c - d / 2, b, y1, c + d / 2);
    if (b - a > 2.6) { const m = (a + b) / 2; frame(m - f / 2, y0, c - d / 2, m + f / 2, y1, c + d / 2); }
    glass.push(boxGeo(a + f, y0 + f, c - 0.006, b - f, y1 - f, c + 0.006));
  } else {
    frame(c - d / 2, y0, a, c + d / 2, y1, a + f);
    frame(c - d / 2, y0, b - f, c + d / 2, y1, b);
    frame(c - d / 2, y0, a, c + d / 2, y0 + f, b);
    frame(c - d / 2, y1 - f, a, c + d / 2, y1, b);
    if (b - a > 2.6) { const m = (a + b) / 2; frame(c - d / 2, y0, m - f / 2, c + d / 2, y1, m + f / 2); }
    glass.push(boxGeo(c - 0.006, y0 + f, a + f, c + 0.006, y1 - f, b - f));
  }
}

function buildCurtainWall(ctx) {
  const { batch: B, M, nav, glass } = ctx;
  const { bays, slider } = CURTAIN;
  const top = H.roof;
  const mw = 0.07, md = 0.18;
  // spandrel band hiding the gallery slab edge
  B.box(-md / 2, 3.38, CURTAIN.z0, md / 2, 3.78, CURTAIN.z1, M.blackAlu);
  // sill and head rails
  B.box(-md / 2, -0.02, CURTAIN.z0, md / 2, 0.06, CURTAIN.z1, M.blackAlu);
  B.box(-md / 2, top - 0.08, CURTAIN.z0, md / 2, top + 0.02, CURTAIN.z1, M.blackAlu);
  for (const z of bays) {
    B.box(-md / 2, 0, z - mw / 2, md / 2, top, z + mw / 2, M.blackAlu);
  }
  for (let i = 0; i < bays.length - 1; i++) {
    const za = bays[i] + mw / 2, zb = bays[i + 1] - mw / 2;
    const isSlider = Math.abs(bays[i] - slider.fixed[0]) < 1e-3 || Math.abs(bays[i] - slider.moving[0]) < 1e-3;
    if (!isSlider) glass.push(boxGeo(-0.006, 0.06, za, 0.006, 3.38, zb));
    glass.push(boxGeo(-0.006, 3.78, za, 0.006, top - 0.08, zb));
  }
  // fixed panel of the lift-and-slide door (inner track)
  const fz0 = slider.fixed[0] + mw / 2, fz1 = slider.fixed[1];
  const fx = 0.035;
  const sf = 0.045;
  B.box(fx - 0.02, 0.06, fz0, fx + 0.02, slider.height - 0.02, fz0 + sf, M.blackAlu);
  B.box(fx - 0.02, 0.06, fz1 - sf, fx + 0.02, slider.height - 0.02, fz1, M.blackAlu);
  B.box(fx - 0.02, 0.06, fz0, fx + 0.02, 0.06 + sf, fz1, M.blackAlu);
  glass.push(boxGeo(fx - 0.005, 0.06 + sf, fz0 + sf, fx + 0.005, slider.height - 0.02, fz1 - sf));

  // curtain wall blocks movement except where the slider opens
  nav.wallRect(-0.14, CURTAIN.z0, 0.14, slider.moving[0]);
  nav.wallRect(-0.14, slider.moving[1], 0.14, CURTAIN.z1);
  nav.allowRect(-0.14, slider.moving[0], 0.14, slider.moving[1]);
}

function buildCeilings(ctx) {
  const { batch: B, M } = ctx;
  // Roof slab over the double-height block, with timber soffit overhang to the west.
  B.box(0, H.roof, -9.3, 12.3, H.roofTop, 12.3, M.ceiling);
  B.box(-1.8, H.roof + 0.05, -9.3, 0, H.roofTop, 12.3, M.walnut);
  B.box(-1.86, H.roof + 0.05, -9.3, -1.8, H.roofTop + 0.06, 12.3, M.blackAlu);
  B.box(3.2, H.roof, 12.0, 8.8, H.roofTop, 16.8, M.ceiling);
  // Wing roof (single storey)
  B.box(12.1, H.ceiling, -9.3, 30.3, H.slabTop + 0.1, 12.3, M.ceiling);

  // Living coffer: a 150mm dropped perimeter frame around a recessed field,
  // separated by a black reveal like the reference photograph.
  const cy = H.roof - 0.16;
  const fr = (x0, z0, x1, z1) => B.box(x0, cy, z0, x1, H.roof, z1, M.ceiling);
  fr(0, 0, 9, 1.0); fr(0, 11.0, 9, 12); fr(0, 1.0, 1.0, 11.0); fr(8.0, 1.0, 9, 11.0);
  const r = 0.035;
  B.box(1.0 - r, cy - 0.001, 1.0 - r, 8.0 + r, cy + 0.03, 1.0, M.shadowGap, { cast: false });
  B.box(1.0 - r, cy - 0.001, 11.0, 8.0 + r, cy + 0.03, 11.0 + r, M.shadowGap, { cast: false });
  B.box(1.0 - r, cy - 0.001, 1.0, 1.0, cy + 0.03, 11.0, M.shadowGap, { cast: false });
  B.box(8.0, cy - 0.001, 1.0, 8.0 + r, cy + 0.03, 11.0, M.shadowGap, { cast: false });

  // Dining coffer below the gallery slab.
  const dy = H.ceiling - 0.14;
  const df = (x0, z0, x1, z1) => B.box(x0, dy, z0, x1, H.ceiling, z1, M.ceiling);
  df(0, -9, 12, -7.6); df(0, -1.4, 12, 0); df(0, -7.6, 1.8, -1.4); df(10.2, -7.6, 12, -1.4);
  B.box(1.8 - r, dy - 0.001, -7.6 - r, 10.2 + r, dy + 0.025, -7.6, M.shadowGap, { cast: false });
  B.box(1.8 - r, dy - 0.001, -1.4, 10.2 + r, dy + 0.025, -1.4 + r, M.shadowGap, { cast: false });
  B.box(1.8 - r, dy - 0.001, -7.6, 1.8, dy + 0.025, -1.4, M.shadowGap, { cast: false });
  B.box(10.2, dy - 0.001, -7.6, 10.2 + r, dy + 0.025, -1.4, M.shadowGap, { cast: false });

  // Hall dropped ceiling with a perimeter shadow gap.
  B.box(12.0, H.hall, 0.08, 30, H.ceiling, 2.32, M.ceiling);
  B.box(12.0, H.hall - 0.001, 0.0, 30, H.hall + 0.06, 0.08, M.shadowGap, { cast: false });
  B.box(12.0, H.hall - 0.001, 2.32, 30, H.hall + 0.06, 2.4, M.shadowGap, { cast: false });

  // Ceiling-edge shadow gaps in wing rooms.
  for (const k of ['kitchen', 'master', 'masterBath', 'bedroom', 'bath']) {
    const rm = ROOMS[k];
    const y = H.ceiling - 0.03;
    B.box(rm.x0, y, rm.z0, rm.x1, H.ceiling, rm.z0 + 0.12, M.shadowGap, { cast: false });
    B.box(rm.x0, y, rm.z1 - 0.12, rm.x1, H.ceiling, rm.z1, M.shadowGap, { cast: false });
    B.box(rm.x0, y, rm.z0, rm.x0 + 0.12, H.ceiling, rm.z1, M.shadowGap, { cast: false });
    B.box(rm.x1 - 0.12, y, rm.z0, rm.x1, H.ceiling, rm.z1, M.shadowGap, { cast: false });
  }
}

function buildGallery(ctx) {
  const { batch: B, M, glass } = ctx;
  const y0 = H.ceiling, y1 = H.slabTop;
  // L-shaped gallery slab
  B.box(0.05, y0, -9.0, 12.0, y1, 0.0, M.ceiling);
  B.box(9.0, y0, 0.0, 12.0, y1, 12.0, M.ceiling);
  // gallery floor finish
  B.box(0.05, y1, -9.0, 12.0, y1 + 0.02, 0.0, M.stone, { cast: false });
  B.box(9.0, y1, 0.0, 12.0, y1 + 0.02, 12.0, M.stone, { cast: false });
  // black reveal on the slab fascia
  B.box(0.1, y0 + 0.11, -0.004, 9.0, y0 + 0.15, 0.004, M.shadowGap, { cast: false });
  B.box(8.996, y0 + 0.11, 0.0, 9.004, y0 + 0.15, 12.0, M.shadowGap, { cast: false });
  // black inlay lines on the soffit (as in the reference)
  B.box(9.4, y0 - 0.006, 0.0, 9.44, y0, 12.0, M.shadowGap, { cast: false });
  B.box(0.1, y0 - 0.006, -0.44, 12.0, y0, -0.4, M.shadowGap, { cast: false });

  // North parapet: white fluted solid balustrade with a slim walnut cap.
  B.box(0.15, y1, -0.14, 9.0, y1 + 1.05, 0.0, M.fluted, { uvRotate: 0 });
  B.box(0.15, y1 + 1.05, -0.16, 9.0, y1 + 1.09, 0.02, M.walnut);
  // East parapet: frameless glass with walnut handrail on a black shoe.
  B.box(9.0, y1, 0.0, 9.1, y1 + 0.1, 12.0, M.blackAlu);
  glass.push(boxGeo(9.04, y1 + 0.1, 0.0, 9.06, y1 + 1.05, 12.0));
  B.box(9.0, y1 + 1.05, 0.0, 9.1, y1 + 1.1, 12.0, M.walnut);

  // Upper lounge glazed partition at z = -2 with black frames.
  for (let x = 0.15; x <= 12.0; x += 2.0) B.box(x - 0.03, y1, -2.05, x + 0.03, H.roof, -1.95, M.blackAlu);
  B.box(0.1, H.roof - 0.06, -2.05, 12, H.roof, -1.95, M.blackAlu);
  glass.push(boxGeo(0.1, y1 + 0.02, -2.006, 12, H.roof - 0.06, -1.994));
  // Upper lounge interior: walnut back wall and a few silhouettes.
  B.box(0.15, y1, -8.98, 12, H.roof, -8.9, M.walnut);
  B.box(2.5, y1, -8.4, 7.5, y1 + 0.42, -7.4, M.linenGrey);
  B.box(2.5, y1, -8.9, 7.5, y1 + 0.85, -8.4, M.linenGrey);
  B.box(8.5, y1, -8.6, 10.5, y1 + 0.55, -8.2, M.walnutDark);

  // Upper back wall (x=12) on the gallery: walnut with tall fluted section.
  B.box(11.86, y1, -2.0, 11.9, H.roof, 4.0, M.walnut);
  B.box(11.86, y1, 4.0, 11.9, H.roof, 9.0, M.fluted);
  B.box(11.86, y1, 9.0, 11.9, H.roof, 12.0, M.walnut);
  // Upper south wall face on the gallery
  B.box(9.0, y1, 11.85, 11.9, H.roof, 11.9, M.walnut);
}

function buildColumnsAndCladding(ctx) {
  const { batch: B, M, nav } = ctx;
  const col = (x, z, s = 0.46) => {
    B.box(x - s / 2, 0, z - s / 2, x + s / 2, H.ceiling, z + s / 2, M.walnut);
    B.box(x - s / 2 - 0.01, 0, z - s / 2 - 0.01, x + s / 2 + 0.01, 0.035, z + s / 2 + 0.01, M.shadowGap, { cast: false });
    nav.blockRect(x - s / 2 - 0.02, z - s / 2 - 0.02, x + s / 2 + 0.02, z + s / 2 + 0.02);
  };
  col(9.0, 0.0);
  col(9.0, 6.0);
  col(12.0, -0.1, 0.4);

  // Living east wall (x=12, living face at 11.9): walnut panelling with
  // a honed basalt fireplace wall in the middle.
  const fx = 11.9;
  B.box(fx - 0.03, 0, 2.5, fx, H.ceiling, 5.0, M.walnut);
  B.box(fx - 0.03, 0, 9.0, fx, H.ceiling, 11.9, M.walnut);
  B.box(fx - 0.06, 0, 5.0, fx, H.ceiling, 9.0, M.slate);
  // Above the soffit (living void), the east wall is part of the gallery.
  // Kitchen corner pier facing the living void.
  B.box(fx - 0.03, 0, 2.4, fx, H.ceiling, 2.5, M.shadowGap);
}
