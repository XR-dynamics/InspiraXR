import * as THREE from 'three';

/*
 * Parallax-corrected (box-projected) image based lighting. Each room's probe
 * is re-projected onto the room's bounding box so glossy surfaces — the
 * honed stone floor in particular — reflect windows, walls and furniture in
 * the right place instead of as if they were infinitely far away.
 */

const CHUNK = THREE.ShaderChunk.envmap_physical_pars_fragment.replace(
  'reflectVec = inverseTransformDirection( reflectVec, viewMatrix );',
  'reflectVec = inverseTransformDirection( reflectVec, viewMatrix );\n\t\t\treflectVec = bpCorrect( reflectVec );',
);

const DECL = /* glsl */ `
uniform vec3 bpMin;
uniform vec3 bpMax;
uniform vec3 bpProbe;
varying vec3 vBPWorld;
vec3 bpCorrect( vec3 v ) {
  vec3 p = vBPWorld;
  if ( any( lessThan( p, bpMin - 0.05 ) ) || any( greaterThan( p, bpMax + 0.05 ) ) ) return v;
  vec3 d = normalize( v );
  vec3 t1 = ( bpMax - p ) / d;
  vec3 t2 = ( bpMin - p ) / d;
  vec3 tf = max( t1, t2 );
  float t = min( min( tf.x, tf.y ), tf.z );
  if ( t <= 0.0 ) return v;
  return normalize( p + d * t - bpProbe );
}
`;

export function applyBoxProjection(material, min, max, probe) {
  const uniforms = {
    bpMin: { value: new THREE.Vector3(...min) },
    bpMax: { value: new THREE.Vector3(...max) },
    bpProbe: { value: new THREE.Vector3(...probe) },
  };
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 vBPWorld;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n\tvBPWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;',
    );
    shader.fragmentShader = DECL + shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>', CHUNK);
  };
  material.customProgramCacheKey = () => 'boxproj';
  material.needsUpdate = true;
}
