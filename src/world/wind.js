import * as THREE from 'three';

/*
 * A gentle breeze for cloth. Curtain materials get a vertex-shader sway: the head of the curtain is
 * fixed to its rail and the hem moves most, billowing toward the room with slow gusts. All curtains
 * share two uniforms, so there is one time source and one switch (WIND.strength).
 */
export const WIND = {
  time: { value: 0 },
  strength: { value: 1 },
};

/** Clone `base` with wind sway. `dir` is the horizontal direction (x, z) the cloth billows into the room. */
export function windMaterial(base, { dir = [0, 1], amp = 0.1, top = 3, bottom = 0 } = {}) {
  const m = base.clone();
  const u = {
    uWindT: WIND.time, uWindK: WIND.strength,
    uWindDir: { value: new THREE.Vector2(dir[0], dir[1]) },
    uWindAmp: { value: amp }, uWindTop: { value: top }, uWindBottom: { value: bottom },
  };
  m.userData.windUniforms = u;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uWindT; uniform float uWindK; uniform vec2 uWindDir;
        uniform float uWindAmp; uniform float uWindTop; uniform float uWindBottom;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float h = clamp((uWindTop - position.y) / max(uWindTop - uWindBottom, 0.01), 0.0, 1.0);
          float sway = h * h * (0.4 + 0.6 * h);
          float gust = 0.55 + 0.45 * sin(uWindT * 0.42 + position.x * 0.17 + position.z * 0.11);
          float w = sin(uWindT * 1.55 + position.x * 2.1 + position.z * 1.7 + h * 2.2) * 0.5
                  + sin(uWindT * 2.7 + position.x * 3.3 - position.z * 2.3 + h * 4.0) * 0.28
                  + sin(uWindT * 0.8 + position.x * 0.9 + position.z * 0.8) * 0.5;
          float d = (0.55 + 0.45 * w) * gust * sway * uWindAmp * uWindK;
          transformed.x += uWindDir.x * d;
          transformed.z += uWindDir.y * d;
          transformed.y -= abs(d) * 0.12;
        }`);
  };
  m.customProgramCacheKey = () => 'wind-sway-v1';
  return m;
}
