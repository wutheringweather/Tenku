export const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

/**
 * A dusk gradient built from three stops rather than two, so the horizon keeps
 * a warm band instead of blending straight from navy to orange. The sun is a
 * soft disk with a wide bloom skirt; a slow noise field adds cloud banding that
 * reads as atmosphere without ever resolving into recognisable shapes.
 */
export const skyFrag = /* glsl */ `
precision highp float;

uniform vec3  uZenith;
uniform vec3  uHorizon;
uniform vec3  uGround;
uniform vec3  uSunColor;
uniform vec3  uSunDir;
uniform float uTime;
uniform float uIntensity;

varying vec3 vDir;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;

  // Three-stop vertical gradient.
  vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.62, h));
  col = mix(uGround, col, smoothstep(-0.30, 0.02, h));

  // Sun disk plus a wide, cheap scatter skirt.
  float sun = max(dot(dir, normalize(uSunDir)), 0.0);
  float disk = smoothstep(0.9975, 0.9995, sun);
  float skirt = pow(sun, 26.0) * 0.55 + pow(sun, 6.0) * 0.14;
  col += uSunColor * (disk * 2.6 + skirt) * uIntensity;

  // Slow cloud banding, stretched horizontally so it reads as distance.
  float band = fbm(vec3(dir.x * 2.4, dir.y * 5.5 - uTime * 0.012, dir.z * 2.4 + uTime * 0.02));
  float mask = smoothstep(-0.05, 0.42, h) * (1.0 - smoothstep(0.45, 0.95, h));
  col += (band - 0.5) * 0.075 * mask * mix(uHorizon, uSunColor, 0.4);

  // Dither to kill banding on the long gradient.
  col += (hash(vec3(gl_FragCoord.xy, uTime * 0.0)) - 0.5) * 0.008;

  gl_FragColor = vec4(col, 1.0);
}
`;
