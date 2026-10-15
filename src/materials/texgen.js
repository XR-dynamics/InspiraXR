import * as THREE from 'three';

/*
 * GPU procedural texture baker.
 *
 * Every surface in the residence is generated on the GPU at load time from
 * tileable noise functions: albedo, normal (derived from a height field) and
 * roughness maps. No external image assets are required, and the textures
 * can be baked at high resolution in a few milliseconds each.
 */

const PRELUDE = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform int mode;
uniform vec2 texel;
uniform float nStrength;
uniform float seed;

#define PI 3.14159265359

vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }
float hash1(vec2 p) { p = fract(p * vec2(123.34, 456.21) + seed * 0.123); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 hash2(vec2 p) {
  p += seed * 1.37;
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
// Periodic gradient noise: p in lattice units, per = period in lattice units.
float gnoise(vec2 p, vec2 per) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 a = mod(i, per), b = mod(i + vec2(1.0, 0.0), per), c = mod(i + vec2(0.0, 1.0), per), d = mod(i + 1.0, per);
  return mix(mix(dot(hash2(a), f), dot(hash2(b), f - vec2(1.0, 0.0)), u.x),
             mix(dot(hash2(c), f - vec2(0.0, 1.0)), dot(hash2(d), f - 1.0), u.x), u.y);
}
// Tileable fbm over uv in [0,1]; freq must be integer.
float fbm(vec2 uv, vec2 freq, int oct) {
  float s = 0.0, a = 0.5; vec2 f = freq;
  for (int i = 0; i < 9; i++) {
    if (i >= oct) break;
    s += a * gnoise(uv * f, f);
    f *= 2.0; a *= 0.5;
  }
  return s;
}
float ridged(vec2 uv, vec2 freq, int oct) {
  float s = 0.0, a = 0.5; vec2 f = freq;
  for (int i = 0; i < 9; i++) {
    if (i >= oct) break;
    s += a * (1.0 - abs(gnoise(uv * f, f) * 2.0));
    f *= 2.0; a *= 0.5;
  }
  return s;
}
// Periodic worley (F1) noise.
float worley(vec2 uv, vec2 freq) {
  vec2 p = uv * freq; vec2 i = floor(p); vec2 f = fract(p);
  float d = 1e9;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y));
    vec2 c = mod(i + o, freq);
    vec2 r = o + 0.5 + 0.45 * hash2(c) - f;
    d = min(d, dot(r, r));
  }
  return sqrt(d);
}
// Thin marble vein: returns 0..1 intensity of a vein.
float vein(float x, float width) { return 1.0 - smoothstep(0.0, width, abs(x)); }
`;

const MAIN = /* glsl */ `
#ifndef HAS_ALPHA
float mAlpha(vec2 uv) { return 1.0; }
#endif
void main() {
  vec2 uv = vUv;
  if (mode == 0) {
    gl_FragColor = vec4(mAlbedo(uv), mAlpha(uv));
  } else if (mode == 1) {
    float h  = mHeight(uv);
    float hx = mHeight(uv + vec2(texel.x, 0.0));
    float hy = mHeight(uv + vec2(0.0, texel.y));
    float hx2 = mHeight(uv - vec2(texel.x, 0.0));
    float hy2 = mHeight(uv - vec2(0.0, texel.y));
    vec3 n = normalize(vec3((hx2 - hx) * nStrength, (hy2 - hy) * nStrength, 1.0));
    gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
  } else {
    // ORM packing: R = ambient occlusion, G = roughness, B = metalness
    gl_FragColor = vec4(1.0, clamp(mRough(uv), 0.02, 1.0), 0.0, 1.0);
  }
}
`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export class TextureBaker {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  }

  /**
   * Bake a material definition into albedo / normal / orm textures.
   * def: { glsl, size, normalStrength, repeat:[x,y], seed, maps:['map','normal','orm'], alpha }
   */
  bake(def) {
    const size = def.size || 1024;
    const maps = def.maps || ['map', 'normal', 'orm'];
    const defines = def.alpha ? '#define HAS_ALPHA\n' : '';
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: defines + PRELUDE + def.glsl + MAIN,
      uniforms: {
        mode: { value: 0 },
        texel: { value: new THREE.Vector2(1 / size, 1 / size) },
        nStrength: { value: def.normalStrength ?? 1.0 },
        seed: { value: def.seed ?? 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad.material = material;
    const out = {};
    const prevTarget = this.renderer.getRenderTarget();
    const modes = { map: 0, normal: 1, orm: 2 };
    for (const m of maps) {
      const srgbMap = m === 'map';
      // normal and roughness maps may be baked smaller than the albedo (def.dataSize) to save memory
      const dim = srgbMap ? size : (def.dataSize || size);
      material.uniforms.texel.value.set(1 / dim, 1 / dim);
      const rt = new THREE.WebGLRenderTarget(dim, dim, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        colorSpace: srgbMap ? THREE.SRGBColorSpace : THREE.NoColorSpace,
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping,
        depthBuffer: false,
        anisotropy: this.anisotropy,
      });
      material.uniforms.mode.value = modes[m];
      this.renderer.setRenderTarget(rt);
      this.renderer.render(this.scene, this.camera);
      const tex = rt.texture;
      if (def.repeat) tex.repeat.set(def.repeat[0], def.repeat[1]);
      tex.userData.renderTarget = rt;
      out[m] = tex;
    }
    this.renderer.setRenderTarget(prevTarget);
    material.dispose();
    return out;
  }
}
