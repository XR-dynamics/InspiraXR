import * as THREE from 'three';
import { H, ROOMS, roomAt, loadPack } from './data.js';
import { ZONES, ROOM_ZONE } from './zones.js';
import { buildApartmentMaterials } from './materials.js';
import { buildApartmentWorld } from './world.js';
import { ApartmentPlan } from './plan.js';

let pack = null;

/** The plan-faithful apartment: living / dining / kitchen open plan, bedroom, study, bathroom and a terrace above the sea. */
export const apartment = {
  id: 'apartment',
  title: 'The Apartment',
  subtitle: 'Open-plan living &nbsp;·&nbsp; Bedroom &amp; study &nbsp;·&nbsp; Terrace above the sea',
  wholeName: 'the whole apartment',
  storageKey: 'inspiraxr.customisation.apartment.v1',
  H, ROOMS, roomAt, ZONES, ROOM_ZONE,
  VIEWS: {
    living: { pos: [10.0, -3.2], look: [7.4, 1.0, -6.8] },
    dining: { pos: [10.0, -4.2], look: [6.3, 1.0, -3.0] },
    kitchen: { pos: [9.9, -1.2], look: [5.5, 1.3, -0.7] },
    entry: { pos: [3.1, -1.3], look: [3.9, 1.3, -3.6] },
    bedroom: { pos: [3.9, -4.55], look: [1.8, 1.0, -7.9] },
    study: { pos: [6.6, -5.9], look: [5.6, 1.1, -7.8] },
    bath: { pos: [2.1, -3.7], look: [0.9, 1.0, -1.4] },
    terrace: { pos: [11.7, -2.4], look: [13.6, 1.1, -3.6] },
  },
  SELECTOR: [['living', 'Living Room'], ['kitchen', 'Kitchen'], ['dining', 'Dining'], ['entry', 'Entrance'], ['bedroom', 'Bedroom'], ['study', 'Study'], ['bath', 'Bathroom'], ['terrace', 'Terrace']],
  ADAPT: {
    day: { main: 1, bedroom: 1.35, study: 1.3, bath: 1.3, outdoor: 0.72 },
    sunset: { main: 1, bedroom: 1.4, study: 1.35, bath: 1.35, outdoor: 0.8 },
    night: { main: 1, bedroom: 1.15, study: 1.15, bath: 1.15, outdoor: 1.25 },
    overcast: { main: 1, bedroom: 1.25, study: 1.2, bath: 1.25, outdoor: 0.85 },
    evening: { main: 1, bedroom: 1.25, study: 1.2, bath: 1.25, outdoor: 1.1 },
  },
  INTRO: [
    { pos: new THREE.Vector3(10.2, 1.45, -1.2), look: new THREE.Vector3(5.8, 1.9, -7.2), shift: 0.3 },
    { pos: new THREE.Vector3(10.0, 1.45, -3.4), look: new THREE.Vector3(5.6, 1.9, -7.4), shift: 0.3 },
  ],
  START: { pos: [3.1, -1.5], look: [3.1, 1.5, -6.0] },
  // the sun is turned so that the terrace and the sliding doors face the light
  defaultEnvironment: 'day',
  lightingConfig: { exposureGain: 1.75, sunYaw: 2.08, sunTarget: [6, 0, -4], shadowExtent: 11, shadowFar: 160 },
  outdoorRoom: 'terrace',
  sliderId: 'slider',
  lightLabels: { living: 'Living', dining: 'Dining', kitchen: 'Kitchen', entry: 'Entrance', bedroom: 'Bedroom', study: 'Study', bath: 'Bathroom', terrace: 'Terrace' },
  viewFor(key) { return this.VIEWS[key] || null; },
  async load() {
    const base = `${import.meta.env.BASE_URL}apartment/`;
    pack = await loadPack(base);
    pack.sofa = await loadPack(`${base}models/`, 'sofa');
    pack.furn = await loadPack(`${base}models/`, 'furniture');
  },
  buildMaterials(renderer, onProgress) { return buildApartmentMaterials(renderer, pack.json.materials, onProgress); },   // async: photographs are fetched
  buildWorld(args) { return buildApartmentWorld({ ...args, pack }); },
  createPlan(svg, onSelect) { return new ApartmentPlan(svg, onSelect, pack.json.plan ? pack.json : { plan: pack.json.plan }); },
};
