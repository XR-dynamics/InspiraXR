/*
 * Tunable behaviour for wall targeting and furniture editing.
 * `?wallRange=2.2` in the URL overrides the proximity distance for quick experiments.
 */
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

export const CUSTOMISE = {
  /** A wall can be customised when it is hit by the view/controller ray within this many metres of the viewer. */
  proximity: Number(q.get('wallRange')) || 1.5,
  /** Ignore repeated activations (trigger bounce, double click) for this long. */
  cooldownMs: 350,
  /** Furniture editing. */
  gridSnap: 0.25,
  angleSnap: Math.PI / 12,
  rotateStep: Math.PI / 12,
  nudge: 0.1,
};

/** Curated wall colours (sRGB hex). They multiply the existing plaster maps, so grain and relief stay. */
export const WALL_SWATCHES = [
  { id: 'chalk', label: 'Chalk', color: '#f1ede6' },
  { id: 'linen', label: 'Linen', color: '#e2d9c8' },
  { id: 'sand', label: 'Sand', color: '#d4c2a2' },
  { id: 'greige', label: 'Greige', color: '#bdb3a5' },
  { id: 'blush', label: 'Blush', color: '#dcb9ab' },
  { id: 'terracotta', label: 'Terracotta', color: '#b8694c' },
  { id: 'sage', label: 'Sage', color: '#a3ae98' },
  { id: 'olive', label: 'Olive', color: '#7b7d56' },
  { id: 'mist', label: 'Mist Blue', color: '#9eafba' },
  { id: 'slate', label: 'Slate', color: '#5f6c78' },
  { id: 'navy', label: 'Midnight', color: '#2f3b52' },
  { id: 'charcoal', label: 'Charcoal', color: '#3b3b3e' },
];
