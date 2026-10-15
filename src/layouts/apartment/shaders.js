/*
 * Surface recipes for the apartment, written for the GPU texture baker (src/materials/texgen.js).
 * Each recipe provides mAlbedo / mHeight / mRough over a tileable uv in [0,1]; one texture covers
 * the "tile" length the plan gives for that material (the meshes' UVs are already in tile units).
 */

// Honed travertine floor: 2 x 2 tiles of 80 cm with cloudy tonal variation, long horizontal strata,
// elongated filled pores and a hairline grout.
export const TRAVERTINE = /* glsl */ `
vec2 tileId(vec2 uv) { return floor(uv * 2.0); }
float grout(vec2 uv) {
  vec2 f = fract(uv * 2.0);
  vec2 d = min(f, 1.0 - f);
  return 1.0 - smoothstep(0.0009, 0.0024, min(d.x, d.y));
}
float strata(vec2 uv, vec2 o) {
  float w = fbm(uv * vec2(1.0, 1.0) + o, vec2(2.0, 3.0), 4);
  return fbm(vec2(uv.x * 0.8 + w * 0.5, uv.y * 1.0) + o, vec2(3.0, 28.0), 5);
}
float pores(vec2 uv, vec2 o) {
  float p = fbm(uv + o, vec2(70.0, 14.0), 3) + 0.5 * fbm(uv + o * 1.3, vec2(150.0, 30.0), 2);
  return smoothstep(0.34, 0.5, p);
}
vec3 mAlbedo(vec2 uv) {
  vec2 id = tileId(uv);
  vec2 o = vec2(hash1(id), hash1(id + 5.1)) * 17.0;
  float t = hash1(id + 3.1);
  float cl = fbm(uv + o, vec2(4.0), 6);
  float st = strata(uv, o);
  float pr = pores(uv, o);
  vec3 base = mix(vec3(0.80, 0.735, 0.625), vec3(0.855, 0.795, 0.69), t);
  vec3 col = base * (1.0 + cl * 0.08);
  col = mix(col, col * vec3(0.84, 0.77, 0.66), smoothstep(0.1, 0.55, st) * 0.55);
  col = mix(col, col * vec3(1.05, 1.04, 1.02), smoothstep(-0.5, -0.1, st) * 0.5);
  col = mix(col, vec3(0.50, 0.42, 0.33), pr * 0.5);
  col = mix(col, vec3(0.50, 0.465, 0.41), grout(uv));
  return srgb(col);
}
float mHeight(vec2 uv) {
  vec2 id = tileId(uv);
  vec2 o = vec2(hash1(id), hash1(id + 5.1)) * 17.0;
  float lip = (hash1(id + 9.0) - 0.5) * 0.08;
  return 0.55 + lip + fbm(uv, vec2(220.0), 3) * 0.04 - pores(uv, o) * 0.28 - grout(uv) * 0.6;
}
float mRough(vec2 uv) {
  vec2 id = tileId(uv);
  vec2 o = vec2(hash1(id), hash1(id + 5.1)) * 17.0;
  return clamp(0.42 + fbm(uv + 3.7, vec2(3.0), 5) * 0.14 + pores(uv, o) * 0.25 + grout(uv) * 0.3, 0.2, 0.95);
}
`;

// Travertine cladding / soffits: long horizontal boards with stronger banding.
export const CLADDING = /* glsl */ `
float rowOf(vec2 uv) { return floor(uv.y * 6.0); }
float joint(vec2 uv) {
  float f = fract(uv.y * 6.0);
  float d = min(f, 1.0 - f);
  float r = rowOf(uv);
  float x = fract(uv.x * 2.0 + hash1(vec2(r, 4.0)));
  float dx = min(x, 1.0 - x) / 2.0;
  return max(1.0 - smoothstep(0.0008, 0.002, d / 6.0), (1.0 - smoothstep(0.0006, 0.0016, dx)));
}
vec3 mAlbedo(vec2 uv) {
  float r = rowOf(uv);
  float o = hash1(vec2(r, 1.0)) * 23.0;
  float band = fbm(vec2(uv.x * 0.7 + o, uv.y * 6.0), vec2(2.0, 24.0), 5);
  float cl = fbm(uv + o, vec2(3.0), 5);
  vec3 col = mix(vec3(0.83, 0.77, 0.66), vec3(0.74, 0.67, 0.55), clamp(band * 1.2 + 0.5, 0.0, 1.0));
  col *= 1.0 + cl * 0.06 + (hash1(vec2(r, 8.0)) - 0.5) * 0.06;
  col = mix(col, vec3(0.42, 0.37, 0.3), joint(uv) * 0.8);
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(160.0, 60.0), 3) * 0.08 - joint(uv) * 0.5; }
float mRough(vec2 uv) { return 0.62 + fbm(uv, vec2(5.0), 3) * 0.1 + joint(uv) * 0.2; }
`;

