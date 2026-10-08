/*
 * The residence plan, in metres. x runs east, z runs south, y is up.
 * Ground floor finished level is y = 0. The living room and entrance hall are
 * double height (7.4 m); the gallery level (visible, not walkable) sits above
 * the dining room, kitchen side and the east strip of the living room.
 *
 *            x=0          x=12        x=20    x=26   x=30
 *   z=-9  +-----------------+-----------+-------+------+
 *   T     |     DINING      |  KITCHEN  |BEDROOM| BATH |
 *   E     |  (under gallery)|           |       |      |
 *   R z=0 |- - - - - - - -  +-----------+--[ ]--+-[ ]--+
 *   R     |                      HALL                  |
 *   A     |    LIVING   :   z=2.4 +-[ ]--------+-------+
 *   C     |  double ht  :         |  MASTER    |MASTER |
 *   E     |             :         |  BEDROOM   | BATH  |
 *   z=12  +---+=====+---+---------+------------+-------+
 *             |FOYER|
 *             +-[ ]-+ z=16.5
 */

export const H = {
  ceiling: 3.4,     // standard ceiling
  hall: 3.0,        // hallway dropped ceiling
  slabTop: 3.7,     // gallery floor level
  roof: 7.4,        // underside of roof slab (double height spaces)
  roofTop: 7.8,
  door: 2.7,
  eye: 1.65,
};

export const ROOMS = {
  living:     { name: 'Living Room',    x0: 0,   x1: 12, z0: 0,    z1: 12,   floor: 'stone', ceil: H.roof },
  foyer:      { name: 'Entrance',       x0: 3.5, x1: 8.5, z0: 12,  z1: 16.5, floor: 'stone', ceil: H.roof },
  dining:     { name: 'Dining',         x0: 0,   x1: 12, z0: -9,   z1: 0,    floor: 'stone', ceil: H.ceiling },
  kitchen:    { name: 'Kitchen',        x0: 12,  x1: 20, z0: -9,   z1: 0,    floor: 'stone', ceil: H.ceiling },
  hall:       { name: 'Hallway',        x0: 12,  x1: 30, z0: 0,    z1: 2.4,  floor: 'stone', ceil: H.hall },
  master:     { name: 'Master Bedroom', x0: 12,  x1: 22, z0: 2.4,  z1: 12,   floor: 'oak',   ceil: H.ceiling },
  masterBath: { name: 'Bathroom',       x0: 22,  x1: 30, z0: 2.4,  z1: 12,   floor: 'whiteMarble', ceil: H.ceiling },
  bedroom:    { name: 'Bedroom',        x0: 20,  x1: 26, z0: -9,   z1: 0,    floor: 'oak',   ceil: H.ceiling },
  bath:       { name: 'Guest Bath',     x0: 26,  x1: 30, z0: -9,   z1: 0,    floor: 'whiteMarble', ceil: H.ceiling },
  terrace:    { name: 'Terrace',        x0: -8,  x1: 0,  z0: -9,   z1: 14,   floor: 'deck',  ceil: null, outdoor: true },
};

/* Curated arrival viewpoints for the room selector: [x, z] position and look target. */
export const VIEWS = {
  living:     { pos: [7.6, 10.6], look: [2.5, 0.5, 2.6] },
  dining:     { pos: [2.2, 1.2],  look: [7.5, 1.4, -6.5] },
  kitchen:    { pos: [12.6, -0.9], look: [17.0, 1.1, -5.6] },
  master:     { pos: [13.8, 3.6], look: [19.0, 1.1, 9.5] },
  bedroom:    { pos: [21.2, -1.0], look: [24.0, 1.0, -6.5] },
  masterBath: { pos: [22.9, 3.6], look: [27.5, 1.1, 9.0] },
  terrace:    { pos: [-1.6, 7.8], look: [-4.0, 1.5, -5.0] },
  foyer:      { pos: [6.0, 15.4], look: [6.0, 2.6, 6.0] },
};

/* Room selector order (as requested). */
export const SELECTOR = [
  ['living', 'Living Room'],
  ['kitchen', 'Kitchen'],
  ['dining', 'Dining'],
  ['master', 'Master Bedroom'],
  ['bedroom', 'Bedroom'],
  ['masterBath', 'Bathroom'],
  ['terrace', 'Terrace'],
];

/*
 * Doors. `wall` names the axis of the wall the door sits in ('x' = wall runs
 * along x at fixed z). hinge is the coordinate of the hinge jamb along the wall;
 * width extends in +dir along the wall. `swing` is +1/-1: the side (in the
 * wall's normal axis) the leaf opens toward.
 */
export const DOORS = [
  { id: 'front',      wall: 'x', at: 16.5, from: 5.2,  to: 6.8,  height: 3.2, swing: -1, pivot: true, label: 'Entrance door' },
  { id: 'master',     wall: 'x', at: 2.4,  from: 13.0, to: 14.0, height: H.door, swing: 1, hingeAt: 'from' },
  { id: 'masterBath', wall: 'z', at: 22,   from: 3.0,  to: 3.95, height: H.door, swing: 1, hingeAt: 'from' },
  { id: 'bedroom',    wall: 'x', at: 0,    from: 20.6, to: 21.6, height: H.door, swing: -1, hingeAt: 'from' },
  { id: 'bath',       wall: 'x', at: 0,    from: 26.6, to: 27.5, height: H.door, swing: -1, hingeAt: 'to' },
];

