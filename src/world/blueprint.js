import * as THREE from 'three';

/*
 * Blueprint view: the finished rooms dissolve into a neon-blue wireframe of every edge in the plan,
 * over a dark grid floor with a slow scanning pulse and drifting data streaks - a walk through the
 * architect's drawing. It works the same on the desktop and in a headset: the lines are real
 * geometry (camera-facing ribbons with a width in metres), so each eye renders them correctly and no
 * post-processing is needed.
 */

const NEON = new THREE.Color(0.08, 0.62, 1.0);

const LINE_VERT = /* glsl */ `
attribute vec3 iStart;
attribute vec3 iEnd;
uniform float uWidth;
varying vec2 vQ;
varying float vDist;
varying vec3 vWorld;
void main() {
  vec3 ws = (modelMatrix * vec4(iStart, 1.0)).xyz;
  vec3 we = (modelMatrix * vec4(iEnd, 1.0)).xyz;
  vec3 along = we - ws;
  float len = max(length(along), 1e-5);
  vec3 dir = along / len;
  vec3 base = mix(ws, we, position.y);
  vec3 toCam = normalize(cameraPosition - base);
  vec3 side = cross(dir, toCam);
  float sl = length(side);
  side = sl > 1e-4 ? side / sl : normalize(cross(dir, vec3(0.0, 1.0, 0.0)));
  // widen a little with distance so far lines stay visible instead of vanishing below a pixel
  float d = distance(cameraPosition, base);
  float w = uWidth * (1.0 + d * 0.035);
  vec3 p = base + side * position.x * w * 0.5 + dir * (position.y * 2.0 - 1.0) * w * 0.5;
  vQ = vec2(position.x, position.y);
  vDist = d;
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const LINE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uTime;
uniform float uOpacity;
varying vec2 vQ;
varying float vDist;
varying vec3 vWorld;
void main() {
  float edge = 1.0 - smoothstep(0.35, 1.0, abs(vQ.x));
  float fade = exp(-vDist * 0.09);
  // a pulse that sweeps outward from the viewer through the plan
  float ring = abs(fract((vDist - uTime * 2.6) / 7.0) - 0.5) * 2.0;
  float pulse = pow(1.0 - ring, 6.0);
  // slow rise-and-fall scan along the height of the building
  float scan = pow(max(0.0, 1.0 - abs(vWorld.y - (1.6 + 1.7 * sin(uTime * 0.35))) * 1.4), 3.0);
  vec3 col = uColor * (0.55 + 1.6 * pulse + 1.4 * scan) + vec3(0.35, 0.8, 1.0) * (pulse * 0.6 + scan * 0.6);
  gl_FragColor = vec4(col * edge * fade * uOpacity, 1.0);
}
`;

const GRID_VERT = /* glsl */ `
varying vec3 vWorld;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const GRID_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
uniform vec3 uColor;
uniform float uTime;
uniform vec3 uCenter;
uniform float uOpacity;
float line(float v, float w) { float f = abs(fract(v - 0.5) - 0.5) / fwidth(v); return 1.0 - clamp(f / w, 0.0, 1.0); }
void main() {
  vec2 p = vWorld.xz;
  float g1 = max(line(p.x, 1.2), line(p.y, 1.2));
  float g2 = max(line(p.x * 4.0, 0.8), line(p.y * 4.0, 0.8)) * 0.28;
  float d = distance(p, uCenter.xz);
  float fade = exp(-d * 0.11);
  float ring = pow(1.0 - abs(fract((d - uTime * 2.6) / 7.0) - 0.5) * 2.0, 8.0);
  vec3 col = uColor * (g1 * (0.7 + 2.0 * ring) + g2) * fade * uOpacity;
  gl_FragColor = vec4(col, 1.0);
}
`;

