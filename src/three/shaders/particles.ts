export const starVert = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;

attribute float aPhase;
attribute float aScale;
attribute vec3  aTint;

varying float vAlpha;
varying vec3  vTint;

void main() {
  vTint = aTint;

  // Independent twinkle per star, with a slow secondary beat so the field
  // never settles into a visible rhythm.
  float t = sin(uTime * 0.9 + aPhase * 6.2831) * 0.5 + 0.5;
  float t2 = sin(uTime * 0.21 + aPhase * 12.7) * 0.5 + 0.5;
  vAlpha = mix(0.25, 1.0, t * 0.65 + t2 * 0.35);

  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * aScale * uPixelRatio * (1.0 + vAlpha * 0.5);
}
`;

export const starFrag = /* glsl */ `
precision mediump float;
varying float vAlpha;
varying vec3  vTint;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  float glow = pow(core, 3.0);
  gl_FragColor = vec4(vTint * (0.5 + glow), core * vAlpha);
}
`;

/* ------------------------------------------------------------------ */

export const moteVert = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uReveal;

attribute float aPhase;
attribute float aSpeed;
attribute float aRadius;
attribute float aScale;
attribute vec3  aTint;

varying float vAlpha;
varying vec3  vTint;

void main() {
  vTint = aTint;

  vec3 pos = position;

  // Lazy figure-eight drift: two orthogonal sines at incommensurate rates so
  // no two motes ever trace the same path.
  float t = uTime * aSpeed + aPhase * 6.2831;
  pos.x += sin(t) * aRadius;
  pos.z += sin(t * 1.37 + 1.1) * aRadius * 0.8;
  pos.y += sin(t * 0.63 + 2.3) * aRadius * 0.55;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mv.z;

  vAlpha = (0.30 + 0.70 * (sin(t * 1.9) * 0.5 + 0.5)) * uReveal;
  vAlpha *= smoothstep(600.0, 120.0, dist);

  gl_Position = projectionMatrix * mv;
  gl_PointSize = aScale * uPixelRatio * (260.0 / max(dist, 1.0));
}
`;

export const moteFrag = /* glsl */ `
precision mediump float;
varying float vAlpha;
varying vec3  vTint;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(vTint * (0.7 + core * 1.6), core * vAlpha);
}
`;

/* ------------------------------------------------------------------ */

/** Ring of debris orbiting each island. Angular position is computed on the GPU. */
export const ringVert = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uReveal;
uniform float uSelect;

attribute float aAngle;
attribute float aRadius;
attribute float aSpeed;
attribute float aTilt;
attribute float aScale;

varying float vAlpha;

void main() {
  float a = aAngle + uTime * aSpeed;
  vec3 pos = vec3(cos(a) * aRadius, 0.0, sin(a) * aRadius);

  // Tilt each particle's own orbital plane a little.
  float ct = cos(aTilt), st = sin(aTilt);
  pos.y = pos.z * st;
  pos.z = pos.z * ct;

  // Ring collapses inward before it is revealed.
  pos *= mix(0.1, 1.0, clamp(uReveal, 0.0, 1.0));

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mv.z;

  vAlpha = uReveal * (0.35 + uSelect * 0.65) * smoothstep(700.0, 60.0, dist);

  gl_Position = projectionMatrix * mv;
  gl_PointSize = aScale * uPixelRatio * (170.0 / max(dist, 1.0));
}
`;

export const ringFrag = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
varying float vAlpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor * (0.8 + core), core * vAlpha);
}
`;
