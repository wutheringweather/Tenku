import * as THREE from 'three';
import { skyFrag, skyVert } from '../shaders/sky';

export class Sky {
  readonly mesh: THREE.Mesh;
  readonly sunDirection = new THREE.Vector3(-0.42, 0.14, -0.9).normalize();

  private readonly material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color(0x2f78cc) },
        uHorizon: { value: new THREE.Color(0x9dd3f0) },
        uGround: { value: new THREE.Color(0x0a141c) },
        uSunColor: { value: new THREE.Color(0xfff4d6) },
        uSunDir: { value: this.sunDirection.clone() },
        uTime: { value: 0 },
        uIntensity: { value: 0 },
      },
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1600, 48, 32), this.material);
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'sky';
  }

  /** Directional light matched to the shader's sun so lighting and sky agree. */
  createSun() {
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.5);
    sun.position.copy(this.sunDirection).multiplyScalar(400);
    sun.name = 'sun';
    return sun;
  }

  /** 0 → 1 sunrise used by the materialisation sequence. */
  set intensity(v: number) {
    this.material.uniforms.uIntensity.value = v;
  }

  update(time: number) {
    this.material.uniforms.uTime.value = time;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