// Cream marble with warm gold-taupe veining (kitchen island, counters).
export const MARBLE_CREAM = /* glsl */ `
float vein1(vec2 uv) {
  float w = fbm(uv, vec2(2.0), 7);
  float w2 = fbm(uv + 7.7, vec2(3.0), 6);
  float a = vein(sin((uv.x * 1.0 + uv.y * 2.0 + w * 3.0) * PI * 2.0), 0.040);
  float b = vein(sin((uv.x * 3.0 - uv.y * 1.0 + w2 * 3.4) * PI * 2.0), 0.016) * 0.75;
  float c = vein(sin((uv.x * 7.0 + uv.y * 5.0 + w * 6.0) * PI), 0.03) * 0.28;
  return clamp(a + b + c, 0.0, 1.0);
}
vec3 mAlbedo(vec2 uv) {
  float cl = fbm(uv + 1.3, vec2(4.0), 7);
  float cl2 = fbm(uv + 8.1, vec2(8.0), 5);
  vec3 col = vec3(0.925, 0.895, 0.835) + cl * 0.045 + cl2 * 0.02;
  float v = vein1(uv);
  float warm = smoothstep(-0.25, 0.3, fbm(uv, vec2(3.0), 4));
  vec3 veinCol = mix(vec3(0.62, 0.55, 0.47), vec3(0.74, 0.58, 0.36), warm);
  col = mix(col, veinCol, v * 0.78);
  col *= 1.0 - smoothstep(0.55, 0.9, fbm(uv + 2.0, vec2(14.0), 3) + 0.5) * 0.03;
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(96.0), 3) * 0.015; }
float mRough(vec2 uv) { return 0.12 + fbm(uv + 3.0, vec2(6.0), 4) * 0.07 + vein1(uv) * 0.05; }
`;

// White marble with bold charcoal streaks (the small side tables).
export const MARBLE_STREAK = /* glsl */ `
float streak(vec2 uv) {
  float w = fbm(uv, vec2(2.0), 7);
  float a = vein(sin((uv.x * 2.0 + uv.y * 1.0 + w * 3.2) * PI * 2.0), 0.09);
  float b = vein(sin((uv.x * 4.0 - uv.y * 3.0 + w * 4.1) * PI * 2.0), 0.04) * 0.7;
  return clamp(a + b, 0.0, 1.0);
}
vec3 mAlbedo(vec2 uv) {
  float cl = fbm(uv + 1.3, vec2(5.0), 6);
  vec3 col = vec3(0.90, 0.9, 0.9) + cl * 0.04;
  col = mix(col, vec3(0.26, 0.27, 0.29), streak(uv) * (0.55 + 0.4 * smoothstep(-0.3, 0.3, fbm(uv, vec2(3.0), 4))));
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(96.0), 3) * 0.012; }
float mRough(vec2 uv) { return 0.1 + fbm(uv + 3.0, vec2(6.0), 4) * 0.06; }
`;

