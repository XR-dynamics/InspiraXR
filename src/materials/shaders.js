/*
 * Procedural surface definitions. Each one implements:
 *   vec3  mAlbedo(vec2 uv)  – linear albedo
 *   float mHeight(vec2 uv)  – height field (normal map is derived from it)
 *   float mRough(vec2 uv)   – roughness
 * All patterns are tileable over uv in [0,1].
 */

// Large-format honed limestone porcelain, 1200 x 1200 mm, 2x2 tiles per texture.
export const STONE_FLOOR = /* glsl */ `
vec2 tileId(vec2 uv) { return floor(uv * 2.0); }
float grout(vec2 uv) {
  vec2 f = fract(uv * 2.0);
  vec2 d = min(f, 1.0 - f);
  float w = 0.0011;
  return 1.0 - smoothstep(w * 0.6, w * 1.6, min(d.x, d.y));
}
float cloud(vec2 uv) {
  vec2 id = tileId(uv);
  vec2 o = vec2(hash1(id), hash1(id + 7.3)) * 13.0;
  return fbm(uv + o, vec2(5.0), 7);
}
vec3 mAlbedo(vec2 uv) {
  vec2 id = tileId(uv);
  float t = hash1(id + 3.1);
  float c = cloud(uv);
  float speck = smoothstep(0.62, 0.9, fbm(uv, vec2(160.0), 3) + 0.5);
  vec2 o = vec2(hash1(id + 1.0), hash1(id + 2.0)) * 9.0;
  float w = fbm(uv * vec2(1.0, 3.0) + o, vec2(3.0, 3.0), 5);
  float v = vein(sin((uv.x * 3.0 + uv.y * 1.4 + w * 3.2) * PI * 1.0) , 0.05) * 0.5;
  vec3 base = mix(vec3(0.735, 0.728, 0.712), vec3(0.79, 0.785, 0.77), t);
  vec3 col = base + c * 0.07 - speck * 0.035 + v * vec3(0.03);
  col *= 1.0 + fbm(uv, vec2(2.0), 3) * 0.04;
  col = mix(col, vec3(0.58, 0.575, 0.56), grout(uv));
  return srgb(col);
}
float mHeight(vec2 uv) {
  vec2 id = tileId(uv);
  float lip = (hash1(id + 9.0) - 0.5) * 0.12;
  float micro = fbm(uv, vec2(220.0), 3) * 0.06;
  return 0.5 + lip + micro + fbm(uv, vec2(12.0), 3) * 0.05 - grout(uv) * 0.6;
}
float mRough(vec2 uv) {
  float smudge = fbm(uv + 3.7, vec2(3.0), 5);
  float wear = fbm(uv, vec2(40.0), 3);
  return mix(0.2 + smudge * 0.16 + wear * 0.04, 0.85, grout(uv));
}
`;

