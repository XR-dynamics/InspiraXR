import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { lerp, smooth } from './util.js';

/*
 * Natural light (sun + atmospheric sky), time-of-day presets, image-based
 * lighting baked from inside the house, and switchable architectural lighting
 * grouped per room.
 */

const PRESETS = {
  day: {
    sun: new THREE.Vector3(-0.64, 0.6, 0.48).normalize(), sunColor: new THREE.Color(0xfff0dc), sunIntensity: 3.4,
    turbidity: 2.6, rayleigh: 1.1, mie: 0.004, mieG: 0.82, skyGain: 1.0, night: 0,
    hemiSky: new THREE.Color(0xcfe0ff), hemiGround: new THREE.Color(0xd6d6d6), hemi: 0.42, tint: new THREE.Vector3(1.0, 1.0, 1.02),
    env: 0.85, exposure: 0.6, interior: 0.0, bgFog: new THREE.Color(0xc9d3dc),
  },
  sunset: {
    sun: new THREE.Vector3(-0.9, 0.3, 0.32).normalize(), sunColor: new THREE.Color(0xffbf85), sunIntensity: 3.6,
    turbidity: 4.0, rayleigh: 1.6, mie: 0.006, mieG: 0.9, skyGain: 1.0, night: 0,
    hemiSky: new THREE.Color(0xc9d3e6), hemiGround: new THREE.Color(0xd2d3d6), hemi: 0.36, tint: new THREE.Vector3(0.94, 0.985, 1.09),
    env: 0.8, exposure: 0.62, interior: 0.75, bgFog: new THREE.Color(0xd9b49a),
  },
  night: {
    sun: new THREE.Vector3(-0.35, 0.65, -0.5).normalize(), sunColor: new THREE.Color(0x8ea8de), sunIntensity: 0.06,
    turbidity: 2, rayleigh: 0.5, mie: 0.003, mieG: 0.8, skyGain: 0.0, night: 1,
    hemiSky: new THREE.Color(0x28344f), hemiGround: new THREE.Color(0x0d0d10), hemi: 0.05, tint: new THREE.Vector3(0.95, 0.99, 1.06),
    env: 0.55, exposure: 0.62, interior: 1.0, bgFog: new THREE.Color(0x0c1220),
  },
};

export class Lighting {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.rooms = new Map();
    this.flickers = [];
    this.mode = 'sunset';
    this.state = this._copy(PRESETS.sunset);
    this.from = null; this.to = null; this.t = 1; this.dur = 3.0;
    this.envDirty = true;
    this.onEnvBaked = null;

    // --- sky
    const sky = new Sky();
    sky.scale.setScalar(900);
    sky.material.uniforms.skyGain = { value: 1 };
    sky.material.uniforms.nightMix = { value: 0 };
    sky.material.fragmentShader = sky.material.fragmentShader
      .replace('uniform vec3 up;', 'uniform vec3 up;\nuniform float skyGain;\nuniform float nightMix;')
      .replace('gl_FragColor = vec4( retColor, 1.0 );', `
        retColor = min(retColor * skyGain, vec3(6.0));
        float hz = clamp(direction.y, 0.0, 1.0);
        vec3 night = mix(vec3(0.020, 0.030, 0.055), vec3(0.004, 0.007, 0.018), pow(hz, 0.45));
        float st = fract(sin(dot(floor(direction.xz / max(direction.y, 0.05) * 220.0), vec2(12.9898, 78.233))) * 43758.5453);
        night += vec3(step(0.9985, st) * 0.6 * smoothstep(0.05, 0.3, hz));
        retColor = mix(retColor, night, nightMix);
        gl_FragColor = vec4( retColor, 1.0 );`);
    sky.material.needsUpdate = true;
    this.sky = sky;
    scene.add(sky);