// Layered rosso / terracotta and grey marble for the shower wall.
export const MARBLE_ROSSO = /* glsl */ `
vec3 mAlbedo(vec2 uv) {
  float w = fbm(uv, vec2(2.0), 7) * 2.4;
  float w2 = fbm(uv + 3.3, vec2(3.0), 6) * 1.2;
  float s = uv.x * 0.9 + uv.y * 2.4 + w + w2;
  float band = sin(s * PI * 2.0 * 2.0) * 0.5 + 0.5;
  float fine = sin((s * 5.0 + fbm(uv + 9.0, vec2(6.0), 5) * 2.0) * PI * 2.0) * 0.5 + 0.5;
  vec3 rust = vec3(0.60, 0.29, 0.20);
  vec3 cream = vec3(0.85, 0.80, 0.73);
  vec3 grey = vec3(0.52, 0.52, 0.54);
  vec3 col = mix(grey, cream, smoothstep(0.25, 0.75, fbm(uv + 5.0, vec2(4.0), 5) + 0.5));
  col = mix(col, rust, smoothstep(0.52, 0.78, band) * (0.55 + 0.45 * fine));
  col = mix(col, rust * 0.7, smoothstep(0.82, 0.97, band) * 0.6);
  col *= 1.0 + fbm(uv, vec2(40.0), 3) * 0.05;
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(90.0), 3) * 0.015; }
float mRough(vec2 uv) { return 0.14 + fbm(uv + 3.0, vec2(6.0), 4) * 0.08; }
`;

// Dark blue-grey onyx marble with luminous white veins (bathroom floor).
export const ONYX = /* glsl */ `
vec3 mAlbedo(vec2 uv) {
  float cl = fbm(uv + 1.1, vec2(3.0), 7);
  float r = ridged(uv + 4.0, vec2(3.0), 7);
  vec3 col = mix(vec3(0.075, 0.105, 0.125), vec3(0.22, 0.27, 0.29), clamp(cl * 1.6 + 0.4, 0.0, 1.0));
  float w = fbm(uv, vec2(2.0), 6);
  float v = vein(sin((uv.x * 2.0 + uv.y * 1.0 + w * 3.4) * PI * 2.0), 0.05) + vein(sin((uv.x * 1.0 - uv.y * 3.0 + w * 3.0) * PI * 2.0), 0.03) * 0.7;
  col = mix(col, vec3(0.75, 0.80, 0.82), clamp(v, 0.0, 1.0) * 0.8);
  col += smoothstep(0.7, 1.0, r) * vec3(0.12, 0.14, 0.15);
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(80.0), 3) * 0.012; }
float mRough(vec2 uv) { return 0.08 + fbm(uv + 3.0, vec2(6.0), 4) * 0.06; }
`;

