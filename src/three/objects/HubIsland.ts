import * as THREE from 'three';
import type { ActivityDay } from '../types';
import { crystalFrag, crystalVert } from '../shaders/crystal';
import { clamp, damp, easeOutCubic, rng } from '@/lib/math';

/**
 * The centre of the world: the profile itself.
 *
 * The obelisk scales with total stars. Around it, one pillar per day of public
 * activity over the last 90 days, arranged as a clock — today at twelve, ninety
 * days ago just behind it. Height and glow follow that day's intensity.
 */
export class HubIsland {
  readonly group = new THREE.Group();
  readonly labelAnchor = new THREE.Vector3();
  /** Screen-space anchor for the "today" marker. */
  readonly todayAnchor = new THREE.Vector3();

  private readonly obelisk: THREE.Mesh;
  private readonly obeliskMat: THREE.ShaderMaterial;
  private readonly plate: THREE.Mesh;
  private readonly root: THREE.Mesh;
  private readonly pillars: THREE.InstancedMesh;
  private readonly pillarHeights: Float32Array;
  private readonly pillarAngles: Float32Array;
  private readonly halo: THREE.Mesh;
  private readonly key: THREE.PointLight;

  private readonly dummy = new THREE.Object3D();
  private readonly tint = new THREE.Color();
  private readonly obeliskHeight: number;
  private readonly reducedMotion: boolean;

  private reveal = 0;
  private revealTarget = 0;

  constructor(activity: ActivityDay[], totalStars: number, reducedMotion = false) {
    const rand = rng(0xc0ffee);
    this.reducedMotion = reducedMotion;
    this.group.name = 'hub';

    const brass = new THREE.Color(0xc9a227);
    const ember = new THREE.Color(0xff8a4c);

    /* ---------------- root and plate ---------------- */

    const rootGeo = new THREE.ConeGeometry(15, 46, 9, 3);
    const rp = rootGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < rp.count; i++) {
      const y = rp.getY(i);
      const j = 1 + (rand() - 0.5) * 0.26;
      rp.setX(i, rp.getX(i) * j);
      rp.setZ(i, rp.getZ(i) * j);
      rp.setY(i, y);
    }
    rootGeo.computeVertexNormals();
    this.root = new THREE.Mesh(
      rootGeo,
      new THREE.MeshStandardMaterial({
        color: 0x171d33,
        roughness: 0.94,
        metalness: 0.08,
        flatShading: true,
      }),
    );
    this.root.rotation.z = Math.PI;
    this.root.position.y = -23;
    this.group.add(this.root);

    const plateGeo = new THREE.CylinderGeometry(17, 15.4, 2.6, 48, 1);
    this.plate = new THREE.Mesh(
      plateGeo,
      new THREE.MeshStandardMaterial({
        color: 0x232a47,
        roughness: 0.42,
        metalness: 0.55,
        emissive: brass.clone().multiplyScalar(0.05),
      }),
    );
    this.group.add(this.plate);

    /* ---------------- obelisk ---------------- */

    this.obeliskHeight = 26 + Math.log10(1 + totalStars) * 11;

    const obGeo = new THREE.CylinderGeometry(0.06, 0.34, 1, 4, 5, false);
    obGeo.translate(0, 0.5, 0);
    obGeo.rotateY(Math.PI / 4);

