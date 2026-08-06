export const crystalVert = /* glsl */ `
uniform float uTime;
uniform float uReveal;   // 0..1 materialisation progress
uniform float uSelect;   // 0..1 selection weight

varying vec3  vNormalW;
varying vec3  vViewDir;
varying vec3  vLocal;
varying float vHeight;

void main() {
  vLocal = position;
  vHeight = clamp(position.y, 0.0, 1.0);

  vec3 pos = position;

  // Rise out of the void, twisting slightly as it settles.
  float r = clamp(uReveal, 0.0, 1.0);
  float twist = (1.0 - r) * 2.4;
  float c = cos(twist * position.y);
  float s = sin(twist * position.y);
  pos.xz = mat2(c, -s, s, c) * pos.xz;
  pos.y *= mix(0.02, 1.0, r);

  // Breathing pulse, stronger when selected.
  float breathe = sin(uTime * 1.35 + position.y * 2.0) * 0.012 * (0.4 + uSelect);
  pos.xz *= 1.0 + breathe;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - worldPos.xyz);

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

/**
 * Not glass and not neon: the monoliths read as lit mineral. A fresnel rim in the
 * language colour, horizontal strata that drift upward like sediment settling,
 * and a warm core that brightens on selection.
 */
export const crystalFrag = /* glsl */ `
precision highp float;

uniform vec3  uColor;
uniform vec3  uCore;
uniform float uTime;
uniform float uReveal;
uniform float uSelect;
uniform float uHover;

varying vec3  vNormalW;
varying vec3  vViewDir;
varying vec3  vLocal;
varying float vHeight;

void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(vViewDir);

  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.4);

  // Sediment strata rising through the body.
  float strata = sin(vLocal.y * 26.0 - uTime * 0.9) * 0.5 + 0.5;
  strata = pow(strata, 3.0) * 0.35;

  // Vertical falloff so the base stays anchored and dark.
  float grad = smoothstep(0.0, 0.85, vLocal.y);

  vec3 col = uCore * (0.10 + grad * 0.30);
  col += uColor * (fres * (0.85 + uSelect * 1.5 + uHover * 0.6));
  col += uColor * strata * (0.5 + grad);
  col += uColor * uSelect * 0.45 * grad;

  // Scan line that sweeps up during materialisation.
  float edge = smoothstep(0.06, 0.0, abs(vHeight - uReveal));
  col += uColor * edge * 2.4 * (1.0 - step(0.999, uReveal));

  float alpha = clamp(0.30 + fres * 0.75 + grad * 0.22 + uSelect * 0.2, 0.0, 1.0);
  alpha *= smoothstep(0.0, 0.12, uReveal);

  gl_FragColor = vec4(col, alpha);
}
`;
