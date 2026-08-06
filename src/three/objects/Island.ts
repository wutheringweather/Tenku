import * as THREE from 'three';
import type { IslandSpec } from '../types';
import { crystalFrag, crystalVert } from '../shaders/crystal';
import { ringFrag, ringVert } from '../shaders/particles';
import { clamp, damp, easeOutCubic, rng } from '@/lib/math';

/** Cheap 3D value noise for vertex displacement. Deterministic per island. */
function makeNoise(seed: number) {
  const rand = rng(seed);
  const table = new Float32Array(256);
  for (let i = 0; i < 256; i++) table[i] = rand();
  const at = (x: number, y: number, z: number) =>
    table[(((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0) & 255];

  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const xf = x - xi;
    const yf = y - yi;
    const zf = z - zi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const w = zf * zf * (3 - 2 * zf);

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const c000 = at(xi, yi, zi);
    const c100 = at(xi + 1, yi, zi);
    const c010 = at(xi, yi + 1, zi);
    const c110 = at(xi + 1, yi + 1, zi);
    const c001 = at(xi, yi, zi + 1);
    const c101 = at(xi + 1, yi, zi + 1);
    const c011 = at(xi, yi + 1, zi + 1);
    const c111 = at(xi + 1, yi + 1, zi + 1);

    return lerp(
      lerp(lerp(c000, c100, u), lerp(c010, c110, u), v),
      lerp(lerp(c001, c101, u), lerp(c011, c111, u), v),
      w,
    );
  };
}

/**
 * One repository. Reading it back:
 *   landmass width  → forks
 *   monolith height → stars
 *   altitude        → recency of the last push
 *   colour          → primary language
 *   ring density    → open issues
 */
export class Island {
  readonly group = new THREE.Group();
  readonly spec: IslandSpec;
  /** Point used for raycasting and for the label anchor. */
  readonly hitbox: THREE.Mesh;
  /** World-space position of the monolith tip, for HUD labels. */
  readonly labelAnchor = new THREE.Vector3();

  private readonly crystal: THREE.Mesh;
  private readonly crystalMat: THREE.ShaderMaterial;
  private readonly ring: THREE.Points;
  private readonly ringMat: THREE.ShaderMaterial;
  private readonly rock: THREE.Mesh;
  private readonly cap: THREE.Mesh;
  private readonly glow: THREE.PointLight;
  private readonly baseY: number;
  private readonly bobPhase: number;
  private readonly bobRate: number;
  private readonly spinRate: number;

  private reveal = 0;
  private revealTarget = 0;
  private select = 0;
  private selectTarget = 0;
  private hover = 0;
  private hoverTarget = 0;

  constructor(spec: IslandSpec, reducedMotion = false) {
    this.spec = spec;
    const rand = rng(Math.floor(spec.seed * 1e9) + spec.index * 977);
    const noise = makeNoise(Math.floor(spec.seed * 1e6) + 17);

    const color = new THREE.Color(spec.color);
    this.baseY = spec.y;
    this.bobPhase = spec.seed * Math.PI * 2;
    this.bobRate = reducedMotion ? 0 : 0.24 + rand() * 0.22;
    this.spinRate = reducedMotion ? 0 : (rand() - 0.5) * 0.05;

    this.group.position.set(spec.x, spec.y, spec.z);
    this.group.name = `island:${spec.repo.name}`;

    /* ---------------- landmass ---------------- */

    const rockGeo = new THREE.IcosahedronGeometry(spec.radius, 3);
    const pos = rockGeo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = v.clone().normalize();

      // Flatten the top into a plateau, stretch the bottom into a root.
      const up = n.y;
      let scale = 1;
      if (up > 0.15) scale = 1 - (up - 0.15) * 0.62;
      if (up < -0.1) scale = 1 + Math.pow(-up - 0.1, 1.6) * 2.4;

      const craggy =
        (noise(n.x * 3.1 + 5, n.y * 3.1, n.z * 3.1) - 0.5) * 0.30 +
        (noise(n.x * 7.4, n.y * 7.4 + 3, n.z * 7.4) - 0.5) * 0.14;

      v.copy(n).multiplyScalar(spec.radius * scale * (1 + craggy));
      v.y *= up < -0.1 ? 1.5 : 0.62;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    rockGeo.computeVertexNormals();

    const rockColor = new THREE.Color(0x1b2138).lerp(color, 0.16);
    this.rock = new THREE.Mesh(
      rockGeo,
      new THREE.MeshStandardMaterial({
        color: rockColor,
        roughness: 0.95,
        metalness: 0.04,
        flatShading: true,
      }),
    );
    this.rock.scale.setScalar(0.001);
    this.group.add(this.rock);

    /* ---------------- plateau cap ---------------- */

    const capGeo = new THREE.CircleGeometry(spec.radius * 0.82, 22);
    capGeo.rotateX(-Math.PI / 2);
    const capPos = capGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < capPos.count; i++) {
      const x = capPos.getX(i);
      const z = capPos.getZ(i);
      capPos.setY(i, (noise(x * 0.4 + 11, 0, z * 0.4) - 0.5) * spec.radius * 0.16);
    }
    capGeo.computeVertexNormals();

    this.cap = new THREE.Mesh(
      capGeo,
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x2c3352).lerp(color, 0.42),
        roughness: 0.7,
        metalness: 0.1,
        emissive: color.clone().multiplyScalar(0.06),
        flatShading: true,
      }),
    );
    this.cap.position.y = spec.radius * 0.30;
    this.cap.scale.setScalar(0.001);
    this.group.add(this.cap);

    /* ---------------- monolith ---------------- */

    // Built in unit space (y: 0 → 1) so the shader can grow it from the base.
    const facets = 6;
    const crystalGeo = new THREE.CylinderGeometry(0.16, 0.55, 1, facets, 4, false);
    crystalGeo.translate(0, 0.5, 0);
    const cpos = crystalGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cpos.count; i++) {
      const y = cpos.getY(i);
      const jitter = 1 + (rand() - 0.5) * 0.14 * (1 - y * 0.5);
      cpos.setX(i, cpos.getX(i) * jitter);
      cpos.setZ(i, cpos.getZ(i) * jitter);
    }
    crystalGeo.computeVertexNormals();

    this.crystalMat = new THREE.ShaderMaterial({
      vertexShader: crystalVert,
      fragmentShader: crystalFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: color.clone() },
        uCore: { value: new THREE.Color(0xffc98a) },
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uSelect: { value: 0 },
        uHover: { value: 0 },
      },
    });

    this.crystal = new THREE.Mesh(crystalGeo, this.crystalMat);
    this.crystal.scale.set(spec.radius * 0.30, spec.spire, spec.radius * 0.30);
    this.crystal.position.y = spec.radius * 0.26;
    this.crystal.renderOrder = 10;
    this.group.add(this.crystal);

    /* ---------------- orbiting debris ---------------- */

    const ringCount = 90 + Math.min(200, spec.repo.openIssues * 6);
    const rPos = new Float32Array(ringCount * 3);
    const rAngle = new Float32Array(ringCount);
    const rRadius = new Float32Array(ringCount);
    const rSpeed = new Float32Array(ringCount);
    const rTilt = new Float32Array(ringCount);
    const rScale = new Float32Array(ringCount);

    for (let i = 0; i < ringCount; i++) {
      rAngle[i] = rand() * Math.PI * 2;
      rRadius[i] = spec.radius * (1.5 + rand() * 1.15);
      rSpeed[i] = (reducedMotion ? 0.05 : 0.16) * (0.55 + rand() * 0.9) * (rand() > 0.85 ? -1 : 1);
      rTilt[i] = (rand() - 0.5) * 0.55;
      rScale[i] = 0.6 + Math.pow(rand(), 2.4) * 3.0;
    }

    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
    ringGeo.setAttribute('aAngle', new THREE.BufferAttribute(rAngle, 1));
    ringGeo.setAttribute('aRadius', new THREE.BufferAttribute(rRadius, 1));
    ringGeo.setAttribute('aSpeed', new THREE.BufferAttribute(rSpeed, 1));
    ringGeo.setAttribute('aTilt', new THREE.BufferAttribute(rTilt, 1));
    ringGeo.setAttribute('aScale', new THREE.BufferAttribute(rScale, 1));
    ringGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), spec.radius * 3);

    this.ringMat = new THREE.ShaderMaterial({
      vertexShader: ringVert,
      fragmentShader: ringFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uReveal: { value: 0 },
        uSelect: { value: 0 },
        uColor: { value: color.clone().lerp(new THREE.Color(0xffffff), 0.25) },
      },
    });

    this.ring = new THREE.Points(ringGeo, this.ringMat);
    this.ring.position.y = spec.radius * 0.32;
    this.group.add(this.ring);

    /* ---------------- glow + hitbox ---------------- */

    this.glow = new THREE.PointLight(spec.color, 0, spec.radius * 9, 2);
    this.glow.position.y = spec.radius * 0.5 + spec.spire * 0.35;
    this.group.add(this.glow);

    const hitRadius = Math.max(spec.radius * 1.5, spec.spire * 0.45);
    this.hitbox = new THREE.Mesh(
      new THREE.SphereGeometry(hitRadius, 8, 6),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.hitbox.position.y = spec.radius * 0.3 + spec.spire * 0.3;
    this.hitbox.userData.islandIndex = spec.index;
    this.group.add(this.hitbox);
  }

  setPixelRatio(ratio: number) {
    this.ringMat.uniforms.uPixelRatio.value = ratio;
  }

  /** Kick off the materialisation for this island. */
  materialize() {
    this.revealTarget = 1;
  }

  set selected(on: boolean) {
    this.selectTarget = on ? 1 : 0;
  }

  set hovered(on: boolean) {
    this.hoverTarget = on ? 1 : 0;
  }

  get revealed() {
    return this.reveal > 0.98;
  }

  update(time: number, dt: number) {
    this.reveal = damp(this.reveal, this.revealTarget, 2.4, dt);
    this.select = damp(this.select, this.selectTarget, 6, dt);
    this.hover = damp(this.hover, this.hoverTarget, 10, dt);

    const eased = easeOutCubic(this.reveal);

    this.crystalMat.uniforms.uTime.value = time;
    this.crystalMat.uniforms.uReveal.value = this.reveal;
    this.crystalMat.uniforms.uSelect.value = this.select;
    this.crystalMat.uniforms.uHover.value = this.hover;

    this.ringMat.uniforms.uTime.value = time;
    this.ringMat.uniforms.uReveal.value = eased;
    this.ringMat.uniforms.uSelect.value = this.select;

    // The rock and cap swell into place slightly after the crystal starts.
    const solid = clamp((eased - 0.08) / 0.92, 0, 1);
    const overshoot = 1 + Math.sin(solid * Math.PI) * 0.06;
    this.rock.scale.setScalar(Math.max(0.001, solid * overshoot));
    this.cap.scale.setScalar(Math.max(0.001, solid * overshoot));

    this.glow.intensity = eased * (2.2 + this.select * 9 + this.hover * 2.5) * this.spec.radius * 0.1;

    // Ambient life: a slow bob, a slower spin, and a lift when selected.
    const bob = Math.sin(time * this.bobRate + this.bobPhase) * 1.5;
    const lift = this.select * 4.5 + this.hover * 1.4;
    this.group.position.y = this.baseY + bob * eased + lift;
    this.group.rotation.y += this.spinRate * dt;

    this.labelAnchor.set(
      this.group.position.x,
      this.group.position.y + this.spec.radius * 0.3 + this.spec.spire * eased + 4,
      this.group.position.z,
    );
  }

  dispose() {
    this.rock.geometry.dispose();
    (this.rock.material as THREE.Material).dispose();
    this.cap.geometry.dispose();
    (this.cap.material as THREE.Material).dispose();
    this.crystal.geometry.dispose();
    this.crystalMat.dispose();
    this.ring.geometry.dispose();
    this.ringMat.dispose();
    this.hitbox.geometry.dispose();
    (this.hitbox.material as THREE.Material).dispose();
  }
}