/*
 * Walls. axis 'x' => runs along x at constant z (=at); 'z' => along z at x=at.
 * Openings are [from, to, y0, y1] along the wall. Doors are added automatically.
 */
export const WALLS = [
  // ---- exterior envelope ----
  { axis: 'x', at: -9.15, from: -0.1, to: 12, t: 0.3, y0: 0, y1: H.roofTop, ext: true,
    openings: [[0.6, 2.4, 0.0, 3.0], [0.6, 11.4, 4.2, 6.9]] },
  { axis: 'x', at: -9.15, from: 12, to: 30.3, t: 0.3, y0: 0, y1: H.slabTop + 0.1, ext: true,
    openings: [[14.2, 17.8, 1.05, 2.25], [21.6, 24.6, 0.0, 3.0], [27.2, 28.8, 1.6, 2.7]] },
  { axis: 'z', at: 30.15, from: -9.3, to: 12.3, t: 0.3, y0: 0, y1: H.slabTop + 0.1, ext: true,
    openings: [[0.35, 2.05, 0.0, 2.7], [4.5, 9.9, 0.45, 3.0], [-6.2, -2.8, 1.6, 2.7]] },
  { axis: 'x', at: 12.15, from: 12, to: 30.3, t: 0.3, y0: 0, y1: H.slabTop + 0.1, ext: true,
    openings: [[13.6, 20.4, 0.0, 3.1], [24.0, 28.0, 1.6, 2.8]] },
  { axis: 'x', at: 12.15, from: -0.1, to: 3.5, t: 0.3, y0: 0, y1: H.roofTop, ext: true },
  { axis: 'x', at: 12.15, from: 8.5, to: 12.0, t: 0.3, y0: 0, y1: H.roofTop, ext: true },
  // foyer envelope (double height)
  { axis: 'z', at: 3.35, from: 12.0, to: 16.8, t: 0.3, y0: 0, y1: H.roofTop, ext: true,
    openings: [[13.0, 15.6, 0.0, 6.8]] },
  { axis: 'z', at: 8.65, from: 12.0, to: 16.8, t: 0.3, y0: 0, y1: H.roofTop, ext: true },
  { axis: 'x', at: 16.65, from: 3.35, to: 8.65, t: 0.3, y0: 0, y1: H.roofTop, ext: true },
  // ---- interior ----
  // living <-> master bedroom (double height on living side)
  { axis: 'z', at: 12.0, from: 2.4, to: 12.0, t: 0.2, y0: 0, y1: H.roofTop },
  // upper part of x=12 above kitchen/hall (gallery back wall)
  { axis: 'z', at: 12.0, from: -9.0, to: 2.4, t: 0.2, y0: H.ceiling, y1: H.roofTop },
  { axis: 'z', at: 12.0, from: 0.0, to: 2.4, t: 0.2, y0: H.hall, y1: H.ceiling },
  // kitchen <-> hall
  { axis: 'x', at: 0.0, from: 12.0, to: 20.0, t: 0.2, y0: 0, y1: H.ceiling },
  // kitchen <-> bedroom
  { axis: 'z', at: 20.0, from: -9.0, to: 0.0, t: 0.16, y0: 0, y1: H.ceiling },
  // bedroom + bath <-> hall
  { axis: 'x', at: 0.0, from: 20.0, to: 30.0, t: 0.16, y0: 0, y1: H.ceiling },
  // bedroom <-> bath
  { axis: 'z', at: 26.0, from: -9.0, to: 0.0, t: 0.16, y0: 0, y1: H.ceiling },
  // hall <-> master + master bath
  { axis: 'x', at: 2.4, from: 12.0, to: 30.0, t: 0.16, y0: 0, y1: H.ceiling },
  // master <-> master bath
  { axis: 'z', at: 22.0, from: 2.4, to: 12.0, t: 0.16, y0: 0, y1: H.ceiling },
  // living <-> foyer (south wall of living), grand opening x 4..8 full height
  { axis: 'x', at: 12.0, from: 3.5, to: 8.5, t: 0.2, y0: 0, y1: H.roofTop, openings: [[4.0, 8.0, 0.0, 6.6]] },
];

/* The west elevation is a floor-to-roof curtain wall. Mullion lines (z). */
export const CURTAIN = {
  x: 0,
  z0: -9, z1: 12,
  bays: [-9, -7.25, -5.5, -3.75, -2, -0.25, 1.5, 3.25, 5, 6.75, 8.5, 10.25, 12],
  transoms: [3.55],
  slider: { fixed: [3.25, 5.0], moving: [5.0, 6.75], height: 3.4 },
};

export function roomAt(x, z) {
  for (const [k, r] of Object.entries(ROOMS)) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return k;
  }
  return null;
}
