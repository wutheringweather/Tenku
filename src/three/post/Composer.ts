import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GradeShader } from '../shaders/grade';

export interface QualitySettings {
  bloom: boolean;
  grade: boolean;
  pixelRatioCap: number;
}

export class Composer {
  readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;
  private readonly renderPass: RenderPass;
  private readonly output: OutputPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    size: { width: number; height: number },
    quality: QualitySettings,
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.setSize(size.width, size.height);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.72, // strength — enough to make the monoliths read as light sources
      0.62, // radius
      0.22, // threshold — keeps the rock out of the bloom
    );
    this.bloom.enabled = quality.bloom;
    this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(GradeShader);
    this.grade.enabled = quality.grade;
    this.composer.addPass(this.grade);

    this.output = new OutputPass();
    this.composer.addPass(this.output);
  }

  setQuality(quality: QualitySettings) {
    this.bloom.enabled = quality.bloom;
    this.grade.enabled = quality.grade;
  }

  setSize(width: number, height: number) {
    this.composer.setSize(width, height);
    this.bloom.setSize(width, height);
  }

  update(time: number, flash: number) {
    this.grade.uniforms.uTime.value = time;
    this.grade.uniforms.uFlash.value = flash;
  }

  render(dt: number) {
    this.composer.render(dt);
  }

  dispose() {
    this.bloom.dispose();
    this.grade.dispose?.();
    this.composer.dispose();
  }
}
