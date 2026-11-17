/*
 * One place to tune the look. Each time-of-day preset has its own exposure, sun, ambient fill, reflection
 * strength, bloom, ambient occlusion and sky brightness; Lighting interpolates them during the crossfade.
 * Layouts opt in with `lightingConfig.look` (the Glass Residence does; the apartment keeps its own tuning).
 */
export const LOOK = {
  quality: 'high',            // 'high' (desktop) or 'low' (phones/tablets); set by main.js from ?quality= and the device
  fade: 3.0,                  // seconds for a Day / Sunset / Night crossfade (sky, sun, exposure and room lights together)
  hdri: {                     // replaceable sky photographs (equirectangular .hdr in public/hdri/); missing files fall back to the procedural sky
    day: 'hdri/day.hdr',
    sunset: 'hdri/sunset.hdr',
    night: 'hdri/night.hdr',
  },
  modes: {
    // exposure, sun, ambient fill (hemi), probe reflections (env), bloom, AO, sky brightness,
    // mirror = glossy floor reflection strength, glow = multiplier on lamps, coves and LED strips
    day:      { exposure: 0.66, sunIntensity: 3.6, hemi: 0.5, env: 1.0, bloom: 0.16, ao: 0.9, sky: 1.0, mirror: 0.55, glow: 1.0 },
    sunset:   { exposure: 0.7, sunIntensity: 3.9, hemi: 0.4, env: 0.95, bloom: 0.42, ao: 0.9, sky: 1.0, mirror: 0.65, glow: 1.7 },
    night:    { exposure: 0.8, sunIntensity: 0.05, hemi: 0.12, env: 0.75, bloom: 0.7, ao: 0.8, sky: 1.0, mirror: 0.8, glow: 2.0 },
    overcast: { exposure: 0.8, hemi: 0.9, bloom: 0.14, ao: 0.9, sky: 1.0, mirror: 0.45, glow: 1.0 },
    evening:  { exposure: 0.84, hemi: 0.3, bloom: 0.6, ao: 0.8, sky: 1.0, mirror: 0.7, glow: 1.8 },
  },
  // warm bounce instead of a navy fill: sky colour above, sun-lit floor colour below (sRGB hex)
  fill: {
    day: { sky: 0xe8eef6, ground: 0xd8c6ad, tint: [1.0, 1.0, 1.0] },
    sunset: { sky: 0xe2d8d0, ground: 0xd9b48a, tint: [1.02, 1.0, 0.97] },
    night: { sky: 0x3a4058, ground: 0x2c2219, tint: [1.02, 1.0, 0.97] },
    overcast: { sky: 0xe4e8ee, ground: 0xd2c8bb, tint: [1.0, 1.0, 1.0] },
    evening: { sky: 0x707aa0, ground: 0x4a3c30, tint: [1.02, 1.0, 0.98] },
  },
  qualityPresets: {
    high: { ao: true, smaa: true, bloom: true, shadowMap: 4096, floorReflections: true },
    low: { ao: false, smaa: false, bloom: true, shadowMap: 2048, floorReflections: false },
  },
};