// Bookmatched walnut / teak veneer panels, vertical grain, 4 boards per texture.
export const WALNUT = /* glsl */ `
float board(vec2 uv) { return floor(uv.x * 4.0); }
float seam(vec2 uv) {
  float f = fract(uv.x * 4.0);
  float d = min(f, 1.0 - f);
  return 1.0 - smoothstep(0.0015, 0.004, d);
}
float grain(vec2 uv) {
  float b = board(uv);
  float o = hash1(vec2(b, 3.0)) * 50.0;
  float lx = fract(uv.x * 4.0);
  lx = mix(lx, 1.0 - lx, step(0.5, hash1(vec2(b, 9.0))));
  float warp = fbm(vec2(uv.x, uv.y) + o, vec2(3.0, 2.0), 5) * 2.2;
  float figure = fbm(vec2(uv.x * 4.0, uv.y) + o * 0.3, vec2(4.0, 3.0), 4);
  float cathedral = abs(lx - 0.5) * 2.0;
  float rings = (lx * 24.0 + warp * 1.3 + figure * 0.9 + cathedral * cathedral * 3.0 * sin(uv.y * PI * 6.0 + o) + o);
  return rings;
}
vec3 mAlbedo(vec2 uv) {
  float b = board(uv);
  float r = grain(uv);
  float line = pow(abs(sin(r * PI)), 3.0) * 0.8;
  float fine = fbm(vec2(uv.x * 4.0, uv.y), vec2(256.0, 8.0), 3);
  float pores = smoothstep(0.35, 0.6, fbm(uv * vec2(1.0, 1.0), vec2(300.0, 40.0), 2) + 0.5);
  vec3 light = vec3(0.54, 0.37, 0.245);
  vec3 dark  = vec3(0.29, 0.185, 0.115);
  float tone = hash1(vec2(b, 1.0)) * 0.12;
  vec3 col = mix(light, dark, clamp(line * 0.75 + fine * 0.5 + 0.15 + tone, 0.0, 1.0));
  col *= 1.0 - pores * 0.12;
  col *= 1.0 + fbm(uv, vec2(2.0, 1.0), 3) * 0.12;
  col = mix(col, vec3(0.08, 0.05, 0.03), seam(uv));
  return srgb(col);
}
float mHeight(vec2 uv) {
  float pores = fbm(uv, vec2(300.0, 40.0), 2);
  float r = grain(uv);
  return 0.5 + pores * 0.12 + sin(r * PI * 2.0) * 0.02 - seam(uv) * 0.6;
}
float mRough(vec2 uv) {
  float pores = smoothstep(0.35, 0.6, fbm(uv, vec2(300.0, 40.0), 2) + 0.5);
  return 0.38 + pores * 0.18 + fbm(uv + 2.0, vec2(4.0), 3) * 0.08 + seam(uv) * 0.4;
}
`;

// Grigio / Nero marble with soft clouds and white veining (kitchen island).
export const DARK_MARBLE = /* glsl */ `
float veins(vec2 uv) {
  float w = fbm(uv, vec2(2.0), 7);
  float w2 = fbm(uv + 5.2, vec2(3.0), 6);
  float a = vein(sin((uv.x * 2.0 + uv.y * 1.0 + w * 2.6) * PI * 2.0), 0.035);
  float b = vein(sin((uv.x * 1.0 - uv.y * 3.0 + w2 * 3.5) * PI * 2.0), 0.02) * 0.6;
  float c = vein(sin((uv.x * 6.0 + uv.y * 4.0 + w * 6.0) * PI), 0.06) * 0.25;
  return clamp(a + b + c, 0.0, 1.0);
}
vec3 mAlbedo(vec2 uv) {
  float cl = fbm(uv + 1.3, vec2(4.0), 7);
  float cl2 = ridged(uv + 4.1, vec2(3.0), 6);
  vec3 col = vec3(0.235, 0.24, 0.245) + cl * 0.11 + cl2 * 0.06;
  col = mix(col, vec3(0.78, 0.78, 0.77), veins(uv) * 0.85);
  col *= 0.9;
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(64.0), 3) * 0.02; }
float mRough(vec2 uv) { return 0.1 + fbm(uv + 3.0, vec2(5.0), 4) * 0.1 + veins(uv) * 0.05; }
`;

// Calacatta white marble (bathrooms).
export const WHITE_MARBLE = /* glsl */ `
float veins(vec2 uv) {
  float w = fbm(uv, vec2(2.0), 7);
  float w2 = fbm(uv + 2.7, vec2(3.0), 7);
  float a = vein(sin((uv.x * 1.0 + uv.y * 2.0 + w * 2.8) * PI * 2.0), 0.05);
  float b = vein(sin((uv.x * 3.0 - uv.y * 1.0 + w2 * 3.0) * PI * 2.0), 0.018) * 0.7;
  float c = vein(sin((uv.x * 6.0 + uv.y * 8.0 + w * 5.0) * PI), 0.03) * 0.3;
  return clamp(a + b + c, 0.0, 1.0);
}
vec3 mAlbedo(vec2 uv) {
  float cl = fbm(uv + 1.3, vec2(4.0), 7);
  vec3 col = vec3(0.90, 0.895, 0.88) + cl * 0.05;
  float v = veins(uv);
  vec3 veinCol = mix(vec3(0.42, 0.42, 0.43), vec3(0.62, 0.55, 0.45), smoothstep(-0.2, 0.3, fbm(uv, vec2(3.0), 3)));
  col = mix(col, veinCol, v * 0.8);
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(64.0), 3) * 0.02; }
float mRough(vec2 uv) { return 0.08 + fbm(uv + 3.0, vec2(6.0), 4) * 0.08; }
`;

