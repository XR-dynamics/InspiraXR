/* Reflection-probe zones of the apartment (web coordinates: x east, z south). */
export const ZONES = {
  main: { pos: [5.4, 1.6, -3.4], size: 256, rooms: ['living', 'dining', 'kitchen', 'entry'], box: [[0.1, 0, -8.45], [10.9, 3.3, -0.1]] },
  bedroom: { pos: [2.4, 1.6, -6.3], size: 128, rooms: ['bedroom'], box: [[0.2, 0, -8.45], [4.55, 3.3, -4.1]] },
  study: { pos: [5.9, 1.6, -6.9], size: 128, rooms: ['study'], box: [[4.55, 0, -8.45], [7.2, 3.3, -5.4]] },
  bath: { pos: [1.35, 1.6, -2.6], size: 128, rooms: ['bath'], box: [[0.2, 0, -4.1], [2.55, 3.3, -1.05]] },
  outdoor: { pos: [12.3, 1.6, -3.3], size: 128, rooms: ['terrace'] },
};
export const ROOM_ZONE = { living: 'main', dining: 'main', kitchen: 'main', entry: 'main', bedroom: 'bedroom', study: 'study', bath: 'bath', terrace: 'outdoor' };