// Embossed relief tile wall: a 10 cm grid of graphic glyphs raised from a flat ground.
export const RELIEF = /* glsl */ `
const float CELLS = 12.0;
float ring(vec2 p, float r, float w) { return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.03, abs(length(p) - r)); }
float bar(vec2 p, vec2 c, vec2 h) { vec2 d = abs(p - c) - h; return 1.0 - smoothstep(0.0, 0.05, max(d.x, d.y)); }
float glyph(vec2 p, float k) {
  float a = abs(p.x), b = abs(p.y);
  if (k < 1.0) return ring(p, 0.5, 0.16);
  if (k < 2.0) return max(ring(p, 0.62, 0.12), ring(p, 0.3, 0.12));
  if (k < 3.0) return max(bar(p, vec2(0.0), vec2(0.62, 0.12)), bar(p, vec2(0.0), vec2(0.12, 0.62)));
  if (k < 4.0) return 1.0 - smoothstep(0.0, 0.05, abs(a + b - 0.62) - 0.07);
  if (k < 5.0) { float arc = ring(vec2(p.x, p.y + 0.15), 0.5, 0.14) * step(-0.15, p.y + 0.15); return max(arc, bar(p, vec2(0.0, -0.45), vec2(0.64, 0.07))); }
  if (k < 6.0) { float s = 0.0; for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) s = max(s, 1.0 - smoothstep(0.07, 0.11, length(p - vec2(float(i), float(j)) * 0.34))); return s; }
  if (k < 7.0) { float s = 0.0; for (int i = 0; i < 4; i++) s = max(s, bar(p, vec2(0.0, -0.54 + float(i) * 0.36), vec2(0.6, 0.075))); return s; }
  if (k < 8.0) { float sq = 1.0 - smoothstep(0.0, 0.05, abs(max(a, b) - 0.56) - 0.07); float dg = 1.0 - smoothstep(0.0, 0.05, abs(p.x - p.y) - 0.07); return max(sq, dg * step(max(a, b), 0.6)); }
  if (k < 9.0) { float z = abs(fract(p.x * 1.7 + 0.5) - 0.5) * 2.0; return 1.0 - smoothstep(0.0, 0.07, abs(p.y - (z - 0.5) * 0.7) - 0.08); }
  if (k < 10.0) return (1.0 - smoothstep(0.0, 0.05, abs(a - b) - 0.08)) * step(max(a, b), 0.62);
  if (k < 11.0) { float d = length(p); float m = 1.0 - smoothstep(0.52, 0.56, d); float cut = 1.0 - smoothstep(0.52, 0.56, length(p - vec2(0.24, 0.0))); return clamp(m - cut, 0.0, 1.0); }
  return max(bar(p, vec2(0.0), vec2(0.6, 0.6)) - bar(p, vec2(0.0), vec2(0.48, 0.48)), 1.0 - smoothstep(0.1, 0.15, length(p)));
}
float relief(vec2 uv) {
  vec2 g = uv * CELLS;
  vec2 id = floor(g);
  vec2 p = (fract(g) - 0.5) * 2.0;
  float k = floor(hash1(id) * 12.0);
  float gl = glyph(p * 1.0, k);
  float edge = 1.0 - smoothstep(0.84, 0.96, max(abs(p.x), abs(p.y)));
  return gl * edge;
}
vec3 mAlbedo(vec2 uv) {
  float r = relief(uv);
  float n = fbm(uv, vec2(5.0), 5);
  vec3 ground = vec3(0.29, 0.355, 0.16) * (1.0 + n * 0.06);
  vec3 col = ground * mix(0.96, 1.07, r);
  vec2 g = fract(uv * CELLS);
  float seam = 1.0 - smoothstep(0.004, 0.012, min(min(g.x, 1.0 - g.x), min(g.y, 1.0 - g.y)));
  col = mix(col, ground * 0.62, seam * 0.7);
  return srgb(col);
}
float mHeight(vec2 uv) {
  vec2 g = fract(uv * CELLS);
  float seam = 1.0 - smoothstep(0.004, 0.012, min(min(g.x, 1.0 - g.x), min(g.y, 1.0 - g.y)));
  return 0.35 + relief(uv) * 0.5 + fbm(uv, vec2(180.0), 2) * 0.04 - seam * 0.2;
}
float mRough(vec2 uv) { return 0.78 + fbm(uv, vec2(30.0), 3) * 0.1; }
`;

