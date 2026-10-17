/*
 * Walkability grid (10 cm cells) used for collision and for A* routing when the
 * visitor chooses a room or clicks the floor. Walls and furniture are
 * rasterised into it; doors are dynamic blockers.
 */

export class NavGrid {
  constructor(x0, z0, x1, z1, cell = 0.1) {
    this.x0 = x0; this.z0 = z0; this.cell = cell;
    this.w = Math.ceil((x1 - x0) / cell);
    this.h = Math.ceil((z1 - z0) / cell);
    this.walk = new Uint8Array(this.w * this.h); // 1 = floor exists
    this.block = new Uint8Array(this.w * this.h); // 1 = static obstacle
    this.door = new Uint16Array(this.w * this.h); // door id + 1 when a door leaf occupies the cell
    this.wall = new Uint8Array(this.w * this.h); // 1 = architectural wall (for line of sight)
    this.dyn = new Uint8Array(this.w * this.h); // 1 = movable furniture (rebuilt when items move)
    this.itemNav = new Map(); // item id -> { shapes, home:{x,z}, tf:{x,z,ry}, active }
    this._rec = null;
    this.doorClosed = new Map();
    this.radius = 0.28;
    this._offsets = null;
    this._clear = null;
  }

  ix(x) { return Math.floor((x - this.x0) / this.cell); }
  iz(z) { return Math.floor((z - this.z0) / this.cell); }
  cx(i) { return this.x0 + (i + 0.5) * this.cell; }
  cz(j) { return this.z0 + (j + 0.5) * this.cell; }

  _rect(x0, z0, x1, z1, fn) {
    const a = Math.max(0, this.ix(Math.min(x0, x1))), b = Math.min(this.w - 1, this.ix(Math.max(x0, x1) - 1e-6));
    const c = Math.max(0, this.iz(Math.min(z0, z1))), d = Math.min(this.h - 1, this.iz(Math.max(z0, z1) - 1e-6));
    for (let j = c; j <= d; j++) for (let i = a; i <= b; i++) fn(j * this.w + i, i, j);
  }

  allowRect(x0, z0, x1, z1) { this._rect(x0, z0, x1, z1, (k) => { this.walk[k] = 1; }); this._clear = null; }
  disallowRect(x0, z0, x1, z1) { this._rect(x0, z0, x1, z1, (k) => { this.walk[k] = 0; }); this._clear = null; }
  /** Start capturing blockers as movable shapes instead of rasterising them as static. */
  beginRecord() { this._rec = []; }
  endRecord() { const r = this._rec || []; this._rec = null; return r; }

