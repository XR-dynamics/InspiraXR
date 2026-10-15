import * as THREE from 'three';

/*
 * Photographic textures (the supplied wallpapers and moodboard material photos) and the maps that make
 * them behave like real surfaces: a normal map and a roughness map derived from the photograph itself.
 */

const BASE = () => `${import.meta.env.BASE_URL}apartment/tex/`;
const loader = new THREE.TextureLoader();

/** Load a photo as an sRGB colour texture. `mirror` repeats it mirrored (hides any residual seam). */
export async function loadPhoto(file, { mirror = false, anisotropy = 8 } = {}) {
  const tex = await loader.loadAsync(BASE() + file);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = mirror ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/**
 * Normal and roughness maps derived from a photograph's luminance. Bright detail reads as raised.
 * strength: normal intensity; rough: [min, max] roughness mapped from dark -> bright (inverted when `flip`).
 */
export function deriveMaps(tex, { strength = 2, rough = [0.6, 0.8], flip = false, size = 1024, blur = 1 } = {}) {
  const img = tex.image;
  const w = Math.min(size, img.width), h = Math.max(1, Math.round((w * img.height) / img.width));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, w, h);
  const src = cx.getImageData(0, 0, w, h).data;
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2]) / 255;
  // light blur (box) so the normal map follows the weave / emboss rather than the JPEG noise
  const B = new Float32Array(w * h);
  for (let pass = 0; pass < blur; pass++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += L[((y + dy + h) % h) * w + ((x + dx + w) % w)];
      B[y * w + x] = s / 9;
    }
    L.set(B);
  }
  const n = cx.createImageData(w, h), r = cx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xl = L[y * w + ((x - 1 + w) % w)], xr = L[y * w + ((x + 1) % w)];
    const yu = L[((y - 1 + h) % h) * w + x], yd = L[((y + 1) % h) * w + x];
    let nx = (xl - xr) * strength, ny = (yd - yu) * strength;
    const nz = 1, len = Math.hypot(nx, ny, nz);
    nx /= len; ny /= len;
    const i = (y * w + x) * 4;
    n.data[i] = (nx * 0.5 + 0.5) * 255; n.data[i + 1] = (ny * 0.5 + 0.5) * 255; n.data[i + 2] = (nz / len * 0.5 + 0.5) * 255; n.data[i + 3] = 255;
    const l = flip ? 1 - L[y * w + x] : L[y * w + x];
    const rv = rough[0] + (rough[1] - rough[0]) * l;
    r.data[i] = 255; r.data[i + 1] = Math.max(5, Math.min(255, rv * 255)); r.data[i + 2] = 0; r.data[i + 3] = 255;
  }
  const make = (data) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').putImageData(data, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.anisotropy = tex.anisotropy;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return { normal: make(n), orm: make(r) };
}

/** Repeat so that one image covers (w x h) metres on a surface whose UVs advance 1 per `tile` metres. */
export function fit(textures, tile, w, h) {
  for (const t of textures) { if (t) t.repeat.set(tile / w, tile / h); }
}