    // --- sun
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 160;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.025;
    sun.target.position.set(10, 0, 2);
    scene.add(sun, sun.target);
    this.sun = sun;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.3);
    scene.add(this.hemi);

    // --- image based lighting: one probe per zone, captured from inside the house
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.cams = new Map();
    this.probes = new Map(); // zone -> { cfg, rt, materials: Set }
    this.dirtyZones = new Set();

    this._apply();
  }

  _copy(p) {
    const o = {};
    for (const [k, v] of Object.entries(p)) o[k] = v && v.clone ? v.clone() : v;
    return o;
  }

  /** Register a switchable room light group. */
  room(key) {
    if (!this.rooms.has(key)) this.rooms.set(key, { lights: [], emissive: [], on: false, level: 0, user: null });
    return this.rooms.get(key);
  }
  addLight(key, light, intensity) {
    light.userData.base = intensity;
    light.intensity = 0;
    this.room(key).lights.push(light);
    this.scene.add(light);
    if (light.target) this.scene.add(light.target);
    return light;
  }
  addEmissive(key, material, intensity) {
    this.room(key).emissive.push({ material, intensity });
  }
  addFlicker(light) { this.flickers.push(light); }

  toggleRoom(key) {
    const r = this.rooms.get(key);
    if (!r) return false;
    r.user = !(r.user ?? r.on);
    return r.user;
  }
  isOn(key) { const r = this.rooms.get(key); return r ? (r.user ?? r.on) : false; }

  setMode(mode, instant = false) {
    if (!PRESETS[mode]) return;
    this.mode = mode;
    for (const r of this.rooms.values()) r.user = null;
    this.from = this._copy(this.state);
    this.to = this._copy(PRESETS[mode]);
    this.t = instant ? 1 : 0;
    if (instant) { this.state = this._copy(this.to); this._apply(); this.envDirty = true; }
  }

  _apply() {
    const s = this.state;
    const u = this.sky.material.uniforms;
    u.turbidity.value = s.turbidity;
    u.rayleigh.value = s.rayleigh;
    u.mieCoefficient.value = s.mie;
    u.mieDirectionalG.value = s.mieG;
    u.skyGain.value = s.skyGain;
    u.nightMix.value = s.night;
    const sunSky = s.night > 0.5 ? new THREE.Vector3(0, -1, 0) : s.sun;
    u.sunPosition.value.copy(sunSky).multiplyScalar(400);
    this.sun.position.copy(this.sun.target.position).addScaledVector(s.sun, 80);
    this.sun.color.copy(s.sunColor);
    this.sun.intensity = s.sunIntensity;
    this.hemi.color.copy(s.hemiSky);
    this.hemi.groundColor.copy(s.hemiGround);
    this.hemi.intensity = s.hemi;
    this.scene.environmentIntensity = s.env;
    this.baseExposure = s.exposure;
    for (const r of this.rooms.values()) {
      r.on = s.interior > 0.5;
    }
  }

  update(dt, time) {
    if (this.t < 1 && this.to) {
      this.t = Math.min(1, this.t + dt / this.dur);
      const k = smooth(this.t);
      const a = this.from, b = this.to, s = this.state;
      for (const key of Object.keys(b)) {
        if (typeof b[key] === 'number') s[key] = lerp(a[key], b[key], k);
        else if (b[key].isColor) s[key].copy(a[key]).lerp(b[key], k);
        else if (b[key].isVector3) { s[key].copy(a[key]).lerp(b[key], k); if (key === 'sun') s[key].normalize(); }
      }
      this._apply();
      if (this.t >= 1) this.envDirty = true;
      else if (Math.floor(this.t * 5) !== Math.floor((this.t - dt / this.dur) * 5)) this.dirtyZones.add('main');
    }
    // fade room lights
    let changed = false;
    for (const [key, r] of this.rooms) {
      const target = (r.user ?? r.on) ? 1 : 0;
      if (Math.abs(r.level - target) > 1e-3) {
        r.level += Math.sign(target - r.level) * Math.min(Math.abs(target - r.level), dt / 0.9);
        changed = true;
        if (Math.abs(r.level - target) <= 1e-3) { r.level = target; this.dirtyZones.add(this.roomZone?.[key] || 'main'); }
      }
      const k = smooth(r.level);
      for (const l of r.lights) l.intensity = l.userData.base * k;
      for (const e of r.emissive) e.material.emissiveIntensity = e.intensity * k;
    }
    for (const f of this.flickers) {
      const n = Math.sin(time * 13.1) * 0.5 + Math.sin(time * 7.3 + 1.3) * 0.3 + Math.sin(time * 23.7) * 0.2;
      f.intensity *= 0.85 + n * 0.15;
    }
    return changed;
  }

  /** Register probe zones and the zone-specific material clones they light. */
  setupProbes(zones, zoneMaterials) {
    for (const [zone, cfg] of Object.entries(zones)) {
      const mats = zoneMaterials.get(zone);
      this.probes.set(zone, { cfg, rt: null, materials: mats ? [...mats.values()] : [] });
    }
    this.roomZone = {};
    for (const [zone, cfg] of Object.entries(zones)) for (const r of cfg.rooms) this.roomZone[r] = zone;
  }

  _cam(size) {
    if (!this.cams.has(size)) {
      const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
      const cam = new THREE.CubeCamera(0.05, 400, rt);
      this.scene.add(cam);
      this.cams.set(size, cam);
    }
    return this.cams.get(size);
  }

  _bakeZone(zone) {
    const p = this.probes.get(zone);
    const cam = this._cam(p.cfg.size);
    cam.position.set(...p.cfg.pos);
    cam.update(this.renderer, this.scene);
    const next = this.pmrem.fromCubemap(cam.renderTarget.texture);
    const old = p.rt;
    p.rt = next;
    if (zone === 'main') this.scene.environment = next.texture;
    for (const m of p.materials) {
      m.envMap = next.texture;
      m.envMapIntensity = (m.userData.envBase ??= m.envMapIntensity) * this.state.env;
    }
    if (old) old.dispose();
  }

  /** Re-capture probes into prefiltered environment maps (all zones, or only dirty ones). */
  bakeEnvironment(hide = [], zones = null) {
    hide.forEach((o) => { o.userData._v = o.visible; o.visible = false; });
    const autoShadow = this.renderer.shadowMap.autoUpdate;
    this.renderer.shadowMap.autoUpdate = false;
    const list = zones || [...this.probes.keys()];
    const passes = zones ? 1 : 2;
    for (let pass = 0; pass < passes; pass++) for (const z of list) this._bakeZone(z);
    this.renderer.shadowMap.autoUpdate = autoShadow;
    hide.forEach((o) => { o.visible = o.userData._v; });
    this.envDirty = false;
    this.dirtyZones.clear();
    if (this.onEnvBaked) this.onEnvBaked();
  }
}

export { PRESETS };
