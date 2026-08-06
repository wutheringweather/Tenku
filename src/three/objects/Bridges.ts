import * as THREE from 'three';
import type { IslandSpec } from '../types';
import { bridgeFrag, bridgeVert } from '../shaders/bridge';
import { damp } from '@/lib/math';

interface Strand {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  reveal: number;
  revealTarget: number;
  select: number;
  selectTarget: number;
}

/**
 * A filament from the hub to each island. The pulse cadence is set by how
 * recently the repository was pushed — a repo touched today fires several times
 * a second, one dormant for two years barely flickers.
 */
export class Bridges {
  readonly group = new THREE.Group();
  private readonly strands: Strand[] = [];

  constructor(islands: IslandSpec[]) {
    this.group.name = 'bridges';
    const now = Date.now();

    for (const spec of islands) {
      const start = new THREE.Vector3(0, 6, 0);
      const end = new THREE.Vector3(spec.x, spec.y + spec.radius * 0.3, spec.z);

      // Bow the curve outward and upward so strands separate visually instead
      // of collapsing into a starburst.
      const mid = start.clone().lerp(end, 0.5);
      const lateral = new THREE.Vector3(-end.z, 0, end.x).normalize();
      mid.addScaledVector(lateral, (spec.seed - 0.5) * 26);
      mid.y += 12 + spec.seed * 18;

      const quarter = start.clone().lerp(end, 0.22);
      quarter.y += 8 + spec.seed * 6;
      const threeQuarter = start.clone().lerp(end, 0.78);
      threeQuarter.y += 6 + (1 - spec.seed) * 8;
      threeQuarter.addScaledVector(lateral, (spec.seed - 0.5) * 12);

      const curve = new THREE.CatmullRomCurve3([start, quarter, mid, threeQuarter, end]);
      const geo = new THREE.TubeGeometry(curve, 72, 0.34 + spec.radius * 0.02, 6, false);

      const ageDays = Math.max(0, (now - new Date(spec.repo.pushedAt).getTime()) / 86400000);
      const cadence = 0.5 * Math.exp(-ageDays / 200) + 0.035;

      const material = new THREE.ShaderMaterial({
        vertexShader: bridgeVert,
        fragmentShader: bridgeFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uColor: { value: new THREE.Color(spec.color).lerp(new THREE.Color(0xffc98a), 0.3) },
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uSelect: { value: 0 },
          uCadence: { value: cadence },
        },
      });

      const mesh = new THREE.Mesh(geo, material);
      mesh.renderOrder = 5;
      mesh.frustumCulled = false;
      this.group.add(mesh);

      this.strands.push({ mesh, material, reveal: 0, revealTarget: 0, select: 0, selectTarget: 0 });
    }
  }

  materialize(index: number) {
    const s = this.strands[index];
    if (s) s.revealTarget = 1;
  }

  materializeAll() {
    for (const s of this.strands) s.revealTarget = 1;
  }

  setSelected(index: number | null) {
    this.strands.forEach((s, i) => {
      s.selectTarget = i === index ? 1 : 0;
    });
  }

  update(time: number, dt: number) {
    for (const s of this.strands) {
      s.reveal = damp(s.reveal, s.revealTarget, 2.2, dt);
      s.select = damp(s.select, s.selectTarget, 6, dt);
      s.material.uniforms.uTime.value = time;
      s.material.uniforms.uReveal.value = s.reveal;
      s.material.uniforms.uSelect.value = s.select;
    }
  }

  dispose() {
    for (const s of this.strands) {
      s.mesh.geometry.dispose();
      s.material.dispose();
    }
  }
}
