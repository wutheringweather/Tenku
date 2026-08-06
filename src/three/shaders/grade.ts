import type { IUniform } from 'three';

/**
 * The last pass. Everything here exists to make the render read as a captured
 * image rather than a real-time buffer: a lens (aberration + vignette), a
 * sensor (grain), and a print (lift/gain shaping toward brass highlights and
 * indigo shadows).
 */
export const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 1.05 },
    uGrain: { value: 0.035 },
    uAberration: { value: 0.0016 },
    uLift: { value: 0.014 },
    uSaturation: { value: 1.07 },
    uFlash: { value: 0.0 },
  } as Record<string, IUniform>,

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uLift;
    uniform float uSaturation;
    uniform float uFlash;

    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 centre = uv - 0.5;
      float r2 = dot(centre, centre);

      // Chromatic aberration scales with distance from centre, like a real lens.
      vec2 offset = centre * uAberration * (0.35 + r2 * 2.6);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + offset).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - offset).b;

      // Print shaping: lift the shadows toward indigo, pull highlights to brass.
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col += vec3(0.02, 0.024, 0.055) * uLift * (1.0 - luma) * 14.0;
      col = mix(col, col * vec3(1.045, 1.005, 0.93), smoothstep(0.55, 1.0, luma));

      // Saturation.
      col = mix(vec3(luma), col, uSaturation);

      // Vignette.
      float vig = 1.0 - smoothstep(0.22, 0.92, r2 * uVignette * 2.0);
      col *= mix(0.62, 1.0, vig);

      // Grain, animated per frame, stronger in the shadows where sensors are noisy.
      float g = hash(uv * vec2(1920.0, 1080.0) + fract(uTime) * 91.7) - 0.5;
      col += g * uGrain * (1.25 - luma);

      // Transition flash, driven from the camera rig.
      col += vec3(1.0, 0.86, 0.62) * uFlash;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
