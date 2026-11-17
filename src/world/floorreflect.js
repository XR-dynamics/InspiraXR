import * as THREE from 'three';

/*
 * Glossy floor reflections. Every frame (desktop only) the scene is rendered once more from the camera mirrored in
 * the floor plane into a half-resolution, mip-mapped target; floor materials add it to their shading with a
 * Fresnel term, blurred by their own roughness (rougher wood = softer, polished stone = crisper) and wobbled by
 * their normal map. Only up-facing surfaces at floor height use it, so a shared material on a wall or a table is
 * left alone. Strength follows the time of day (LOOK.modes.*.mirror); VR and the low preset skip it entirely.
 */

const VERT_DECL = 'uniform mat4 uReflMatrix;\nvarying vec4 vReflUv;\nvarying vec3 vReflWorld;\nvarying vec3 vReflWN;\n';
const FRAG_DECL = 'uniform sampler2D tReflect;\nuniform float uReflStrength;\nuniform float uReflMaxLod;\nvarying vec4 vReflUv;\nvarying vec3 vReflWorld;\nvarying vec3 vReflWN;\n';

export class FloorReflection {
  constructor(renderer, scene, camera, { y = 0, scale = 0.5 } = {}) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.y = y; this.scale = scale;
    this.rt = new THREE.WebGLRenderTarget(16, 16, {
      type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    });
    this.mirror = new THREE.PerspectiveCamera();
    this.uniforms = {
      tReflect: { value: this.rt.texture }, uReflMatrix: { value: new THREE.Matrix4() },
      uReflStrength: { value: 0 }, uReflMaxLod: { value: 5 },
    };
    this.materials = new Set();
    this.hidden = [];
    this.enabled = true;
    this._v = { plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), q: new THREE.Vector4(), clip: new THREE.Vector4() };
  }

  /** Give a material the reflection (call once per material, after any other onBeforeCompile hooks). */
  add(material) {
    if (!material || this.materials.has(material)) return;
    this.materials.add(material);
    const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey?.bind(material);
    const U = this.uniforms;
    material.onBeforeCompile = (shader, r) => {
      prev?.call(material, shader, r);
      Object.assign(shader.uniforms, U);
      shader.vertexShader = VERT_DECL + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  vec4 reflW = modelMatrix * vec4( transformed, 1.0 );
  vReflWorld = reflW.xyz; vReflUv = uReflMatrix * reflW;
  vReflWN = normalize( mat3( modelMatrix ) * objectNormal );`);
      shader.fragmentShader = FRAG_DECL + shader.fragmentShader.replace('#include <opaque_fragment>', `{
    // planar reflection: only on up-facing surfaces at floor level
    float onFloor = smoothstep( 0.92, 0.99, vReflWN.y ) * ( 1.0 - smoothstep( 0.02, 0.08, abs( vReflWorld.y - ${y.toFixed(3)} ) ) );
    if ( onFloor > 0.0 && uReflStrength > 0.0 ) {
      vec2 ruv = vReflUv.xy / vReflUv.w + ( normal.xy - vec3( 0.0, 0.0, 1.0 ).xy ) * 0.03;
      float lod = clamp( roughnessFactor * roughnessFactor * 9.0, 0.0, uReflMaxLod );
      vec3 refl = textureLod( tReflect, ruv, lod ).rgb;
      float fres = 0.04 + 0.96 * pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 5.0 );
      float gloss = 1.0 - smoothstep( 0.15, 0.75, roughnessFactor );
      outgoingLight += refl * uReflStrength * onFloor * gloss * mix( 0.12, 1.0, fres );
    }
  }
  #include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|floorrefl`;
    material.needsUpdate = true;
  }

  /** Floor meshes are hidden while the mirror view renders (a floor must not reflect itself). */
  setHidden(meshes) { this.hidden = meshes; }

  resize() {
    const s = this.renderer.getDrawingBufferSize(new THREE.Vector2()).multiplyScalar(this.scale);
    const w = Math.max(16, Math.round(s.x)), h = Math.max(16, Math.round(s.y));
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
    this.uniforms.uReflMaxLod.value = Math.floor(Math.log2(Math.max(w, h))) - 2;
  }

  /** Render the mirrored view. `strength` 0 skips the work entirely. */
  update(strength) {
    this.uniforms.uReflStrength.value = this.enabled ? strength : 0;
    if (!this.enabled || strength <= 0.001) return;
    const cam = this.camera, m = this.mirror, { plane, q, clip } = this._v;
    this.resize();
    // mirror the camera in the floor plane (as THREE.Reflector does)
    cam.updateMatrixWorld();
    const camPos = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    if (camPos.y < this.y) { this.uniforms.uReflStrength.value = 0; return; }
    const target = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion())).add(camPos);
    const reflect = (v) => v.clone().setY(2 * this.y - v.y);
    m.position.copy(reflect(camPos));
    m.up.set(0, 1, 0).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
    m.up.y = -m.up.y;   // the up vector reflected in the floor
    m.lookAt(reflect(target));
    m.far = cam.far; m.near = cam.near;
    m.projectionMatrix.copy(cam.projectionMatrix);
    m.updateMatrixWorld();
    m.matrixWorldInverse.copy(m.matrixWorld).invert();
    // texture matrix: world -> mirror clip -> [0,1]
    this.uniforms.uReflMatrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(m.projectionMatrix).multiply(m.matrixWorldInverse);
    // oblique near plane so nothing below the floor leaks into the reflection
    plane.applyMatrix4(m.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = m.projectionMatrix;
    q.x = (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0];
    q.y = (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1.0;
    q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    clip.multiplyScalar(2.0 / clip.dot(q));
    pm.elements[2] = clip.x; pm.elements[6] = clip.y; pm.elements[10] = clip.z + 1.0; pm.elements[14] = clip.w;
    plane.set(new THREE.Vector3(0, 1, 0), -this.y);
    // render
    const r = this.renderer, prevRT = r.getRenderTarget(), prevXr = r.xr.enabled, prevShadow = r.shadowMap.autoUpdate;
    this.hidden.forEach((o) => { o.userData._rv = o.visible; o.visible = false; });
    r.xr.enabled = false; r.shadowMap.autoUpdate = false;
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(this.scene, m);
    r.setRenderTarget(prevRT);
    r.xr.enabled = prevXr; r.shadowMap.autoUpdate = prevShadow;
    this.hidden.forEach((o) => { o.visible = o.userData._rv; });
  }
}
