import * as THREE from 'three';

/*
 * The distant view: layered mountain ridges, forested hills and a few clouds, drawn on a large sphere
 * behind the sea. It is a painted backdrop (like a skybox), not geometry: it carries no objects, and it
 * follows the time-of-day presets through the same horizon and zenith colours as the sky and the sea.
 */

const VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * viewMatrix * (modelMatrix * vec4(position, 1.0)); }
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uHorizon, uZenith, uSunDir, uSunColor;
uniform float uTime, uNight, uOvercast, uSunI;

float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h11(i), h11(i + 1.0), f); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm1(float x, int o) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { if (i >= o) break; s += a * n1(x); x *= 2.03; a *= 0.5; } return s; }
float fbm2(vec2 p, int o) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { if (i >= o) break; s += a * n2(p); p *= 2.07; a *= 0.5; } return s; }

// sharp-peaked ridge profile in [0, 1]
float ridge(float x, float seed) {
  float a = 1.0 - abs(2.0 * fbm1(x * 1.0 + seed, 5) - 1.0);
  float b = fbm1(x * 3.7 + seed * 1.7, 4);
  return clamp(a * 0.75 + b * 0.5 - 0.1, 0.0, 1.0);
}

void main() {
  vec3 d = normalize(vDir);
  float elev = asin(clamp(d.y, -1.0, 1.0));
  float phi = atan(d.z, d.x);                       // 0 = east, the open sea the terrace faces
  float lum = 0.35 + 0.65 * smoothstep(-0.15, 0.55, uSunDir.y) * (1.0 - uNight);
  vec3 sunTint = mix(vec3(1.0), uSunColor, 0.35);
  vec3 haze = uHorizon;

  // land fills every direction except a wide open sea to the east
  float away = abs(atan(sin(phi), cos(phi)));       // 0 east .. pi west
  float land = smoothstep(0.7, 1.45, away);         // 0 over the open sea, 1 inland
  vec4 outc = vec4(0.0);

  // ridges, far to near: [base elevation, amplitude, haze, scale, seed]
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float base = mix(0.004, 0.0, fi * 0.2);
    float amp = mix(0.150, 0.016, fi / 3.0);
    float hz = mix(0.74, 0.12, fi / 3.0);
    float freq = mix(2.4, 7.5, fi / 3.0);
    float seed = 11.0 + fi * 17.3;
    float open = (i == 3) ? mix(0.35, 1.0, land) : mix(0.0, 1.0, smoothstep(0.1, 0.9, land + 0.15 * float(i)));
    float top = base + amp * ridge(phi * freq, seed) * open;
    if (i >= 2) top += (fbm1(phi * 420.0 + fi * 9.0, 3) - 0.4) * 0.0014 * open;     // tree-line jitter
    if (elev < top) {
      vec3 col;
      float slope = clamp((top - elev) / max(amp, 0.001), 0.0, 1.0);
      if (i < 2) {
        // mountains: cool grey-blue rock with snow-free pale tops, lit from the sun side
        float lit = 0.55 + 0.45 * clamp(dot(normalize(vec3(cos(phi), 0.4, sin(phi))), uSunDir) * 0.5 + 0.5, 0.0, 1.0);
        col = mix(vec3(0.38, 0.45, 0.58), vec3(0.62, 0.66, 0.72), (1.0 - slope) * 0.7) * lit;
      } else {
        // forested hills: canopy speckle and shaded folds
        float canopy = n2(vec2(phi * 900.0, elev * 900.0) + fi * 31.0);
        float fold = fbm1(phi * 38.0 + fi * 5.0, 4);
        vec3 deep = vec3(0.060, 0.150, 0.075), mid = vec3(0.150, 0.300, 0.130), light = vec3(0.30, 0.46, 0.20);
        col = mix(deep, mid, clamp(fold * 1.5, 0.0, 1.0));
        col = mix(col, light, smoothstep(0.55, 0.9, canopy) * 0.45 * (0.4 + 0.6 * (1.0 - slope)));
        col *= 0.55 + 0.6 * clamp(dot(normalize(vec3(cos(phi), 0.5, sin(phi))), uSunDir) * 0.5 + 0.55, 0.0, 1.2);
      }
      col *= lum;
      col = mix(col, haze, hz);                       // aerial perspective
      outc = vec4(col, 1.0);
    }
  }

  // a few high clouds, lit from below at sunset, fading toward the horizon
  if (elev > 0.025) {
    vec2 p = d.xz / (d.y + 0.22) * 1.1 + vec2(uTime * 0.006, 0.0);
    float c = fbm2(p * 0.9, 5);
    float dens = smoothstep(0.50, 0.74, c) * smoothstep(0.025, 0.22, elev) * (1.0 - uOvercast);
    vec3 cc = mix(haze * 1.1, vec3(1.0), 0.55) * (0.55 + 0.6 * lum) * mix(vec3(1.0), sunTint, 0.6);
    float under = smoothstep(0.62, 0.74, c);                       // thicker cores sit in shade
    cc *= 1.0 - 0.18 * under;
    float a = dens * 0.85 * (1.0 - 0.9 * uNight);
    outc = vec4(mix(outc.rgb, cc, a * (1.0 - outc.a)), max(outc.a, a));
  }
  gl_FragColor = outc;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function buildBackdrop() {
  const uniforms = {
    uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color(1, 1, 1) },
    uTime: { value: 0 }, uNight: { value: 0 }, uOvercast: { value: 0 }, uSunI: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms, side: THREE.BackSide, transparent: true, depthWrite: false, toneMapped: true,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1100, 64, 32), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;
  mesh.name = 'backdrop';
  mesh.userData.noBlueprint = true;
  mesh.raycast = () => {};
  return { mesh, uniforms };
}
