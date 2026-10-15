import * as THREE from 'three';
import { buildBackdrop } from './backdrop.js';

/*
 * The setting: the apartment stands on a gravel plateau above the sea. This module builds the ocean
 * (an analytic wave surface that reflects the sky and the sun, fades into the horizon haze, and
 * follows the time-of-day presets) and the weathered sea cliff that drops from the plateau's edge to
 * the water. No vegetation, buildings or other objects are added.
 */

export const SEA_LEVEL = -9.4;
// the gravel plateau the plan stands on (web coordinates)
const PLATEAU = { x0: -9, x1: 24, z0: -16, z1: 11, top: -0.7 };

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uGlint;
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uDeep;
uniform vec3 uShallow;

// Sum of travelling waves. Returns the horizontal gradient of the height field.
vec2 waveGrad(vec2 p, float t, float detail) {
  vec2 g = vec2(0.0);
  // (direction, wavelength, steepness)
  g += vec2( 0.92,  0.39) * cos(dot(p, vec2( 0.92,  0.39)) * 0.105 + t * 0.80) * 0.105 * 0.55;
  g += vec2(-0.55,  0.83) * cos(dot(p, vec2(-0.55,  0.83)) * 0.200 + t * 1.10) * 0.200 * 0.30;
  g += vec2( 0.31, -0.95) * cos(dot(p, vec2( 0.31, -0.95)) * 0.390 + t * 1.55) * 0.390 * 0.12;
  g += detail * vec2(-0.87, -0.49) * cos(dot(p, vec2(-0.87, -0.49)) * 0.82 + t * 2.2) * 0.82 * 0.055;
  g += detail * vec2( 0.64,  0.77) * cos(dot(p, vec2( 0.64,  0.77)) * 1.70 + t * 3.0) * 1.70 * 0.028;
  g += detail * vec2(-0.20,  0.98) * cos(dot(p, vec2(-0.20,  0.98)) * 3.40 + t * 4.1) * 3.40 * 0.012;
  return g;
}

vec3 skyAt(vec3 r) {
  float y = clamp(r.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(y, 0.42));
  float sd = max(dot(r, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 900.0) * 18.0 + pow(sd, 18.0) * 0.18 + pow(sd, 4.0) * 0.05) * uGlint;
  return col;
}

