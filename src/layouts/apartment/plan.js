import { ROOMS, roomAt } from './data.js';

/*
 * Floor plan of the apartment, drawn from the same plan data that builds the 3D scene. Plan
 * coordinates are flipped (y north -> web z) so the drawing matches the walk-through exactly.
 */
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
};

const NAMES = { living: 'Living', dining: 'Dining', kitchen: 'Kitchen', entry: 'Entrance', bedroom: 'Bedroom', study: 'Study', bath: 'Bathroom', terrace: 'Terrace' };

export class ApartmentPlan {
  constructor(svg, onSelect, json) {
    this.svg = svg;
    this.onSelect = onSelect;
    this.json = json;
    svg.setAttribute('viewBox', '-0.9 -9.5 15.6 10.8');
    this.draw();
  }

  draw() {
    const svg = this.svg, J = this.json;
    const g = el('g', {}, svg);
    // terrace deck
    el('rect', { x: 10.8, y: -6.64, width: 3.25, height: 6.64, class: 'deck' }, g);
    // rooms (the open plan is one floor, labelled by its zones)
    el('rect', { x: 0.25, y: -8.35, width: 10.3, height: 8.1, class: 'room', 'pointer-events': 'none' }, g);
    for (const [key, r] of Object.entries(ROOMS)) {
      const [x0, y0, x1, y1] = r.rect;
      const hit = el('rect', { x: x0, y: -y1, width: x1 - x0, height: y1 - y0, class: `room${r.outdoor ? ' outdoor' : ''}`, fill: 'transparent' }, g);
      hit.addEventListener('click', () => this.onSelect(key));
      const t = el('text', { x: (x0 + x1) / 2, y: -(y0 + y1) / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': key === 'living' || key === 'dining' ? 0.34 : 0.3 }, g);
      t.textContent = NAMES[key];
      t.setAttribute('pointer-events', 'none');
    }
    // walls, with their doorways left open
    for (const w of J.plan.walls) {
      const horiz = Math.abs(w.a[1] - w.b[1]) < 1e-6;
      const dir = horiz ? Math.sign(w.b[0] - w.a[0]) : Math.sign(w.b[1] - w.a[1]);
      const len = Math.abs(horiz ? w.b[0] - w.a[0] : w.b[1] - w.a[1]);
      const cuts = w.ops.filter((o) => o.sill < 0.2).map((o) => [o.c - o.w / 2, o.c + o.w / 2]).sort((p, q) => p[0] - q[0]);
      const solids = [];
      let c = 0;
      for (const [a, b] of cuts) { if (a > c) solids.push([c, a]); c = Math.max(c, b); }
      if (c < len) solids.push([c, len]);
      for (const [a, b] of solids) {
        const x0 = horiz ? w.a[0] + dir * a : w.a[0], y0 = horiz ? w.a[1] : w.a[1] + dir * a;
        const x1 = horiz ? w.a[0] + dir * b : w.a[0], y1 = horiz ? w.a[1] : w.a[1] + dir * b;
        if (horiz) el('rect', { x: Math.min(x0, x1), y: -(y0 + w.t / 2), width: Math.abs(x1 - x0), height: w.t, class: 'wall' }, g);
        else el('rect', { x: x0 - w.t / 2, y: -Math.max(y0, y1), width: w.t, height: Math.abs(y1 - y0), class: 'wall' }, g);
      }
    }
    // glazing
    for (const o of J.plan.windows) {
      el('line', { x1: o.a[0], y1: -o.a[1], x2: o.b[0], y2: -o.b[1], class: 'glass' }, g);
    }
    // terrace parapet
    el('path', { d: 'M 10.8 -0.1 H 14 V -6.54 H 10.8', fill: 'none', class: 'wall', 'stroke-width': 0.14, stroke: 'currentColor', opacity: 0.55 }, g);
    // door swings
    for (const d of J.plan.doors) {
      const [hx, hy] = d.hinge;
      const a = (d.yaw * Math.PI) / 180;
      const ex = hx + Math.cos(a) * d.w, ey = hy + Math.sin(a) * d.w;
      // the leaf swings to whichever side of the wall has a room
      let sx = -Math.sin(a), sy = Math.cos(a);
      const mx = (hx + ex) / 2, my = (hy + ey) / 2;
      if (!roomAt(mx + sx * 0.6, -(my + sy * 0.6)) && roomAt(mx - sx * 0.6, -(my - sy * 0.6))) { sx = -sx; sy = -sy; }
      const ox = hx + sx * d.w, oy = hy + sy * d.w;
      const sweep = (Math.cos(a) * sy - Math.sin(a) * sx) > 0 ? 0 : 1;
      el('path', { d: `M ${hx} ${-hy} L ${ox} ${-oy} A ${d.w} ${d.w} 0 0 ${sweep} ${ex} ${-ey}`, class: 'door' }, g);
    }
    // the sliding door
    el('line', { x1: 10.675, y1: -2.77, x2: 10.675, y2: -5.19, class: 'door', 'stroke-dasharray': '0.18 0.12' }, g);

    this.me = el('g', {}, svg);
    el('path', { d: 'M 0 0 L -1.3 -2.6 A 2.9 2.9 0 0 1 1.3 -2.6 Z', class: 'cone' }, this.me);
    el('circle', { cx: 0, cy: 0, r: 0.22, class: 'me' }, this.me);
  }

  update(x, z, yaw) {
    this.me.setAttribute('transform', `translate(${x} ${z}) rotate(${(-yaw * 180) / Math.PI})`);
  }
}
