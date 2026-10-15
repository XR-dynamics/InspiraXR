import * as THREE from 'three';
import { roomAt } from './data.js';

/*
 * The plan lists 86 lights. A real-time renderer cannot afford 86 dynamic lights, so the plan's lights
 * are grouped by room and merged by position into a handful of real lights per room (their lumens add
 * up). Every visible fixture - downlights, cove strips, pendants, lamps, mirror halos - is also an
 * emissive surface that follows its room's switch, which is what the eye actually reads.
 */

/** Lumens -> scene intensity (candela-like units; calibrated against the sun at the exposure used). */
const PER_LUMEN = 0.012;
// real lights allowed per room
const BUDGET = { living: 3, dining: 2, kitchen: 2, entry: 2, bedroom: 2, study: 2, bath: 2, terrace: 1 };

/** Colour of a black body at `k` Kelvin (Tanner Helland's approximation), as a THREE.Color in linear space. */
export function kelvin(k) {
  const t = k / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v) => Math.max(0, Math.min(255, v)) / 255;
  return new THREE.Color().setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
}

function cluster(items, k) {
  if (items.length <= k) return items.map((i) => [i]);
  // farthest-point seeding, then a few k-means passes weighted by lumens
  const seeds = [items.reduce((a, b) => (b.lm > a.lm ? b : a))];
  while (seeds.length < k) {
    let best = null, bd = -1;
    for (const it of items) {
      const d = Math.min(...seeds.map((s) => s.pos.distanceToSquared(it.pos)));
      if (d > bd) { bd = d; best = it; }
    }
    seeds.push(best);
  }
  let centres = seeds.map((s) => s.pos.clone());
  let groups = [];
  for (let pass = 0; pass < 6; pass++) {
    groups = centres.map(() => []);
    for (const it of items) {
      let bi = 0, bd = Infinity;
      centres.forEach((c, i) => { const d = c.distanceToSquared(it.pos); if (d < bd) { bd = d; bi = i; } });
      groups[bi].push(it);
    }
    centres = groups.map((g, i) => {
      if (!g.length) return centres[i];
      const c = new THREE.Vector3(); let w = 0;
      for (const it of g) { c.addScaledVector(it.pos, it.lm); w += it.lm; }
      return c.multiplyScalar(1 / w);
    });
  }
  return groups.filter((g) => g.length);
}

export function buildLights(ctx, lights) {
  const { lighting } = ctx;
  const byRoom = new Map();
  for (const L of lights) {
    const pos = new THREE.Vector3(L.loc[0], L.loc[2], -L.loc[1]);
    const room = /^Terrace/.test(L.label) || /_Terrace/.test(L.label) ? 'terrace' : roomAt(pos.x, pos.z) || 'terrace';
    if (!byRoom.has(room)) byRoom.set(room, []);
    byRoom.get(room).push({ pos, lm: L.lumens, kelvin: L.kelvin, radius: (L.radius || 400) / 100, label: L.label });
  }
  const made = [];
  for (const [room, items] of byRoom) {
    lighting.room(room);
    for (const group of cluster(items, BUDGET[room] || 2)) {
      let lm = 0, k = 0, r = 0;
      const c = new THREE.Vector3();
      for (const it of group) { lm += it.lm; k += it.kelvin * it.lm; r = Math.max(r, it.radius); c.addScaledVector(it.pos, it.lm); }
      c.multiplyScalar(1 / lm); k /= lm;
      // lights hug the ceiling in the plan; pull the point source a little into the room so walls are not blown out
      const light = new THREE.PointLight(kelvin(k), 0, Math.max(r * 1.6, 4), 2);
      light.position.copy(c);
      lighting.addLight(room, light, lm * PER_LUMEN);
      made.push({ room, lm, n: group.length });
    }
  }
  return made;
}