// Fine matte plaster / mineral paint.
export const PLASTER = /* glsl */ `
vec3 mAlbedo(vec2 uv) {
  float n = fbm(uv, vec2(3.0), 6);
  float m = fbm(uv, vec2(40.0), 3);
  vec3 col = vec3(0.905, 0.9, 0.885) * (1.0 + n * 0.035 + m * 0.012);
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(48.0), 4) * 0.25 + fbm(uv, vec2(6.0), 3) * 0.2; }
float mRough(vec2 uv) { return 0.86 + fbm(uv, vec2(8.0), 3) * 0.08; }
`;

// Boucle loop fabric. Near-white albedo; tinted by material colour.
export const BOUCLE = /* glsl */ `
float loops(vec2 uv) {
  float a = worley(uv, vec2(28.0));
  float b = worley(uv + 0.37, vec2(36.0));
  return 1.0 - min(a, b);
}
vec3 mAlbedo(vec2 uv) {
  float l = loops(uv);
  float n = fbm(uv, vec2(16.0), 3);
  return vec3(0.72 + l * 0.22 + n * 0.06);
}
float mHeight(vec2 uv) { return loops(uv) + fbm(uv, vec2(64.0), 2) * 0.3; }
float mRough(vec2 uv) { return 0.92; }
`;

// Linen-like plain weave. Near-white albedo; tinted by material colour.
export const LINEN = /* glsl */ `
float weave(vec2 uv, out float which) {
  vec2 p = uv * 96.0;
  vec2 c = floor(p);
  vec2 f = fract(p);
  float jit = fbm(uv, vec2(24.0), 2) * 0.6;
  float warp = sin((f.x + jit) * PI);
  float weft = sin((f.y + jit) * PI);
  float chk = mod(c.x + c.y, 2.0);
  which = chk;
  return mix(warp * 0.9 + weft * 0.4, weft * 0.9 + warp * 0.4, chk);
}
vec3 mAlbedo(vec2 uv) {
  float w; float h = weave(uv, w);
  float slub = fbm(uv * vec2(1.0, 1.0), vec2(4.0, 96.0), 3);
  return vec3(0.78 + h * 0.12 + slub * 0.12);
}
float mHeight(vec2 uv) { float w; return weave(uv, w) + fbm(uv, vec2(4.0, 96.0), 3) * 0.4; }
float mRough(vec2 uv) { return 0.9; }
`;

// Wide-plank European oak, staggered planks along u.
export const OAK = /* glsl */ `
vec4 plank(vec2 uv) {
  float rows = 12.0;
  float r = floor(uv.y * rows);
  float off = hash1(vec2(r, 5.0));
  float x = uv.x * 2.0 + off;
  float c = floor(x);
  return vec4(fract(x), fract(uv.y * rows), mod(c, 2.0) + r * 3.0, r);
}
float gap(vec2 uv) {
  vec4 p = plank(uv);
  float dx = min(p.x, 1.0 - p.x) * 1.2 / 1.0;
  float dy = min(p.y, 1.0 - p.y) * 0.2;
  return 1.0 - smoothstep(0.0006, 0.0016, min(dx * 0.5, dy));
}
vec3 mAlbedo(vec2 uv) {
  vec4 p = plank(uv);
  float id = p.z;
  float o = hash1(vec2(id, 1.0)) * 40.0;
  float w = fbm(vec2(uv.x, uv.y) + o, vec2(2.0, 6.0), 5);
  float w2 = fbm(uv + o * 0.1, vec2(8.0, 48.0), 4);
  float rings = sin((uv.y * 12.0 * 14.0 + w * 2.0 + w2 * 1.6 + o) * PI);
  float line = pow(abs(rings), 6.0);
  float fine = fbm(uv, vec2(4.0, 400.0), 3);
  vec3 a = vec3(0.77, 0.67, 0.54);
  vec3 b = vec3(0.64, 0.53, 0.41);
  float tone = (hash1(vec2(id, 7.0)) - 0.5) * 0.1;
  vec3 col = mix(a, b, clamp(line * 0.35 + fine * 0.45 + 0.25, 0.0, 1.0)) * (1.0 + tone);
  col = mix(col, vec3(0.2, 0.15, 0.1), gap(uv));
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(4.0, 400.0), 3) * 0.15 - gap(uv) * 0.6; }
float mRough(vec2 uv) { return 0.42 + fbm(uv, vec2(4.0, 200.0), 3) * 0.12 + fbm(uv + 1.0, vec2(3.0), 3) * 0.08 + gap(uv) * 0.3; }
`;

