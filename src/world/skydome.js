import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { LOOK } from './look.js';

/*
 * Photographic sky: an equirectangular HDRI per time of day, drawn on a dome behind everything (so the window
 * views, the terrace and the reflection probes all see it) and crossfaded when the time of day changes.
 * The dome's alpha is its availability: where an HDRI is missing it fades to transparent and the procedural
 * sky behind it shows instead, so the app never breaks. Textures load on demand and unused ones are disposed.
 * Each HDRI is turned so its sun sits at the scene sun's compass heading, and the scene sun takes the HDRI sun's
 * elevation, so shadows agree with the photograph.
 */

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p;
  gl_Position.z = gl_Position.w;   // always at the far plane
}`;

const FRAG = /* glsl */ `
uniform sampler2D tA; uniform sampler2D tB;
uniform float yawA; uniform float yawB; uniform float hasA; uniform float hasB;
uniform float mixK; uniform float gain;
varying vec3 vDir;
vec2 equirect(vec3 d, float yaw) {
  float c = cos(yaw), s = sin(yaw);
  d = vec3(d.x * c + d.z * s, d.y, -d.x * s + d.z * c);
  return vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
}
void main() {
  vec3 d = normalize(vDir);
  vec3 a = hasA > 0.0 ? texture2D(tA, equirect(d, yawA)).rgb : vec3(0.0);
  vec3 b = hasB > 0.0 ? texture2D(tB, equirect(d, yawB)).rgb : vec3(0.0);
  vec3 col = mix(a * hasA, b * hasB, mixK) * gain;
  float alpha = mix(hasA, hasB, mixK);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class SkyDome {
  constructor(lighting, renderer) {
    this.lighting = lighting;
    this.renderer = renderer;
    this.loader = new HDRLoader();
    this.cache = new Map();       // mode -> Promise<{ tex, sun }>|{ tex, sun } (tex null when missing)
    this.slotA = null; this.slotB = null;   // { mode, tex, yaw }
    this.k = 1; this.fading = false;
    this.uniforms = {
      tA: { value: null }, tB: { value: null }, yawA: { value: 0 }, yawB: { value: 0 },
      hasA: { value: 0 }, hasB: { value: 0 }, mixK: { value: 1 }, gain: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      side: THREE.BackSide, depthWrite: false, transparent: true, toneMapped: true, fog: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(300, 64, 32), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -2;
    this.mesh.name = 'hdri-sky';
    this.mesh.userData.noBlueprint = true;
    this.mesh.userData.noAO = true;
    this.mesh.raycast = () => {};
    lighting.scene.add(this.mesh);
    // keep the dome centred on whoever is looking (also inside the reflection-probe cameras)
    this.mesh.onBeforeRender = (r, s, cam) => { this.mesh.position.setFromMatrixPosition(cam.matrixWorld); this.mesh.updateMatrixWorld(); };
  }

  /** Load (once) the HDRI for a mode and find its sun. Resolves to { tex, sun } with tex null when the file is missing. */
  _get(mode) {
    if (this.cache.has(mode)) return Promise.resolve(this.cache.get(mode));
    const url = LOOK.hdri[mode];
    if (!url) { const e = { tex: null, sun: null }; this.cache.set(mode, e); return Promise.resolve(e); }
    const p = fetch(`${import.meta.env.BASE_URL}${url}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((buf) => {
        // a dev server answers a missing file with its HTML page: only a Radiance header ("#?") is an HDRI
        const head = new Uint8Array(buf, 0, 2);
        if (head[0] !== 0x23 || head[1] !== 0x3f) throw new Error('not an HDR file');
        const d = this.loader.parse(buf);
        const tex = new THREE.DataTexture(d.data, d.width, d.height, THREE.RGBAFormat, d.type);
        tex.colorSpace = THREE.LinearSRGBColorSpace;
        tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false; tex.flipY = true; tex.needsUpdate = true;
        return { tex, sun: findSun(tex) };
      })
      .catch(() => {
        console.warn(`[InspiraXR] HDRI "${url}" not found or unreadable: using the procedural ${mode} sky instead.`);
        return { tex: null, sun: null };
      })
      .then((e) => { this.cache.set(mode, e); return e; });
    this.cache.set(mode, p);
    return p;
  }

  /** Crossfade to a time of day (called by Lighting.setMode). */
  async setMode(mode, instant = false) {
    this.want = mode;
    const cached = this.cache.get(mode);
    const ready = cached && !(cached instanceof Promise);
    const e = await this._get(mode);
    if (this.want !== mode) return;           // a newer request superseded this one
    const next = { mode, tex: e.tex, yaw: this._align(mode, e.sun) };
    // what is on screen now is frozen into slot A and the new photograph fades in as slot B
    this.slotA = (this.fading ? (this.k > 0.5 ? this.slotB : this.slotA) : this.slotB) || null;
    this.slotB = next;
    this.k = instant && ready ? 1 : 0;         // a photograph that arrives late fades in rather than popping
    this.fading = this.k < 1;
    this._bind();
    this._dispose();
    this.lighting.envDirty = true;            // reflections must see the new sky
  }

  /** Turn the HDRI so its sun matches the scene sun's heading; give the scene sun the HDRI's elevation. */
  _align(mode, sun) {
    const preset = this.lighting.presets[mode];
    if (!sun || !preset) return 0;
    const world = this.lighting._sunDir(preset.sun);
    const azWorld = Math.atan2(world.z, world.x), azHdri = Math.atan2(sun.z, sun.x);
    if (sun.y > 0.03) {
      // keep the preset's heading (it was chosen to light the rooms well) but use the photograph's sun height
      const h = Math.sqrt(1 - sun.y * sun.y), az = Math.atan2(preset.sun.z, preset.sun.x);
      preset.sun.set(Math.cos(az) * h, sun.y, Math.sin(az) * h).normalize();
      const L = this.lighting;
      if (L.mode === mode) {
        if (L.t >= 1) { L.state.sun.copy(preset.sun); L._apply(); } else if (L.to) L.to.sun.copy(preset.sun);
      }
    }
    return azWorld - azHdri;
  }

  _bind() {
    const u = this.uniforms, A = this.slotA, B = this.slotB;
    u.tA.value = A?.tex || null; u.hasA.value = A?.tex ? 1 : 0; u.yawA.value = A?.yaw || 0;
    u.tB.value = B?.tex || null; u.hasB.value = B?.tex ? 1 : 0; u.yawB.value = B?.yaw || 0;
    u.mixK.value = this.k;
  }

  /** Free every photograph that is neither on screen nor fading in. */
  _dispose() {
    const keep = new Set([this.slotA?.mode, this.slotB?.mode]);
    for (const [mode, e] of this.cache) {
      if (keep.has(mode) || e instanceof Promise || !e.tex) continue;
      e.tex.dispose();
      this.cache.delete(mode);
    }
  }

  update(dt) {
    this.uniforms.gain.value = this.lighting.state.sky ?? 1;
    if (!this.fading) return;
    this.k = Math.min(1, this.k + dt / LOOK.fade);
    const s = this.k * this.k * (3 - 2 * this.k);
    this.uniforms.mixK.value = s;
    if (this.k >= 1) {
      this.fading = false;
      this.slotA = null;
      this._bind();
      this._dispose();
      this.lighting.envDirty = true;
    }
  }
}

/** Direction of the brightest region of an equirectangular HDR texture (its sun), or null for a sunless sky. */
function findSun(tex) {
  const { data, width: W, height: H } = tex.image;
  const half = tex.type === THREE.HalfFloatType;
  const val = (i) => (half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i]);
  const step = Math.max(1, Math.floor(W / 512));
  let best = 0, bu = 0, bv = 0, sum = 0, n = 0;
  for (let y = 0; y < H / 2; y += step) {           // the upper hemisphere only
    for (let x = 0; x < W; x += step) {
      const i = (y * W + x) * 4;
      const l = 0.2126 * val(i) + 0.7152 * val(i + 1) + 0.0722 * val(i + 2);
      sum += l; n++;
      if (l > best) { best = l; bu = (x + 0.5) / W; bv = 1 - (y + 0.5) / H; }
    }
  }
  if (best < Math.max(20 * (sum / n), 2)) return null;   // no distinct sun (overcast or night)
  const phi = (bu - 0.5) * Math.PI * 2, theta = (bv - 0.5) * Math.PI;
  return new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi));
}