    this.obeliskMat = new THREE.ShaderMaterial({
      vertexShader: crystalVert,
      fragmentShader: crystalFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: brass.clone() },
        uCore: { value: ember.clone() },
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uSelect: { value: 0.35 },
        uHover: { value: 0 },
      },
    });

    this.obelisk = new THREE.Mesh(obGeo, this.obeliskMat);
    this.obelisk.scale.set(11, this.obeliskHeight, 11);
    this.obelisk.position.y = 1.3;
    this.obelisk.renderOrder = 12;
    this.group.add(this.obelisk);

    /* ---------------- activity pillars ---------------- */

    const days = activity.length;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);

    this.pillars = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({
        roughness: 0.35,
        metalness: 0.25,
        // instanceColor drives the diffuse per day; this emissive floor is what
        // lets the busiest days survive the bloom threshold.
        emissive: new THREE.Color(0x8a6f17),
        emissiveIntensity: 0.55,
        flatShading: true,
      }),
      Math.max(1, days),
    );
    this.pillars.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(Math.max(1, days) * 3),
      3,
    );
    this.pillars.castShadow = false;

    this.pillarHeights = new Float32Array(Math.max(1, days));
    this.pillarAngles = new Float32Array(Math.max(1, days));

    const ringR = 20.5;
    for (let i = 0; i < days; i++) {
      const day = activity[i];
      // Oldest day sits just left of twelve o'clock, today lands back at twelve.
      const angle = (i / days) * Math.PI * 2 - Math.PI / 2;
      this.pillarAngles[i] = angle;
      this.pillarHeights[i] = 0.9 + day.intensity * 17;

      this.tint
        .copy(new THREE.Color(0x2b3352))
        .lerp(brass, day.intensity * 0.75)
        .lerp(ember, Math.pow(day.intensity, 3) * 0.6);
      this.pillars.setColorAt(i, this.tint);
    }
    if (this.pillars.instanceColor) this.pillars.instanceColor.needsUpdate = true;
    this.group.add(this.pillars);

    /* ---------------- halo ring ---------------- */

    const haloGeo = new THREE.RingGeometry(ringR + 2.6, ringR + 3.4, 128);
    haloGeo.rotateX(-Math.PI / 2);
    this.halo = new THREE.Mesh(
      haloGeo,
      new THREE.MeshBasicMaterial({
        color: brass,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.halo.position.y = 1.4;
    this.group.add(this.halo);

    /* ---------------- key light ---------------- */

    this.key = new THREE.PointLight(0xffb27a, 0, 260, 2);
    this.key.position.y = this.obeliskHeight * 0.6;
    this.group.add(this.key);
  }

  materialize() {
    this.revealTarget = 1;
  }

  get revealed() {
    return this.reveal > 0.98;
  }

  update(time: number, dt: number) {
    this.reveal = damp(this.reveal, this.revealTarget, 1.9, dt);
    const eased = easeOutCubic(this.reveal);

    this.obeliskMat.uniforms.uTime.value = time;
    this.obeliskMat.uniforms.uReveal.value = this.reveal;

    const solid = clamp((eased - 0.05) / 0.95, 0, 1);
    this.plate.scale.setScalar(Math.max(0.001, solid));
    this.root.scale.setScalar(Math.max(0.001, solid));

    // Pillars rise in a wave that sweeps around the clock.
    const count = this.pillarHeights.length;
    for (let i = 0; i < count; i++) {
      const wavePos = i / count;
      const local = clamp((eased - wavePos * 0.55) / 0.45, 0, 1);
      const grow = easeOutCubic(local);

      // A gentle breathing ripple once settled, so the ring never freezes.
      const breathe = this.reducedMotion
        ? 1
        : 1 + Math.sin(time * 1.1 - wavePos * Math.PI * 4) * 0.045 * grow;

      const h = Math.max(0.001, this.pillarHeights[i] * grow * breathe);
      const angle = this.pillarAngles[i];
      const r = 20.5;

      this.dummy.position.set(Math.cos(angle) * r, 1.3, Math.sin(angle) * r);
      this.dummy.rotation.set(0, -angle, 0);
      this.dummy.scale.set(1.5, h, 1.5);
      this.dummy.updateMatrix();
      this.pillars.setMatrixAt(i, this.dummy.matrix);
    }
    this.pillars.instanceMatrix.needsUpdate = true;

    (this.halo.material as THREE.MeshBasicMaterial).opacity =
      eased * (0.10 + (this.reducedMotion ? 0 : Math.sin(time * 0.7) * 0.05 + 0.05));
    if (!this.reducedMotion) this.halo.rotation.y = time * 0.05;

    this.key.intensity = eased * 26;

    this.labelAnchor.set(0, this.obeliskHeight * eased + 6, 0);
    this.todayAnchor.set(0, 6, -20.5);
  }

  dispose() {
    this.obelisk.geometry.dispose();
    this.obeliskMat.dispose();
    this.plate.geometry.dispose();
    (this.plate.material as THREE.Material).dispose();
    this.root.geometry.dispose();
    (this.root.material as THREE.Material).dispose();
    this.pillars.geometry.dispose();
    (this.pillars.material as THREE.Material).dispose();
    this.pillars.dispose();
    this.halo.geometry.dispose();
    (this.halo.material as THREE.Material).dispose();
  }
}