const RAIN_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform vec3 uCenter;
varying float vA;
void main() {
  vec3 p = position;
  float speed = 0.5 + aSeed * 1.1;
  // wrap inside a box around the viewer so the streaks are always near
  p.y = mod(p.y - uTime * speed, 6.0);
  p.x = uCenter.x + mod(p.x - uCenter.x + 9.0, 18.0) - 9.0;
  p.z = uCenter.z + mod(p.z - uCenter.z + 9.0, 18.0) - 9.0;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float d = max(-mv.z, 0.2);
  gl_PointSize = clamp(5.0 * (1.5 + aSeed) / d * 3.0, 1.5, 9.0);
  vA = smoothstep(0.0, 0.5, p.y) * (1.0 - smoothstep(5.0, 6.0, p.y)) * exp(-d * 0.12);
  gl_Position = projectionMatrix * mv;
}
`;
const RAIN_FRAG = /* glsl */ `
precision highp float;
varying float vA;
uniform vec3 uColor;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float a = (1.0 - smoothstep(0.1, 0.5, abs(q.x) * 3.0)) * (1.0 - smoothstep(0.35, 0.5, abs(q.y)));
  gl_FragColor = vec4(uColor * 1.6 * a * vA, 1.0);
}
`;

export class Blueprint {
  /**
   * @param roots   () => Object3D[]   everything that makes up the finished rooms (gets edge lines)
   * @param extraHide () => Object3D[] things that are hidden but not outlined (sky, sea)
   * @param center  () => Vector3      where the viewer is (for the sweeping pulse and the drifting streaks)
   */
  constructor({ scene, roots, extraHide = () => [], center, onChange = () => {} }) {
    this.extraHideFn = extraHide;
    this.scene = scene;
    this.rootsFn = roots;
    this.centerFn = center;
    this.onChange = onChange;
    this.active = false;
    this.built = false;
    this.hidden = [];
    this.group = new THREE.Group();
    this.group.name = 'blueprint';
    this.group.visible = false;
    this.group.userData.noBlueprint = true;
    scene.add(this.group);
    this.time = { value: 0 };
    this.opacity = { value: 0 };
    this.target = 0;
    this.lineMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VERT, fragmentShader: LINE_FRAG,
      uniforms: { uWidth: { value: 0.014 }, uColor: { value: NEON.clone() }, uTime: this.time, uOpacity: this.opacity },
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    });
    this.center = { value: new THREE.Vector3() };
    this.savedBackground = null;
    this.savedFog = null;
  }

  /** Extract every visible edge once; the ribbons then follow their meshes, so moved furniture stays correct. */
  build() {
    if (this.built) return;
    const quad = new THREE.BufferGeometry();
    quad.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0]), 3));
    quad.setIndex([0, 1, 2, 2, 1, 3]);
    let total = 0;
    const seen = new Set();
    for (const root of this.rootsFn()) {
      root.traverse((o) => {
        if (!o.isMesh || seen.has(o) || o.userData.noBlueprint || !o.geometry?.attributes.position) return;
        seen.add(o);
        const eg = new THREE.EdgesGeometry(o.geometry, 32);
        const pos = eg.attributes.position;
        const n = pos.count / 2;
        eg.dispose();
        if (!n) return;
        const g = new THREE.InstancedBufferGeometry();
        g.index = quad.index;
        g.setAttribute('position', quad.attributes.position);
        const a = new Float32Array(n * 3), b = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          a[i * 3] = pos.getX(i * 2); a[i * 3 + 1] = pos.getY(i * 2); a[i * 3 + 2] = pos.getZ(i * 2);
          b[i * 3] = pos.getX(i * 2 + 1); b[i * 3 + 1] = pos.getY(i * 2 + 1); b[i * 3 + 2] = pos.getZ(i * 2 + 1);
        }
        g.setAttribute('iStart', new THREE.InstancedBufferAttribute(a, 3));
        g.setAttribute('iEnd', new THREE.InstancedBufferAttribute(b, 3));
        g.instanceCount = n;
        const ribbons = new THREE.Mesh(g, this.lineMat);
        ribbons.frustumCulled = false;
        ribbons.renderOrder = 30;
        ribbons.raycast = () => {};
        ribbons.userData.noBlueprint = true;
        ribbons.userData.noAO = true;
        // a sibling, not a child: the mesh itself is hidden while the blueprint shows, and children would go with it
        ribbons.matrixAutoUpdate = false;
        ribbons.matrix.copy(o.matrix);
        (o.parent || this.scene).add(ribbons);
        total += n;
      });
    }
    this.edgeCount = total;

    // floor grid
    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({
        vertexShader: GRID_VERT, fragmentShader: GRID_FRAG, extensions: { derivatives: true },
        uniforms: { uColor: { value: NEON.clone() }, uTime: this.time, uCenter: this.center, uOpacity: this.opacity },
        transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }),
    );
    grid.position.set(7, 0.004, -4);
    grid.renderOrder = 28;
    grid.frustumCulled = false;
    grid.raycast = () => {};
    grid.userData.noBlueprint = true; grid.userData.noAO = true;
    this.group.add(grid);

    // drifting data streaks
    const N = 1400;
    const p = new Float32Array(N * 3), s = new Float32Array(N);
    let seed = 7;
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < N; i++) { p.set([r() * 18, r() * 6, r() * 18], i * 3); s[i] = r(); }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    rg.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
    const rain = new THREE.Points(rg, new THREE.ShaderMaterial({
      vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG,
      uniforms: { uTime: this.time, uCenter: this.center, uColor: { value: NEON.clone() } },
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    rain.frustumCulled = false;
    rain.renderOrder = 29;
    rain.raycast = () => {};
    rain.userData.noBlueprint = true; rain.userData.noAO = true;
    this.group.add(rain);
    this.built = true;
  }

  set(on) {
    if (on === this.active) return;
    if (on) {
      this.build();
      this.hidden = [];
      for (const root of this.rootsFn()) {
        root.traverse((o) => { if (o.isMesh && !o.userData.noBlueprint && o.visible) { o.visible = false; this.hidden.push(o); } });
      }
      for (const root of this.extraHideFn()) root.traverse((o) => { if (o.isMesh && o.visible) { o.visible = false; this.hidden.push(o); } });
      this.savedBackground = this.scene.background;
      this.scene.background = new THREE.Color(0x00040d);
      this.group.visible = true;
    } else {
      for (const o of this.hidden) o.visible = true;
      this.hidden = [];
      this.scene.background = this.savedBackground;
      this.group.visible = false;
    }
    this.active = on;
    this.target = on ? 1 : 0;
    this.onChange(on);
  }

  toggle() { this.set(!this.active); }

  update(dt, t) {
    this.time.value = t;
    this.centerFn(this.center.value);
    const k = Math.min(1, dt * 2.2);
    this.opacity.value += (this.target - this.opacity.value) * k;
  }
}
