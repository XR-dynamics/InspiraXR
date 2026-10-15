import { setActiveLayout } from './active.js';

export const LAYOUTS = [
  { id: 'residence', name: 'The Glass Residence', blurb: 'Double-height villa' },
  { id: 'apartment', name: 'The Apartment', blurb: 'Two-bedroom apartment' },
];
const KEY = 'inspiraxr.layout';

/** ?home=apartment|residence wins, then the last choice, then the original residence. */
export function chosenLayoutId(params) {
  const q = params.get('home') || params.get('layout');
  if (LAYOUTS.some((l) => l.id === q)) return q;
  try { const s = localStorage.getItem(KEY); if (LAYOUTS.some((l) => l.id === s)) return s; } catch { /* storage blocked */ }
  return 'residence';
}

export function rememberLayout(id) { try { localStorage.setItem(KEY, id); } catch { /* storage blocked */ } }

/** Load a layout descriptor (apartment code is only fetched when it is chosen). */
export async function loadLayout(id) {
  const layout = id === 'apartment'
    ? (await import('./apartment/index.js')).apartment
    : (await import('./residence.js')).residence;
  setActiveLayout(layout);
  await layout.load();
  return layout;
}
