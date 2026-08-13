import * as THREE from 'three';
import { moteFrag, moteVert } from '../shaders/particles';
import { aetherFrag, aetherVert } from '../shaders/aether';
import { rng } from '@/lib/math';

/** Slow-drifting light motes that fill the space between islands. */
export class Motes {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;

  constructor(count = 900, spread = 220, seed = 0xbeef) {
    const rand = rng(seed);

    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    const radii = new Float32Array(count);
    const scales = new Float32Array(count);
    const tints = new Float32Array(count * 3);

    const warm = new THREE.Color(0xffc98a);
    const cool = new THREE.Color(0x9fd68a);
    const brass = new THREE.Color(0xf4c56a);

    for (let i = 0; i < count; i++) {
      // Disc distribution — motes belong to the archipelago, not the void above.
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * spread;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = (rand() - 0.35) * 90;
      positions[i * 3 + 2] = Math.sin(a) * r;

      phases[i] = rand();
      speeds[i] = 0.06 + rand() * 0.24;
      radii[i] = 1.4 + rand() * 7.5;
      scales[i] = 0.9 + Math.pow(rand(), 3) * 4.2;

      const pick = rand();
      const c = pick < 0.55 ? warm : pick < 0.85 ? brass : cool;
      tints[i * 3] = c.r;
      tints[i * 3 + 1] = c.g;
      tints[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geo.setAttribute('aTint', new THREE.BufferAttribute(tints, 3));

    this.material = new THREE.ShaderMaterial({
      vertexShader: moteVert,
      fragmentShader: moteFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uReveal: { value: 0 },
      },
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.name = 'motes';
  }

  setPixelRatio(ratio: number) {
    this.material.uniforms.uPixelRatio.value = ratio;
  }

  set reveal(v: number) {
    this.material.uniforms.uReveal.value = v;
  }

  update(time: number) {
    this.material.uniforms.uTime.value = time;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

/** The cloud sea the archipelago floats above. */
export class AetherSea {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: aetherVert,
      fragmentShader: aetherFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(0x0d2410) },
        uCrest: { value: new THREE.Color(0x4a7a35) },
        uRim: { value: new THREE.Color(0xcfe36a) },
        uReveal: { value: 0 },
      },
    });

    const geo = new THREE.PlaneGeometry(1600, 1600, 160, 160);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = -74;
    this.mesh.renderOrder = -500;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'aether';
  }

  set reveal(v: number) {
    this.material.uniforms.uReveal.value = v;
  }

  update(time: number) {
    this.material.uniforms.uTime.value = time;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