// Round wool rug with faded ornamental medallion (as in the reference).
export const RUG = /* glsl */ `
vec3 mAlbedo(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  vec3 cream = vec3(0.82, 0.81, 0.77);
  vec3 blue = vec3(0.56, 0.62, 0.66);
  vec3 grey = vec3(0.70, 0.71, 0.70);
  float fade = fbm(uv, vec2(5.0), 5);
  float orn = 0.0;
  // border rings
  orn += smoothstep(0.012, 0.0, abs(r - 0.93)) ;
  orn += smoothstep(0.006, 0.0, abs(r - 0.89)) * 0.8;
  // scalloped border motif
  float sc = abs(r - 0.86 - 0.02 * sin(a * 48.0));
  orn += smoothstep(0.012, 0.0, sc) * 0.7;
  // medallion petals
  float petals = abs(r - 0.32 - 0.07 * cos(a * 8.0));
  orn += smoothstep(0.02, 0.0, petals) * 0.9;
  float petals2 = abs(r - 0.48 - 0.05 * cos(a * 16.0 + 0.5));
  orn += smoothstep(0.012, 0.0, petals2) * 0.6;
  float swirl = sin(a * 24.0 + r * 30.0 + fade * 4.0);
  orn += smoothstep(0.85, 1.0, swirl) * smoothstep(0.55, 0.6, r) * smoothstep(0.82, 0.78, r) * 0.6;
  orn += smoothstep(0.08, 0.0, r) * 0.6;
  orn *= 0.55 + fade * 0.9;
  vec3 col = mix(cream, mix(blue, grey, 0.35 + fade), clamp(orn, 0.0, 1.0));
  col *= 1.0 + fbm(uv, vec2(180.0), 2) * 0.12;
  col = mix(col, cream * 0.92, smoothstep(0.93, 0.95, r) * (1.0 - smoothstep(0.98, 1.0, r)));
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(260.0), 2) * 0.5; }
float mRough(vec2 uv) { return 1.0; }
`;

// Short-pile wool for bedroom rugs (tinted by colour).
export const WOOL = /* glsl */ `
vec3 mAlbedo(vec2 uv) { return vec3(0.8 + fbm(uv, vec2(64.0), 4) * 0.2 + fbm(uv, vec2(4.0), 3) * 0.06); }
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(128.0), 3) * 0.6; }
float mRough(vec2 uv) { return 1.0; }
`;

// Weathered teak decking, boards along v.
export const DECK = /* glsl */ `
vec3 board(vec2 uv) {
  float n = 15.0;
  float b = floor(uv.x * n);
  float f = fract(uv.x * n);
  float off = hash1(vec2(b, 2.0));
  float y = uv.y + off;
  float seg = floor(y * 1.0);
  return vec3(f, fract(y), b * 7.0 + seg);
}
float gap(vec2 uv) { vec3 b = board(uv); float side = 1.0 - smoothstep(0.03, 0.07, min(b.x, 1.0 - b.x)); float end = 1.0 - smoothstep(0.0015, 0.004, min(b.y, 1.0 - b.y)); return max(side, end); }
vec3 mAlbedo(vec2 uv) {
  vec3 b = board(uv);
  float o = hash1(vec2(b.z, 1.0)) * 30.0;
  float g = fbm(uv + o, vec2(15.0, 12.0), 5);
  float lines = fbm(uv + o, vec2(30.0, 3.0), 4);
  vec3 col = mix(vec3(0.47, 0.40, 0.33), vec3(0.36, 0.30, 0.24), clamp(g + lines * 0.8 + 0.5, 0.0, 1.0));
  col *= 0.92 + hash1(vec2(b.z, 4.0)) * 0.16;
  col = mix(col, vec3(0.06, 0.05, 0.04), gap(uv));
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(60.0, 6.0), 3) * 0.2 - gap(uv) * 0.7; }
float mRough(vec2 uv) { return 0.72 + fbm(uv, vec2(10.0), 3) * 0.15; }
`;

