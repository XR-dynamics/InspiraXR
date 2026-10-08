import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** GTAO that ignores transparent surfaces (glass, sheers, water, flames). */
class ArchGTAOPass extends GTAOPass {
  _overrideVisibility() {
    super._overrideVisibility();
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      if (o.visible && (o.isMesh || o.isInstancedMesh) && (o.userData.noAO || (o.material && o.material.transparent))) {
        o.visible = false;
        cache.push(o);
      }
    });
  }
}

// Photographic grade in linear HDR: gentle vignette and split tone.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignette: { value: 0.32 },
    warmth: { value: 0.0 },
    tint: { value: new THREE.Vector3(1, 1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float vignette; uniform float warmth; uniform vec3 tint;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = 1.0 - vignette * smoothstep(0.25, 0.95, dot(d, d) * 2.2);
      c.rgb *= v * tint;
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb += warmth * vec3(0.02, 0.005, -0.02) * l;
      gl_FragColor = c;
    }`,
};

// Final display-space pass: fine film grain to break banding.
const GrainShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amount: { value: 0.022 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform float amount; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float n = h(gl_FragCoord.xy) - 0.5;
      c.rgb += n * amount * (1.0 - c.rgb * 0.5);
      gl_FragColor = c;
    }`,
};

export class Renderer {
  constructor(canvas) {
    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; // re-rendered on demand (see main loop)
    renderer.shadowMap.needsUpdate = true;
    this.renderer = renderer;
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    this.pixelRatio = Math.min(this.maxPixelRatio, 1.25);
    this.quality = 1;
    this._frameTimes = [];
  }

  setup(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    const r = this.renderer;
    const w = window.innerWidth, h = window.innerHeight;
    r.setPixelRatio(this.pixelRatio);
    r.setSize(w, h, false);
    const rt = new THREE.WebGLRenderTarget(w * this.pixelRatio, h * this.pixelRatio, {
      type: THREE.HalfFloatType, samples: 4,
    });
    const composer = new EffectComposer(r, rt);
    composer.setPixelRatio(this.pixelRatio);
    composer.setSize(w, h);
    this.composer = composer;
    composer.addPass(new RenderPass(scene, camera));

    const gtao = new ArchGTAOPass(scene, camera, w, h);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 0.9;
    gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.6, thickness: 1.5, scale: 1.15, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    composer.addPass(gtao);
    this.gtao = gtao;

    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.6, 2.2);
    composer.addPass(bloom);
    this.bloom = bloom;

    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);
    composer.addPass(new OutputPass());
    this.grain = new ShaderPass(GrainShader);
    composer.addPass(this.grain);

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.camera.userData.applyShift?.();
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
  }

  /** Adaptive resolution: keep the experience smooth on modest GPUs. */
  adapt(dt) {
    this._frameTimes.push(dt);
    if (this._frameTimes.length < 90) return;
    const avg = this._frameTimes.reduce((a, b) => a + b, 0) / this._frameTimes.length;
    this._frameTimes.length = 0;
    let pr = this.pixelRatio;
    if (avg > 1 / 38 && pr > 0.6) pr = Math.max(0.6, pr - 0.15);
    else if (avg < 1 / 57 && pr < this.maxPixelRatio) pr = Math.min(this.maxPixelRatio, pr + 0.1);
    if (Math.abs(pr - this.pixelRatio) > 0.01) { this.pixelRatio = pr; this.resize(); }
  }

  render(time) {
    this.grain.uniforms.time.value = time % 100;
    this.composer.render();
  }
}