// Rust wallpaper with a cream and blush ornamental print: blossoms, leaves and birds on scrolling stems.
export const WALLPAPER = /* glsl */ `
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float sdEll(vec2 p, vec2 r) { return (length(p / r) - 1.0) * min(r.x, r.y); }
float cover(float d, float aa) { return 1.0 - smoothstep(-aa, aa, d); }
vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
// five petal blossom
float blossom(vec2 p, float r) {
  float a = atan(p.y, p.x), d = length(p);
  float petals = r * (0.62 + 0.38 * cos(a * 5.0));
  return d - petals;
}
// a stylised crane: body, long curved neck, head, beak, wing, tail
vec4 crane(vec2 p, float s) {
  p /= s;
  float body = sdEll(p - vec2(0.0, 0.0), vec2(0.36, 0.17));
  float neck = sdSeg(p, vec2(0.28, 0.05), vec2(0.5, 0.34)) - 0.032;
  neck = min(neck, sdSeg(p, vec2(0.5, 0.34), vec2(0.43, 0.56)) - 0.026);
  float head = length(p - vec2(0.44, 0.58)) - 0.05;
  float beak = sdSeg(p, vec2(0.47, 0.585), vec2(0.64, 0.55)) - 0.012;
  float wing = sdEll(rot(p - vec2(-0.04, 0.06), 0.35), vec2(0.34, 0.1));
  float tail = sdSeg(p, vec2(-0.3, 0.0), vec2(-0.62, -0.1)) - 0.045;
  float leg = min(sdSeg(p, vec2(0.0, -0.12), vec2(-0.06, -0.52)), sdSeg(p, vec2(0.08, -0.12), vec2(0.12, -0.5))) - 0.008;
  float shape = min(min(min(body, neck), min(head, tail)), min(wing, 1.0));
  float ink = min(wing, min(beak, leg));
  return vec4(shape * s, ink * s, beak * s, wing * s);
}
vec3 mAlbedo(vec2 uv) {
  float mott = fbm(uv, vec2(4.0), 6);
  vec3 col = mix(vec3(0.52, 0.2, 0.11), vec3(0.62, 0.27, 0.15), clamp(mott * 1.4 + 0.5, 0.0, 1.0));
  col *= 1.0 + fbm(uv, vec2(60.0), 3) * 0.05;
  // scrolling stems: a gentle sine ground pattern in a slightly deeper rust
  float stem = abs(sin((uv.x * 2.0 + sin(uv.y * 2.0 * PI * 2.0) * 0.12) * PI * 2.0));
  col = mix(col, vec3(0.43, 0.15, 0.085), (1.0 - smoothstep(0.0, 0.04, stem)) * 0.5);
  vec2 g = uv * 2.0;
  vec2 id = floor(g);
  vec2 p = fract(g) - 0.5;
  float h = hash1(id + 2.0);
  // blossom cluster
  vec2 bp = p - vec2(-0.2 + h * 0.1, -0.12);
  float bl = blossom(bp, 0.11 + h * 0.03);
  vec2 bp2 = p - vec2(0.22, 0.2 - h * 0.08);
  float bl2 = blossom(rot(bp2, 0.6), 0.08);
  float stemLine = sdSeg(p, vec2(-0.2, -0.12), vec2(0.22, 0.2)) - 0.006;
  float leaf1 = sdEll(rot(p - vec2(0.0, 0.02), 0.7), vec2(0.075, 0.028));
  float leaf2 = sdEll(rot(p - vec2(-0.02, -0.1), -0.5), vec2(0.07, 0.025));
  vec3 cream = vec3(0.93, 0.85, 0.77), blush = vec3(0.86, 0.6, 0.52), leafc = vec3(0.7, 0.55, 0.38);
  col = mix(col, leafc, cover(min(leaf1, leaf2), 0.004) * 0.85);
  col = mix(col, vec3(0.5, 0.22, 0.12), cover(stemLine, 0.003));
  col = mix(col, blush, cover(min(bl, bl2), 0.004) * 0.95);
  col = mix(col, cream, cover(min(bl + 0.035, bl2 + 0.025), 0.004) * 0.8);
  col = mix(col, vec3(0.95, 0.75, 0.35), cover(length(bp) - 0.012, 0.003));
  // a crane on alternating cells
  float flip = mix(1.0, -1.0, step(0.5, hash1(id + 7.0)));
  vec2 cp = (p - vec2(0.1, -0.22)) * vec2(flip, 1.0);
  vec4 cr = crane(cp, 0.26);
  col = mix(col, cream, cover(cr.x, 0.003));
  col = mix(col, vec3(0.35, 0.2, 0.18), cover(cr.w, 0.003) * 0.35);
  col = mix(col, vec3(0.18, 0.09, 0.07), cover(cr.z, 0.003));
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(220.0), 2) * 0.05; }
float mRough(vec2 uv) { return 0.62 + fbm(uv, vec2(40.0), 3) * 0.08; }
`;

// Plain-weave cane / grasscloth: warp and weft strands over and under.
export const CANE = /* glsl */ `
vec3 mAlbedo(vec2 uv) {
  vec2 p = uv * 24.0;
  vec2 c = floor(p), f = fract(p);
  float over = mod(c.x + c.y, 2.0);
  float strand = mix(sin(f.y * PI), sin(f.x * PI), over);
  float fib = fbm(vec2(uv.x * mix(1.0, 24.0, over) * 3.0, uv.y * mix(24.0, 1.0, over) * 3.0), vec2(24.0, 24.0), 3);
  vec3 straw = mix(vec3(0.66, 0.5, 0.31), vec3(0.78, 0.63, 0.42), clamp(strand * 0.7 + fib * 0.5, 0.0, 1.0));
  straw *= 0.78 + 0.22 * strand;
  float gap = 1.0 - smoothstep(0.02, 0.18, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
  straw = mix(straw, vec3(0.21, 0.14, 0.09), gap * 0.7);
  return srgb(straw);
}
float mHeight(vec2 uv) {
  vec2 p = uv * 24.0;
  vec2 c = floor(p), f = fract(p);
  float over = mod(c.x + c.y, 2.0);
  return mix(sin(f.y * PI), sin(f.x * PI), over) * 0.6 + fbm(uv, vec2(240.0), 2) * 0.05;
}
float mRough(vec2 uv) { return 0.55 + fbm(uv, vec2(50.0), 3) * 0.1; }
`;

