import { ROOMS, WALLS, DOORS, CURTAIN, SELECTOR } from '../world/layout.js';

/*
 * Architectural floor plan drawn from the same data that builds the 3D house,
 * so it is always exact. Clicking a room walks the visitor there.
 */

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
};

export class FloorPlan {
  constructor(svg, onSelect) {
    this.svg = svg;
    this.onSelect = onSelect;
    const pad = 0.6;
    const x0 = -9.0 - pad, z0 = -9.8 - pad, x1 = 30.6 + pad, z1 = 17.2 + pad;
    svg.setAttribute('viewBox', `${x0} ${z0} ${x1 - x0} ${z1 - z0}`);
    this.draw();
  }

  draw() {
    const svg = this.svg;
    const g = el('g', {}, svg);
    // terrace & pool
    el('rect', { x: -8, y: -9.3, width: 8, height: 23.3, class: 'deck' }, g);
    el('rect', { x: -7.4, y: -7, width: 2.8, height: 17, class: 'pool' }, g);

    const names = Object.fromEntries(SELECTOR);
    for (const [key, r] of Object.entries(ROOMS)) {
      const target = key === 'foyer' ? 'living' : key === 'hall' ? null : key === 'bath' ? 'masterBath' : key;
      const rect = el('rect', {
        x: r.x0, y: r.z0, width: r.x1 - r.x0, height: r.z1 - r.z0,
        class: `room${r.outdoor ? ' outdoor' : ''}`,
      }, g);
      if (target || key === 'hall' || key === 'bath') {
        rect.addEventListener('click', () => this.onSelect(key));
      }
      const label = names[key] || r.name;
      const t = el('text', { x: (r.x0 + r.x1) / 2, y: (r.z0 + r.z1) / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g);
      if (key === 'living') { t.setAttribute('class', 'big'); t.setAttribute('y', 7.2); }
      if (key === 'terrace') { t.setAttribute('x', -2.4); t.setAttribute('y', 12.2); }
      if (key === 'hall') t.setAttribute('font-size', '0.32');
      t.textContent = label;
    }

    // walls (solid parts only)
    const doorOps = new Map();
    for (const d of DOORS) {
      const k = `${d.wall}:${d.at}`;
      if (!doorOps.has(k)) doorOps.set(k, []);
      doorOps.get(k).push([d.from, d.to, 0, d.height]);
    }
    for (const w of WALLS) {
      if (w.y0 > 1) continue;
      const ops = [...(w.openings || []), ...(doorOps.get(`${w.axis}:${w.at}`) || [])]
        .filter((o) => o[2] < 1.2)
        .sort((a, b) => a[0] - b[0]);
      let c = w.from;
      const solids = [];
      for (const o of ops) {
        if (o[0] > c) solids.push([c, o[0]]);
        c = Math.max(c, o[1]);
        if (w.ext && o[2] < 1.2 && !DOORS.some((d) => d.from === o[0] && d.to === o[1])) {
          // floor-to-ceiling glazing line
          if (w.axis === 'x') el('line', { x1: o[0], y1: w.at, x2: o[1], y2: w.at, class: 'glass' }, g);
          else el('line', { x1: w.at, y1: o[0], x2: w.at, y2: o[1], class: 'glass' }, g);
        }
      }
      if (c < w.to) solids.push([c, w.to]);
      for (const [a, b] of solids) {
        if (w.axis === 'x') el('rect', { x: a, y: w.at - w.t / 2, width: b - a, height: w.t, class: 'wall' }, g);
        else el('rect', { x: w.at - w.t / 2, y: a, width: w.t, height: b - a, class: 'wall' }, g);
      }
    }
    // windows above sill in walls
    for (const w of WALLS) {
      if (!w.ext) continue;
      for (const o of w.openings || []) {
        if (o[2] < 0.3 || o[2] > 2) continue;
        if (w.axis === 'x') el('line', { x1: o[0], y1: w.at, x2: o[1], y2: w.at, class: 'glass' }, g);
        else el('line', { x1: w.at, y1: o[0], x2: w.at, y2: o[1], class: 'glass' }, g);
      }
    }
    // curtain wall
    el('line', { x1: CURTAIN.x, y1: CURTAIN.z0, x2: CURTAIN.x, y2: CURTAIN.z1, class: 'glass' }, g);
    for (const z of CURTAIN.bays) el('rect', { x: -0.06, y: z - 0.05, width: 0.12, height: 0.1, class: 'wall' }, g);
    // door swings
    for (const d of DOORS) {
      const w = d.to - d.from;
      const hingeTo = d.hingeAt === 'to';
      if (d.wall === 'x') {
        const hx = hingeTo ? d.to : d.from, ex = hingeTo ? d.from : d.to;
        const z = d.at + d.swing * w;
        el('path', { d: `M ${hx} ${d.at} L ${hx} ${z} A ${w} ${w} 0 0 ${(hingeTo ? 1 : 0) ^ (d.swing > 0 ? 0 : 1)} ${ex} ${d.at}`, class: 'door' }, g);
      } else {
        const hz = hingeTo ? d.to : d.from, ez = hingeTo ? d.from : d.to;
        const x = d.at + d.swing * w;
        el('path', { d: `M ${d.at} ${hz} L ${x} ${hz} A ${w} ${w} 0 0 ${(hingeTo ? 0 : 1) ^ (d.swing > 0 ? 0 : 1)} ${d.at} ${ez}`, class: 'door' }, g);
      }
    }
    // gallery void hint
    el('rect', { x: 0.1, y: 0.1, width: 8.8, height: 11.8, fill: 'none', stroke: 'rgba(242,238,232,0.16)', 'stroke-width': 0.03, 'stroke-dasharray': '0.25 0.2' }, g);

    // visitor marker
    this.me = el('g', {}, svg);
    el('path', { d: 'M 0 0 L -1.3 -2.6 A 2.9 2.9 0 0 1 1.3 -2.6 Z', class: 'cone' }, this.me);
    el('circle', { cx: 0, cy: 0, r: 0.26, class: 'me' }, this.me);
  }

  update(x, z, yaw) {
    this.me.setAttribute('transform', `translate(${x} ${z}) rotate(${(-yaw * 180) / Math.PI})`);
  }
}
