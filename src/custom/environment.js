/** The five selectable lighting + background presets (names map onto `PRESETS` in world/lighting.js). */
export const ENVIRONMENTS = [
  { id: 'day', name: 'Bright Daylight', swatch: ['#8fbbea', '#dbe9f7', '#f6f1e6'] },
  { id: 'sunset', name: 'Warm Golden Hour', swatch: ['#6f86b8', '#f0a468', '#ffdca0'] },
  { id: 'overcast', name: 'Overcast Soft Light', swatch: ['#88919c', '#bcc4cd', '#e4e8ec'] },
  { id: 'evening', name: 'Evening Interior', swatch: ['#18244a', '#5b4d80', '#eb9a5c'] },
  { id: 'night', name: 'Night Interior', swatch: ['#04070d', '#101a30', '#d9a35e'] },
];

/** The environment the residence ships with; "Restore original" returns here. */
export const ORIGINAL_ENVIRONMENT = 'sunset';