  blockRect(x0, z0, x1, z1) {
    if (this._rec) { this._rec.push({ t: 'o', x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0), d: Math.abs(z1 - z0), ry: 0 }); return; }
    this._rect(x0, z0, x1, z1, (k) => { this.block[k] = 1; }); this._clear = null;
  }
  wallRect(x0, z0, x1, z1) { this._rect(x0, z0, x1, z1, (k) => { this.block[k] = 1; this.wall[k] = 1; }); this._clear = null; }

  /** True when an architectural wall lies on the 2D segment a->b (ignores the ends). */
  wallBetween(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(d / (this.cell * 0.5));
    for (let s = 2; s < n - 2; s++) {
      const t = s / n;
      const i = this.ix(ax + (bx - ax) * t), j = this.iz(az + (bz - az) * t);
      if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
      const k = j * this.w + i;
      if (this.wall[k]) return true;
      if (this.door[k] && this.doorClosed.get(this.door[k] - 1) && this.doorIsLeaf?.(this.door[k] - 1)) return true;
    }
    return false;
  }
  blockCircle(x, z, r) {
    if (this._rec) { this._rec.push({ t: 'c', x, z, r }); return; }
    this._rect(x - r, z - r, x + r, z + r, (k, i, j) => {
      const dx = this.cx(i) - x, dz = this.cz(j) - z;
      if (dx * dx + dz * dz <= r * r) this.block[k] = 1;
    });
    this._clear = null;
  }
  /** Oriented rectangle centred at (x,z), size (w,d), rotated by ry around y. */
  blockOriented(x, z, w, d, ry) {
    if (this._rec) { this._rec.push({ t: 'o', x, z, w, d, ry }); return; }
    const c = Math.cos(ry), s = Math.sin(ry);
    const R = Math.hypot(w, d) / 2;
    this._rect(x - R, z - R, x + R, z + R, (k, i, j) => {
      const dx = this.cx(i) - x, dz = this.cz(j) - z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) <= w / 2 && Math.abs(lz) <= d / 2) this.block[k] = 1;
    });
    this._clear = null;
  }
  registerDoor(id, x0, z0, x1, z1) {
    this._rect(x0, z0, x1, z1, (k) => { this.door[k] = id + 1; });
    this.doorClosed.set(id, true);
  }
  setDoorClosed(id, closed) { this.doorClosed.set(id, closed); }

  // ---- movable furniture --------------------------------------------------

  /** Visit every cell whose centre lies inside the (transformed, optionally shrunk) shapes. */
  _rasterShapes(shapes, home, tf, shrink, fn) {
    const c = Math.cos(tf.ry), s = Math.sin(tf.ry);
    const k = tf.s || 1;   // uniform scale about the pivot
    for (const sh0 of shapes) {
      const sh = k === 1 ? sh0 : { ...sh0, w: sh0.w * k, d: sh0.d * k, r: sh0.r * k, x: home.x + (sh0.x - home.x) * k, z: home.z + (sh0.z - home.z) * k };
      // item rotation is about the home pivot, matching THREE.Object3D.rotation.y
      const dx = sh.x - home.x, dz = sh.z - home.z;
      const wx = tf.x + dx * c + dz * s, wz = tf.z - dx * s + dz * c;
      if (sh.t === 'c') {
        const r = Math.max(0.02, sh.r - shrink);
        this._rect(wx - r, wz - r, wx + r, wz + r, (k, i, j) => {
          const ex = this.cx(i) - wx, ez = this.cz(j) - wz;
          if (ex * ex + ez * ez <= r * r) fn(k);
        });
      } else {
        const ry = sh.ry + tf.ry;
        const cc = Math.cos(ry), ss = Math.sin(ry);
        const w = Math.max(0.04, sh.w - shrink * 2), d = Math.max(0.04, sh.d - shrink * 2);
        const R = Math.hypot(w, d) / 2;
        this._rect(wx - R, wz - R, wx + R, wz + R, (k, i, j) => {
          const ex = this.cx(i) - wx, ez = this.cz(j) - wz;
          const lx = ex * cc - ez * ss, lz = ex * ss + ez * cc;
          if (Math.abs(lx) <= w / 2 && Math.abs(lz) <= d / 2) fn(k);
        });
      }
    }
  }

  registerItem(id, shapes, home) {
    this.itemNav.set(id, { shapes, home, tf: { x: home.x, z: home.z, ry: 0 }, active: true });
  }
  setItemTransform(id, tf) { const it = this.itemNav.get(id); if (it) it.tf = { ...tf }; }
  setItemActive(id, active) { const it = this.itemNav.get(id); if (it) it.active = active; }

  /** Recompute the movable-furniture layer. `exclude` is the piece being dragged. */
  rebuildDynamic(exclude = null) {
    this.dyn.fill(0);
    for (const [id, it] of this.itemNav) {
      if (!it.active || id === exclude || it.flat) continue;
      this._rasterShapes(it.shapes, it.home, it.tf, 0, (k) => { this.dyn[k] = 1; });
    }
    this._clear = null;
  }

  /**
   * Can this item stand at `tf`? Walls, other furniture and anything non-walkable
   * (pool, outside the plan) reject it; a few centimetres of contact with a wall
   * is allowed so pieces can sit flush against it. Flat items (rugs) only avoid walls.
   */
  itemFits(id, tf) {
    const it = this.itemNav.get(id);
    let ok = true, cells = 0;
    this._rasterShapes(it.shapes, it.home, tf, 0.08, (k) => {
      cells++;
      if (!ok) return;
      if (!this.walk[k] || this.wall[k]) ok = false;
      else if (!it.flat && (this.block[k] || this.dyn[k])) ok = false;
    });
    // a footprint that lands entirely outside the grid covers no cells at all: that is "outside the plan"
    return ok && cells > 0;
  }

  /** True when a wall cell lies on the segment (doorways and furniture do not count). */
  wallOnSegment(ax, az, bx, bz) {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (this.cell * 0.5)));
    for (let s = 0; s <= n; s++) {
      const t = s / n;
      const i = this.ix(ax + (bx - ax) * t), j = this.iz(az + (bz - az) * t);
      if (i < 0 || j < 0 || i >= this.w || j >= this.h) return true;
      if (this.wall[j * this.w + i]) return true;
    }
    return false;
  }

  /** True when a wall, void or closed door lies on the straight 2D segment a -> b. */
  segmentBlocked(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(d / (this.cell * 0.5)));
    for (let s = 0; s <= n; s++) {
      const t = s / n;
      const i = this.ix(ax + (bx - ax) * t), j = this.iz(az + (bz - az) * t);
      if (i < 0 || j < 0 || i >= this.w || j >= this.h) return true;
      const k = j * this.w + i;
      if (!this.walk[k] || this.wall[k]) return true;
      if (this.door[k] && this.doorClosed.get(this.door[k] - 1)) return true;
    }
    return false;
  }

  _solid(k, withDoors) {
    if (!this.walk[k] || this.block[k] || this.dyn[k]) return true;
    if (withDoors && this.door[k] && this.doorClosed.get(this.door[k] - 1)) return true;
    return false;
  }

  offsets() {
    if (this._offsets) return this._offsets;
    const r = Math.ceil(this.radius / this.cell);
    const o = [];
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if ((i * i + j * j) * this.cell * this.cell <= this.radius * this.radius) o.push([i, j]);
    }
    this._offsets = o;
    return o;
  }

  /** Is a body of `radius` free at (x,z)? Doors count as solid when closed. */
  free(x, z, withDoors = true) {
    const i = this.ix(x), j = this.iz(z);
    for (const [di, dj] of this.offsets()) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= this.w || jj >= this.h) return false;
      if (this._solid(jj * this.w + ii, withDoors)) return false;
    }
    return true;
  }

  /** Door id blocking the body at (x,z), or -1. */
  doorAt(x, z) {
    const i = this.ix(x), j = this.iz(z);
    for (const [di, dj] of this.offsets()) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= this.w || jj >= this.h) continue;
      const d = this.door[jj * this.w + ii];
      if (d && this.doorClosed.get(d - 1)) return d - 1;
    }
    return -1;
  }

  /** Clearance map for routing: doors are treated as passable (they auto-open). */
  clearance() {
    if (this._clear) return this._clear;
    const c = new Uint8Array(this.w * this.h);
    const off = this.offsets();
    const r = Math.ceil(this.radius / this.cell);
    for (let j = r; j < this.h - r; j++) for (let i = r; i < this.w - r; i++) {
      let ok = 1;
      for (const [di, dj] of off) {
        if (this._solid((j + dj) * this.w + i + di, false)) { ok = 0; break; }
      }
      c[j * this.w + i] = ok;
    }
    this._clear = c;
    return c;
  }

  nearestFree(x, z, maxR = 2) {
    const c = this.clearance();
    const i0 = this.ix(x), j0 = this.iz(z);
    const R = Math.ceil(maxR / this.cell);
    let best = null, bd = Infinity;
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const ii = i0 + i, jj = j0 + j;
      if (ii < 0 || jj < 0 || ii >= this.w || jj >= this.h) continue;
      if (!c[jj * this.w + ii]) continue;
      const d = i * i + j * j;
      if (d < bd) { bd = d; best = [ii, jj]; }
    }
    return best;
  }

  /** A* over the clearance map; returns a smoothed list of [x,z] waypoints. */
  findPath(sx, sz, tx, tz) {
    const c = this.clearance();
    const s = this.nearestFree(sx, sz, 1.5), t = this.nearestFree(tx, tz, 2.5);
    if (!s || !t) return null;
    const W = this.w, N = W * this.h;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const start = s[1] * W + s[0], goal = t[1] * W + t[0];
    const heap = new MinHeap();
    const hfn = (k) => { const i = k % W, j = (k / W) | 0; const dx = Math.abs(i - t[0]), dz = Math.abs(j - t[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    g[start] = 0;
    heap.push(start, hfn(start));
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false, iter = 0;
    while (heap.size && iter++ < 400000) {
      const k = heap.pop();
      if (k === goal) { found = true; break; }
      if (closed[k]) continue;
      closed[k] = 1;
      const i = k % W, j = (k / W) | 0;
      for (const [di, dj, cost] of dirs) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= W || jj >= this.h) continue;
        const kk = jj * W + ii;
        if (!c[kk] || closed[kk]) continue;
        if (di && dj && (!c[j * W + ii] || !c[jj * W + i])) continue;
        const ng = g[k] + cost;
        if (ng < g[kk]) { g[kk] = ng; came[kk] = k; heap.push(kk, ng + hfn(kk)); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = goal; k !== -1; k = came[k]) cells.push(k);
    cells.reverse();
    const pts = cells.map((k) => [this.cx(k % W), this.cz((k / W) | 0)]);
    return this._smooth(pts);
  }

  lineClear(a, b) {
    const c = this.clearance();
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.ceil(d / (this.cell * 0.5));
    for (let s = 0; s <= n; s++) {
      const t = s / Math.max(n, 1);
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const i = this.ix(x), j = this.iz(z);
      if (i < 0 || j < 0 || i >= this.w || j >= this.h || !c[j * this.w + i]) return false;
    }
    return true;
  }

  _smooth(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.lineClear(pts[i], pts[j])) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pri) {
    const k = this.k, p = this.p;
    k.push(key); p.push(pri);
    let i = k.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (p[par] <= p[i]) break;
      [k[par], k[i]] = [k[i], k[par]]; [p[par], p[i]] = [p[i], p[par]];
      i = par;
    }
  }
  pop() {
    const k = this.k, p = this.p;
    const top = k[0];
    const lk = k.pop(), lp = p.pop();
    if (k.length) {
      k[0] = lk; p[0] = lp;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < k.length && p[l] < p[m]) m = l;
        if (r < k.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [p[m], p[i]] = [p[i], p[m]];
        i = m;
      }
    }
    return top;
  }
}
