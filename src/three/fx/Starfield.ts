import * as THREE from 'three';
import { starFrag, starVert } from '../shaders/particles';
import { rng } from '@/lib/math';

export class Starfield {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;

  constructor(count = 2600, radius = 1200, seed = 0xa11ce) {
    const rand = rng(seed);

    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const scales = new Float32Array(count);
    const tints = new Float32Array(count * 3);

    // Three stellar classes, warm to cold, so the field has depth of colour.
    const classes = [
      new THREE.Color(0xfff0dc),
      new THREE.Color(0xc9d8ff),
      new THREE.Color(0xffcfa0),
    ];

    for (let i = 0; i < count; i++) {
      // Bias toward the upper hemisphere — below the archipelago is cloud, not sky.
      const u = rand();
      const v = rand() * 0.82 + 0.09;
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const r = radius * (0.72 + rand() * 0.28);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.62 + 120;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      phases[i] = rand();
      // Heavy tail: a few bright anchors among many faint stars.
      scales[i] = 0.35 + Math.pow(rand(), 5) * 3.4;

      const c = classes[Math.floor(rand() * classes.length)];
      tints[i * 3] = c.r;
      tints[i * 3 + 1] = c.g;
      tints[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geo.setAttribute('aTint', new THREE.BufferAttribute(tints, 3));

    this.material = new THREE.ShaderMaterial({
      vertexShader: starVert,
      fragmentShader: starFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 2.2 },
        uPixelRatio: { value: 1 },
      },
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = -900;
    this.points.name = 'starfield';
  }

  setPixelRatio(ratio: number) {
    this.material.uniforms.uPixelRatio.value = ratio;
  }

  update(time: number) {
    this.material.uniforms.uTime.value = time;
    // Very slow rotation. Enough to feel alive across a minute, invisible per frame.
    this.points.rotation.y = time * 0.004;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
