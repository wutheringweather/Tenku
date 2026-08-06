export const bridgeVert = /* glsl */ `
uniform float uTime;
varying vec2  vUv;
varying vec3  vNormalW;
varying vec3  vViewDir;

void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * Filaments running from the hub to each island. A pulse travels outward at a
 * cadence derived from how recently that repo was pushed — dormant repos idle,
 * active ones fire fast. The bridge itself is mostly transparent; the pulse is
 * the thing you see.
 */
export const bridgeFrag = /* glsl */ `
precision highp float;

uniform vec3  uColor;
uniform float uTime;
uniform float uReveal;
uniform float uSelect;
uniform float uCadence;

varying vec2  vUv;
varying vec3  vNormalW;
varying vec3  vViewDir;

void main() {
  // Length along the tube.
  float u = vUv.x;

  // Grow from the hub outward on reveal.
  float grown = step(u, uReveal);

  float fres = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), 2.0);

  // Travelling pulse.
  float phase = fract(u - uTime * uCadence);
  float pulse = pow(smoothstep(0.86, 1.0, phase), 3.0);

  // A second, slower pulse offset by half, only visible when selected.
  float phase2 = fract(u - uTime * uCadence * 0.5 + 0.5);
  float pulse2 = pow(smoothstep(0.92, 1.0, phase2), 4.0) * uSelect;

  float base = 0.035 + uSelect * 0.10;
  float alpha = (base + pulse * 0.55 + pulse2 * 0.4 + fres * 0.12) * grown;

  // Fade out near the island end so it never terminates abruptly.
  alpha *= smoothstep(1.0, 0.92, u);

  vec3 col = uColor * (0.4 + pulse * 2.2 + pulse2 * 1.6 + fres * 0.5);

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;