// Large limestone pavers (exterior).
export const PAVER = /* glsl */ `
float joint(vec2 uv) {
  vec2 p = uv * vec2(2.0, 4.0);
  p.x += floor(p.y) * 0.5;
  vec2 f = fract(p);
  vec2 d = min(f, 1.0 - f) / vec2(2.0, 4.0);
  return 1.0 - smoothstep(0.001, 0.003, min(d.x, d.y));
}
vec3 mAlbedo(vec2 uv) {
  vec2 p = uv * vec2(2.0, 4.0); p.x += floor(p.y) * 0.5;
  float id = hash1(floor(p));
  vec3 col = vec3(0.70, 0.68, 0.64) * (0.93 + id * 0.1) + fbm(uv, vec2(8.0), 6) * 0.06 - smoothstep(0.6, 0.9, fbm(uv, vec2(120.0), 3) + 0.5) * 0.06;
  col = mix(col, vec3(0.42, 0.41, 0.39), joint(uv));
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(100.0), 4) * 0.3 - joint(uv) * 0.6; }
float mRough(vec2 uv) { return 0.75 + fbm(uv, vec2(6.0), 3) * 0.1; }
`;

// Lawn grass (seen at distance).
export const GRASS = /* glsl */ `
vec3 mAlbedo(vec2 uv) {
  float n = fbm(uv, vec2(6.0), 6);
  float b = fbm(uv, vec2(220.0, 220.0), 3);
  vec3 col = mix(vec3(0.11, 0.17, 0.06), vec3(0.21, 0.28, 0.10), clamp(n + 0.5 + b * 0.6, 0.0, 1.0));
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(220.0), 3) * 0.8; }
float mRough(vec2 uv) { return 0.95; }
`;

// Leaf cluster card with alpha.
export const LEAVES = /* glsl */ `
float leafMask(vec2 uv, out float shade) {
  float m = 0.0; shade = 0.0;
  for (int i = 0; i < 48; i++) {
    vec2 c = vec2(hash1(vec2(float(i), 1.0)), hash1(vec2(float(i), 2.0)));
    c = 0.15 + c * 0.7;
    float ang = hash1(vec2(float(i), 3.0)) * PI * 2.0;
    vec2 d = uv - c;
    d = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * d;
    float s = 0.045 + hash1(vec2(float(i), 4.0)) * 0.035;
    float e = length(d / vec2(s, s * 0.42));
    float leaf = 1.0 - smoothstep(0.85, 1.0, e);
    if (leaf > m) { m = leaf; shade = hash1(vec2(float(i), 5.0)) + d.x * 4.0; }
  }
  float edge = smoothstep(0.5, 0.35, length(uv - 0.5));
  return m * edge;
}
vec3 mAlbedo(vec2 uv) {
  float s; float m = leafMask(uv, s);
  return srgb(mix(vec3(0.13, 0.22, 0.07), vec3(0.32, 0.42, 0.14), clamp(s, 0.0, 1.0)));
}
float mAlpha(vec2 uv) { float s; return step(0.5, leafMask(uv, s)); }
float mHeight(vec2 uv) { float s; return leafMask(uv, s) * 0.3 + s * 0.1; }
float mRough(vec2 uv) { return 0.6; }
`;