void main() {
  vec3 V = cameraPosition - vWorld;
  float dist = length(V);
  V /= dist;
  float detail = 1.0 / (1.0 + dist * 0.012);
  vec2 g = waveGrad(vWorld.xz, uTime, detail);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  // flatten toward the horizon so distant water does not shimmer
  n = normalize(mix(n, vec3(0.0, 1.0, 0.0), clamp(dist / 900.0, 0.0, 0.85)));

  float cosT = max(dot(n, V), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
  vec3 R = reflect(-V, n);
  R.y = abs(R.y);
  vec3 refl = skyAt(R);

  // body colour: deeper toward the camera's far side, lighter where the surface faces us
  float shallowMix = pow(1.0 - cosT, 2.0) * 0.6 + g.x * 0.5 * detail + 0.15;
  vec3 body = mix(uDeep, uShallow, clamp(shallowMix, 0.0, 1.0));
  body *= 0.7 + 0.5 * smoothstep(-0.2, 0.9, uSunDir.y);
  body = mix(vec3(dot(body, vec3(0.33))), body, 1.35);   // keep the water a clear blue after tone mapping

  vec3 col = mix(body, refl, clamp(fres * 1.15, 0.0, 1.0));
  // crest whitening where the surface is steep
  float steep = length(g);
  col += vec3(0.5, 0.55, 0.58) * smoothstep(0.16, 0.34, steep) * 0.1 * detail * (0.3 + uSunDir.y);

  float haze = 1.0 - exp(-pow(dist / 650.0, 1.6));
  col = mix(col, uHorizon, clamp(haze, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function buildOcean(ctx) {
  const { scene, lighting, M } = ctx;
  const group = new THREE.Group();
  group.name = 'ocean';
  group.userData.noBlueprint = true;

  // ---- sea
  const uniforms = {
    uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color(1, 1, 1) }, uGlint: { value: 1 },
    uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, toneMapped: true });
  const geo = new THREE.CircleGeometry(1450, 96).rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(geo, mat);
  sea.position.set(7, SEA_LEVEL, -3);
  sea.frustumCulled = false;
  sea.receiveShadow = false;
  sea.renderOrder = -1;
  group.add(sea);

  // ---- distant mountains, forested hills and clouds
  const backdrop = buildBackdrop();
  group.add(backdrop.mesh);

  // ---- cliff: a displaced grid that is flat under the plateau and falls away to the water
  const cliff = buildCliff(M);
  group.add(cliff);
  scene.add(group);

  const sunDir = new THREE.Vector3();
  const sync = () => {
    const s = lighting.state;
    uniforms.uHorizon.value.copy(s.seaHorizon);
    uniforms.uZenith.value.copy(s.seaZenith);
    uniforms.uDeep.value.copy(s.seaDeep);
    uniforms.uShallow.value.copy(s.seaShallow);
    uniforms.uGlint.value = s.seaGlint;
    sunDir.copy(lighting._sunDir(s.sun));
    if (s.night > 0.5) sunDir.set(-0.35, 0.65, -0.5).normalize();
    uniforms.uSunDir.value.copy(sunDir);
    uniforms.uSunColor.value.copy(s.sunColor).multiplyScalar(Math.max(0.25, Math.min(1.4, s.sunIntensity / 3.4)));
    const b = backdrop.uniforms;
    b.uHorizon.value.copy(s.seaHorizon); b.uZenith.value.copy(s.seaZenith);
    b.uSunDir.value.copy(sunDir); b.uSunColor.value.copy(s.sunColor);
    b.uNight.value = s.night; b.uOvercast.value = s.overcast; b.uSunI.value = s.sunIntensity;
  };
  sync();
  return {
    group, sea, cliff, uniforms, backdrop,
    animated: [(dt, t) => { uniforms.uTime.value = t; backdrop.uniforms.uTime.value = t; sync(); }],
  };
}

function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (hash(ix, iz) * (1 - u) + hash(ix + 1, iz) * u) * (1 - v) + (hash(ix, iz + 1) * (1 - u) + hash(ix + 1, iz + 1) * u) * v;
}

function buildCliff(M) {
  const X0 = -90, X1 = 100, Z0 = -110, Z1 = 90, STEP = 1.5;
  const nx = Math.round((X1 - X0) / STEP), nz = Math.round((Z1 - Z0) / STEP);
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  const uv = new Float32Array((nx + 1) * (nz + 1) * 2);
  const col = new Float32Array((nx + 1) * (nz + 1) * 3);
  const idx = [];
  const P = PLATEAU;
  const floor = SEA_LEVEL - 2.5;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = X0 + i * STEP, z = Z0 + j * STEP;
    // distance outside the plateau rectangle
    const dx = Math.max(P.x0 - x, 0, x - P.x1), dz = Math.max(P.z0 - z, 0, z - P.z1);
    const d = Math.hypot(dx, dz);
    // wobbly edge so the cliff is not a perfect box
    const wob = (vnoise(x * 0.07, z * 0.07) - 0.5) * 9 + (vnoise(x * 0.23, z * 0.23) - 0.5) * 2.2;
    const e = Math.max(0, d + wob * Math.min(1, d / 6) - 0.5);
    const drop = (P.top - floor) * (1 - Math.exp(-Math.pow(e / 9, 1.35) * 1.6));
    const rough = (vnoise(x * 0.35, z * 0.35) - 0.5) * 1.8 * Math.min(1, e / 3) + (vnoise(x * 0.9, z * 0.9) - 0.5) * 0.6 * Math.min(1, e / 3);
    let y = e <= 0 ? P.top - 0.05 : P.top - drop + rough;
    if (d > 70) y = Math.min(y, floor);
    const k = (j * (nx + 1) + i);
    pos.set([x, y, z], k * 3);
    uv.set([x / 7, z / 7], k * 2);
    // wet, dark rock near the waterline
    const wet = THREE.MathUtils.smoothstep(y, SEA_LEVEL - 0.3, SEA_LEVEL + 2.2);
    const c = 0.35 + 0.65 * wet;
    col.set([c, c, c], k * 3);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = M.rock.clone();
  mat.vertexColors = true;
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'cliff';
  return mesh;
}