// Fluted walnut: 25 mm half-round ribs over straight walnut grain.
export const FLUTED_WALNUT = /* glsl */ `
float rib(vec2 uv) { return fract(uv.x * 48.0); }
vec3 mAlbedo(vec2 uv) {
  float f = rib(uv);
  float prof = sqrt(max(0.0, 1.0 - pow(2.0 * f - 1.0, 2.0)));
  float id = floor(uv.x * 48.0);
  float o = hash1(vec2(id, 2.0)) * 31.0;
  float grain = fbm(vec2(uv.x * 4.0 + o, uv.y) , vec2(8.0, 3.0), 4);
  float line = pow(abs(sin((uv.x * 48.0 * 1.7 + grain * 6.0 + o) * PI)), 2.5);
  vec3 col = mix(vec3(0.33, 0.215, 0.135), vec3(0.2, 0.12, 0.07), clamp(line * 0.7 + grain * 0.6 + 0.2, 0.0, 1.0));
  col *= 0.72 + 0.34 * prof;                                       // rounded ribs catch more light than the valleys
  col *= 1.0 + (hash1(vec2(id, 5.0)) - 0.5) * 0.08;
  return srgb(col);
}
float mHeight(vec2 uv) { float f = rib(uv); return sqrt(max(0.0, 1.0 - pow(2.0 * f - 1.0, 2.0))) + fbm(uv, vec2(300.0, 20.0), 2) * 0.02; }
float mRough(vec2 uv) { return 0.36 + fbm(uv, vec2(6.0), 3) * 0.1; }
`;

// Warm walnut veneer with strong cathedral figure (doors, wardrobes, table top).
export const WALNUT_VENEER = /* glsl */ `
float board(vec2 uv) { return floor(uv.x * 3.0); }
float seam(vec2 uv) { float f = fract(uv.x * 3.0); float d = min(f, 1.0 - f); return 1.0 - smoothstep(0.0012, 0.0034, d); }
float grain(vec2 uv) {
  float b = board(uv);
  float o = hash1(vec2(b, 3.0)) * 50.0;
  float lx = fract(uv.x * 3.0);
  lx = mix(lx, 1.0 - lx, step(0.5, hash1(vec2(b, 9.0))));
  float warp = fbm(uv + o, vec2(2.0, 2.0), 5) * 2.4;
  float figure = fbm(vec2(uv.x * 3.0, uv.y) + o * 0.3, vec2(3.0, 3.0), 4);
  float cath = abs(lx - 0.5) * 2.0;
  return lx * 20.0 + warp * 1.4 + figure * 1.1 + cath * cath * 3.2 * sin(uv.y * PI * 4.0 + o) + o;
}
vec3 mAlbedo(vec2 uv) {
  float b = board(uv);
  float r = grain(uv);
  float line = pow(abs(sin(r * PI)), 3.0) * 0.85;
  float fine = fbm(vec2(uv.x * 3.0, uv.y), vec2(256.0, 8.0), 3);
  float pores = smoothstep(0.35, 0.6, fbm(uv, vec2(300.0, 40.0), 2) + 0.5);
  vec3 light = vec3(0.58, 0.40, 0.255);
  vec3 dark = vec3(0.32, 0.205, 0.12);
  float tone = hash1(vec2(b, 1.0)) * 0.14;
  vec3 col = mix(light, dark, clamp(line * 0.75 + fine * 0.5 + 0.15 + tone, 0.0, 1.0));
  col *= 1.0 - pores * 0.1;
  col *= 1.0 + fbm(uv, vec2(2.0, 1.0), 3) * 0.1;
  col = mix(col, vec3(0.07, 0.045, 0.03), seam(uv) * 0.9);
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(300.0, 40.0), 2) * 0.12 + sin(grain(uv) * PI * 2.0) * 0.018 - seam(uv) * 0.6; }
float mRough(vec2 uv) {
  float pores = smoothstep(0.35, 0.6, fbm(uv, vec2(300.0, 40.0), 2) + 0.5);
  return 0.3 + pores * 0.16 + fbm(uv + 2.0, vec2(4.0), 3) * 0.07 + seam(uv) * 0.35;
}
`;

