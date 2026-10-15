import * as THREE from 'three';
import { buildMaterials } from '../materials/library.js';
import { buildWorld, ZONES } from '../world/index.js';
import { H, ROOMS, VIEWS, SELECTOR, roomAt } from '../world/layout.js';
import { FloorPlan } from '../ui/plan.js';

/** The original double-height Glass Residence, wrapped as a layout descriptor. */
export const residence = {
  id: 'residence',
  title: 'The Glass Residence',
  subtitle: 'Double-height living &nbsp;·&nbsp; Two bedroom suites &nbsp;·&nbsp; Garden terrace &amp; pool',
  wholeName: 'the whole residence',
  storageKey: 'inspiraxr.customisation.v1',
  H, ROOMS, VIEWS, SELECTOR, ZONES, roomAt,
  ROOM_ZONE: { living: 'main', foyer: 'main', dining: 'main', kitchen: 'kitchen', hall: 'hall', master: 'master', masterBath: 'masterBath', bedroom: 'bedroom', bath: 'bath', terrace: 'outdoor' },
  ADAPT: {
    day: { main: 1, kitchen: 1.45, hall: 1.5, master: 1.3, masterBath: 1.25, bedroom: 1.4, bath: 1.45, outdoor: 0.78 },
    sunset: { main: 1, kitchen: 1.5, hall: 1.55, master: 1.35, masterBath: 1.3, bedroom: 1.45, bath: 1.5, outdoor: 0.85 },
    night: { main: 1, kitchen: 1.1, hall: 1.2, master: 1.15, masterBath: 1.1, bedroom: 1.15, bath: 1.15, outdoor: 1.25 },
    overcast: { main: 1, kitchen: 1.35, hall: 1.4, master: 1.25, masterBath: 1.2, bedroom: 1.3, bath: 1.35, outdoor: 0.9 },
    evening: { main: 1, kitchen: 1.3, hall: 1.4, master: 1.25, masterBath: 1.2, bedroom: 1.3, bath: 1.35, outdoor: 1.1 },
  },
  INTRO: [
    { pos: new THREE.Vector3(5.9, 1.42, 12.6), look: new THREE.Vector3(4.2, 1.85, 0.0), shift: 0.3 },
    { pos: new THREE.Vector3(6.6, 1.42, 11.0), look: new THREE.Vector3(3.2, 1.9, 0.0), shift: 0.3 },
  ],
  START: { pos: [6.0, 14.4], look: [4.6, 1.6, 4.0] },
  lightingConfig: {},
  outdoorRoom: 'terrace',
  sliderId: 'slider',
  /** Where the room selector walks to (a few rooms are reachable but not in the selector). */
  viewFor(key) {
    if (key === 'hall') return { pos: [17, 1.2], look: [29, 1.6, 1.2] };
    if (key === 'bath') return { pos: [27.6, -1.4], look: [28, 1.2, -6] };
    return VIEWS[key] || null;
  },
  lightLabels: { living: 'Living', dining: 'Dining', kitchen: 'Kitchen', hall: 'Hallway', master: 'Master bedroom', masterBath: 'Bathroom', bedroom: 'Bedroom', bath: 'Guest bath', foyer: 'Entrance', terrace: 'Terrace' },
  async load() {},
  buildMaterials(renderer, onProgress) { return buildMaterials(renderer, onProgress); },
  async buildWorld(args) { return buildWorld(args); },
  createPlan(svg, onSelect) { return new FloorPlan(svg, onSelect); },
};