// Vertical flutes (white balustrade, bathroom vanity).
export const FLUTED = /* glsl */ `
vec3 mAlbedo(vec2 uv) {
  float f = fract(uv.x * 16.0);
  float ao = mix(0.86, 1.0, sqrt(max(0.0, 1.0 - pow(2.0 * f - 1.0, 2.0))));
  return srgb(vec3(0.92, 0.915, 0.9) * ao * (1.0 + fbm(uv, vec2(6.0), 3) * 0.02));
}
float mHeight(vec2 uv) {
  float f = fract(uv.x * 16.0);
  return sqrt(max(0.0, 1.0 - pow(2.0 * f - 1.0, 2.0)));
}
float mRough(vec2 uv) { return 0.7; }
`;

// Brushed stainless / bronze base (tinted by colour).
export const BRUSHED = /* glsl */ `
vec3 mAlbedo(vec2 uv) { return vec3(0.9 + fbm(uv, vec2(2.0, 600.0), 3) * 0.1); }
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(4.0, 900.0), 3) * 0.6; }
float mRough(vec2 uv) { return 0.3 + fbm(uv, vec2(2.0, 600.0), 3) * 0.12; }
`;

// Gentle water ripples (normal map only).
export const WATER = /* glsl */ `
vec3 mAlbedo(vec2 uv) { return vec3(1.0); }
float mHeight(vec2 uv) { return fbm(uv, vec2(6.0), 6) + fbm(uv + 0.3, vec2(14.0), 3) * 0.3; }
float mRough(vec2 uv) { return 0.05; }
`;

// Abstract fine-art canvas: layered soft colour fields with brush texture.
export const ART = /* glsl */ `
vec3 mAlbedo(vec2 uv) {
  float n = fbm(uv, vec2(3.0), 6);
  float n2 = fbm(uv + 3.0, vec2(5.0), 5);
  float brush = fbm(uv * vec2(1.0, 1.0), vec2(4.0, 120.0), 3);
  vec3 sand = vec3(0.78, 0.72, 0.62);
  vec3 ochre = vec3(0.62, 0.45, 0.30);
  vec3 ink = vec3(0.18, 0.19, 0.21);
  vec3 sage = vec3(0.55, 0.58, 0.52);
  float band = smoothstep(0.35, 0.37, uv.y + n * 0.25) - smoothstep(0.62, 0.64, uv.y + n2 * 0.2);
  vec3 col = mix(sand, sage, smoothstep(0.0, 1.0, uv.y + n));
  col = mix(col, ochre, band * 0.85);
  float stroke = smoothstep(0.02, 0.0, abs(uv.y - 0.72 - n * 0.2)) * smoothstep(0.1, 0.3, uv.x) * smoothstep(0.9, 0.7, uv.x);
  col = mix(col, ink, stroke * 0.9);
  col *= 1.0 + brush * 0.12;
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(4.0, 120.0), 3) * 0.6 + fbm(uv, vec2(200.0), 2) * 0.2; }
float mRough(vec2 uv) { return 0.8; }
`;

// Dark honed basalt / slate (fireplace, TV wall, vanity).
export const SLATE = /* glsl */ `
vec3 mAlbedo(vec2 uv) {
  float n = fbm(uv, vec2(4.0), 7);
  float r = ridged(uv + 2.0, vec2(3.0), 6);
  vec3 col = vec3(0.10, 0.10, 0.105) + n * 0.035 + r * 0.03;
  float v = vein(sin((uv.x * 2.0 + uv.y + fbm(uv, vec2(2.0), 6) * 3.0) * PI * 2.0), 0.015);
  col = mix(col, vec3(0.45, 0.44, 0.42), v * 0.5);
  return srgb(col);
}
float mHeight(vec2 uv) { return 0.5 + fbm(uv, vec2(80.0), 3) * 0.1; }
float mRough(vec2 uv) { return 0.22 + fbm(uv, vec2(5.0), 3) * 0.12; }
`;

// Bark for tree trunks.
export const BARK = /* glsl */ `
vec3 mAlbedo(vec2 uv) {
  float r = ridged(uv * vec2(1.0, 1.0), vec2(16.0, 4.0), 5);
  return srgb(vec3(0.28, 0.24, 0.20) * (0.6 + r * 0.6));
}
float mHeight(vec2 uv) { return ridged(uv, vec2(16.0, 4.0), 5); }
float mRough(vec2 uv) { return 0.95; }
`;
