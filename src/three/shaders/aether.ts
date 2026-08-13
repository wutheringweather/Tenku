export const aetherVert = /* glsl */ `
uniform float uTime;
varying vec2  vUv;
varying vec3  vWorld;

void main() {
  vUv = uv;
  vec3 pos = position;
  // Very low frequency swell so the surface never reads as a flat plane.
  pos.z += sin(pos.x * 0.014 + uTime * 0.12) * 2.4
         + cos(pos.y * 0.011 - uTime * 0.09) * 2.0;
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * A grass sea rather than water: layered fbm advected in two directions at
 * different speeds, with the sunlit rim colour picking out the crests. A
 * second, elongated noise layer adds fine directional grain on top so the
 * field reads as blades of grass rather than smooth cloud. Fades to fully
 * transparent at the far edge so it never terminates on a hard line.
 */
export const aetherFrag = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3  uDeep;
uniform vec3  uCrest;
uniform vec3  uRim;
uniform float uReveal;

varying vec2 vUv;
varying vec3 vWorld;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.03;
    a *= 0.5;
  }
  return v;
}

// Elongated, high-frequency streaks — stretched far more on one axis than
// the other so the noise reads as individual grass blades rather than a
// uniform grain.
float blades(vec2 p) {
  vec2 q1 = vec2(p.x * 52.0, p.y * 6.0);
  vec2 q2 = vec2(p.x * 41.0 + 30.0, p.y * 5.4 - 12.0) * 1.3;
  float n1 = noise(q1);
  float n2 = noise(q2);
  return mix(n1, n2, 0.5);
}

void main() {
  vec2 p = vWorld.xz * 0.011;

  float a = fbm(p + vec2(uTime * 0.018, uTime * 0.010));
  float b = fbm(p * 1.9 - vec2(uTime * 0.030, uTime * 0.016));
  float f = a * 0.65 + b * 0.35;

  float crest = smoothstep(0.52, 0.78, f);
  float deep  = smoothstep(0.18, 0.55, f);

  vec3 col = mix(uDeep, uCrest, deep);
  col = mix(col, uRim, crest * 0.4);

  // Blade grain, gently drifting as if stirred by wind.
  float wind = uTime * 0.05;
  float bl = blades(p * 2.6 + vec2(wind, wind * 0.6)) - 0.5;
  col += uCrest * bl * 0.30 * deep;
  col += uRim * max(bl, 0.0) * 0.16 * crest;

  // Thin filaments where the layers disagree — reads as wind shear.
  float shear = smoothstep(0.02, 0.0, abs(a - b) - 0.015);
  col += uRim * shear * 0.2;

  // Radial fade so the plane dissolves instead of ending.
  float d = length(vWorld.xz);
  float edge = 1.0 - smoothstep(360.0, 760.0, d);
  float centre = smoothstep(0.0, 90.0, d);

  float alpha = (0.16 + crest * 0.42 + deep * 0.14) * edge * centre * uReveal;

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;