// Cream and taupe striped throw woven over a linen ground.
export const STRIPE = /* glsl */ `
vec3 mAlbedo(vec2 uv) {
  float s = smoothstep(0.42, 0.46, abs(fract(uv.x * 4.0) - 0.5)) ;
  vec2 p = uv * 80.0;
  vec2 c = floor(p), f = fract(p);
  float chk = mod(c.x + c.y, 2.0);
  float w = mix(sin(f.x * PI), sin(f.y * PI), chk);
  float slub = fbm(uv, vec2(6.0, 120.0), 3);
  vec3 cream = vec3(0.86, 0.82, 0.75), taupe = vec3(0.45, 0.33, 0.31);
  vec3 col = mix(cream, taupe, step(0.5, fract(uv.x * 4.0)) * step(fract(uv.x * 4.0), 0.72));
  col *= 0.86 + 0.1 * w + slub * 0.1;
  return srgb(col);
}
float mHeight(vec2 uv) { vec2 p = uv * 80.0; vec2 c = floor(p), f = fract(p); float chk = mod(c.x + c.y, 2.0); return mix(sin(f.x * PI), sin(f.y * PI), chk) * 0.5 + fbm(uv, vec2(6.0, 120.0), 2) * 0.3; }
float mRough(vec2 uv) { return 0.92; }
`;

// Gravel: pale rounded chips of many sizes.
export const GRAVEL = /* glsl */ `
float chips(vec2 uv, float f) { return worley(uv, vec2(f)); }
vec3 mAlbedo(vec2 uv) {
  float a = chips(uv, 64.0), b = chips(uv + 0.31, 96.0), c = chips(uv + 0.62, 150.0);
  float v = min(min(a, b * 0.9), c * 0.8);
  float tone = hash1(floor(uv * 150.0)) * 0.3 + hash1(floor(uv * 64.0) + 3.0) * 0.4;
  vec3 col = mix(vec3(0.44, 0.42, 0.39), vec3(0.72, 0.69, 0.63), clamp(tone + 0.2, 0.0, 1.0));
  col *= 0.55 + 0.7 * smoothstep(0.0, 0.5, v);
  return srgb(col);
}
float mHeight(vec2 uv) {
  float a = chips(uv, 64.0), b = chips(uv + 0.31, 96.0);
  return 1.0 - min(a, b) * 2.0 + fbm(uv, vec2(120.0), 2) * 0.2;
}
float mRough(vec2 uv) { return 0.85; }
`;

// Sea-cliff rock: horizontal strata, fractures and weathering streaks.
export const ROCK = /* glsl */ `
vec3 mAlbedo(vec2 uv) {
  float w = fbm(uv, vec2(3.0), 6);
  float strata = fbm(vec2(uv.x * 0.5 + w * 0.2, uv.y), vec2(2.0, 20.0), 5);
  float cr = ridged(uv + 5.0, vec2(5.0), 6);
  vec3 col = mix(vec3(0.20, 0.17, 0.14), vec3(0.45, 0.39, 0.32), clamp(strata * 1.2 + w * 0.7 + 0.45, 0.0, 1.0));
  col *= 0.7 + 0.5 * smoothstep(0.1, 0.8, cr);
  col = mix(col, vec3(0.08, 0.075, 0.07), smoothstep(0.8, 0.97, ridged(uv + 9.0, vec2(9.0), 4)) * 0.6);
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + ridged(uv, vec2(6.0), 6) * 0.7 + fbm(uv, vec2(60.0), 3) * 0.12; }
float mRough(vec2 uv) { return 0.9; }
`;
