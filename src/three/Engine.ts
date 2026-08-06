import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { CameraMode, WorldSpec } from './types';
import { CameraRig } from './CameraRig';
import { Composer, type QualitySettings } from './post/Composer';
import { Sky } from './fx/Sky';
import { Starfield } from './fx/Starfield';
import { AetherSea, Motes } from './fx/Atmosphere';
import { Island } from './objects/Island';
import { HubIsland } from './objects/HubIsland';
import { Bridges } from './objects/Bridges';
import { clamp, formatCount } from '@/lib/math';

export interface Bearing {
  index: number;
  /** Radians, relative to camera heading. 0 = dead ahead. */
  angle: number;
  distance: number;
  name: string;
  color: string;
  selected: boolean;
}

export interface EngineCallbacks {
  onHover?: (index: number | null) => void;
  onSelect?: (index: number | null) => void;
  onStats?: (fps: number, mode: CameraMode, altitude: number) => void;
  onSequenceStage?: (stage: string, progress: number) => void;
  onReady?: () => void;
}

const QUALITY_PRESETS: Record<'high' | 'balanced' | 'low', QualitySettings> = {
  high: { bloom: true, grade: true, pixelRatioCap: 2 },
  balanced: { bloom: true, grade: true, pixelRatioCap: 1.5 },
  low: { bloom: false, grade: false, pixelRatioCap: 1 },
};

export class Engine {
  readonly scene = new THREE.Scene();
  readonly rig: CameraRig;

  private readonly mount: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly labelRenderer: CSS2DRenderer;
  private readonly composer: Composer;
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2(-2, -2);

  private readonly sky = new Sky();
  private readonly stars = new Starfield();
  private readonly motes = new Motes();
  private readonly aether = new AetherSea();

  private islands: Island[] = [];
  private hub: HubIsland | null = null;
  private bridges: Bridges | null = null;
  private spec: WorldSpec | null = null;
  /** Every label element currently attached, so the frame loop can keep them on-screen. */
  private labelEls: HTMLDivElement[] = [];

  private hovered: number | null = null;
  private selected: number | null = null;

  private raf = 0;
  private running = false;
  private disposed = false;
  private reducedMotion: boolean;
  private quality: QualitySettings;

  private sequenceTime = -1;
  private sequenceDone = false;
  private skyIntensity = 0;

  private frames = 0;
  private fpsAccum = 0;
  private fps = 60;
  private statsAccum = 0;

  private readonly cb: EngineCallbacks;
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();

  constructor(
    mount: HTMLElement,
    callbacks: EngineCallbacks = {},
    opts: { reducedMotion?: boolean; quality?: keyof typeof QUALITY_PRESETS } = {},
  ) {
    this.mount = mount;
    this.cb = callbacks;
    this.reducedMotion = opts.reducedMotion ?? false;
    this.quality = QUALITY_PRESETS[opts.quality ?? 'high'];

    // A mount that has not been laid out yet would produce a zero-sized buffer.
    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.pixelRatioCap));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    mount.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    const labelDom = this.labelRenderer.domElement;
    labelDom.style.position = 'absolute';
    labelDom.style.inset = '0';
    labelDom.style.pointerEvents = 'none';
    labelDom.style.overflow = 'hidden';
    mount.appendChild(labelDom);

    this.rig = new CameraRig(this.renderer.domElement, w / h, this.reducedMotion);

    this.scene.fog = new THREE.FogExp2(0x0a0e1e, 0.0016);
    this.scene.add(this.sky.mesh);
    this.scene.add(this.sky.createSun());
    this.scene.add(new THREE.AmbientLight(0x5a6a9a, 0.55));
    this.scene.add(new THREE.HemisphereLight(0x8fb8de, 0x120c1a, 0.5));
    this.scene.add(this.stars.points);
    this.scene.add(this.motes.points);
    this.scene.add(this.aether.mesh);

    const ratio = this.renderer.getPixelRatio();
    this.stars.setPixelRatio(ratio);
    this.motes.setPixelRatio(ratio);

    this.composer = new Composer(
      this.renderer,
      this.scene,
      this.rig.camera,
      { width: w, height: h },
      this.quality,
    );

    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('click', this.onClick);
    this.renderer.domElement.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /* ---------------------------------------------------------------- *
   * World
   * ---------------------------------------------------------------- */

  build(spec: WorldSpec) {
    this.teardownWorld();
    this.spec = spec;

    this.hub = new HubIsland(spec.bundle.activity, spec.totalStars, this.reducedMotion);
    this.scene.add(this.hub.group);

    this.bridges = new Bridges(spec.islands);
    this.scene.add(this.bridges.group);

    const ratio = this.renderer.getPixelRatio();
    for (const islandSpec of spec.islands) {
      const island = new Island(islandSpec, this.reducedMotion);
      island.setPixelRatio(ratio);
      island.group.add(this.makeLabel(islandSpec.index));
      this.scene.add(island.group);
      this.islands.push(island);
    }

    this.sequenceTime = 0;
    this.sequenceDone = false;
    this.rig.openingSequence(() => {
      this.sequenceDone = true;
      this.cb.onReady?.();
    });
  }

  /**
   * A crisp DOM label pinned above each monolith.
   *
   * Two nested elements, not one: CSS2DRenderer repositions `anchor` via
   * inline `style.transform` every frame, and `.arc-label`'s own entrance
   * animation (`label-in`) also animates `transform` on a `forwards` fill —
   * once that animation settles, its value permanently wins the cascade over
   * an inline style on the *same* element, freezing it and silently ignoring
   * every future frame's positioning. Animating the child instead keeps the
   * two transforms independent (they compose through normal nesting).
   */
  private makeLabel(index: number) {
    const spec = this.spec!.islands[index];
    const anchor = document.createElement('div');
    this.labelEls.push(anchor);

    const el = document.createElement('div');
    el.className = 'arc-label';
    el.dataset.index = String(index);
    anchor.appendChild(el);

    const name = document.createElement('span');
    name.className = 'arc-label__name';
    name.textContent = spec.repo.name;

    const meta = document.createElement('span');
    meta.className = 'arc-label__meta';
    meta.textContent = `${formatCount(spec.repo.stars)}★${spec.repo.language ? ` · ${spec.repo.language}` : ''}`;

    const tick = document.createElement('span');
    tick.className = 'arc-label__tick';
    tick.style.background = `#${spec.color.toString(16).padStart(6, '0')}`;

    el.append(tick, name, meta);

    const obj = new CSS2DObject(anchor);
    obj.position.set(0, spec.radius * 0.3 + spec.spire + 5, 0);
    obj.center.set(0.5, 1);
    return obj;
  }

  /**
   * `labelDom` has `overflow: hidden`, and CSS2DRenderer never clamps its own
   * output — a label pinned above a tall spire that projects near the top of
   * the frame (close orbit, a focused island) gets its own top edge clipped
   * clean off. Nudge anything that would spill past the mount's bounds back
   * in, in two passes (read every rect, then write every transform) so this
   * costs one forced layout per frame instead of thrashing per label.
   */
  private clampLabels() {
    if (this.labelEls.length === 0) return;

    const bounds = this.mount.getBoundingClientRect();
    const margin = 6;
    const minTop = bounds.top + margin;
    const minLeft = bounds.left + margin;
    const maxRight = bounds.right - margin;
    const maxBottom = bounds.bottom - margin;

    const deltas: Array<readonly [number, number]> = [];
    for (const el of this.labelEls) {
      if (el.style.display === 'none') {
        deltas.push([0, 0]);
        continue;
      }
      const rect = el.getBoundingClientRect();
      let dx = 0;
      let dy = 0;
      if (rect.top < minTop) dy = minTop - rect.top;
      else if (rect.bottom > maxBottom) dy = maxBottom - rect.bottom;
      if (rect.left < minLeft) dx = minLeft - rect.left;
      else if (rect.right > maxRight) dx = maxRight - rect.right;
      deltas.push([dx, dy]);
    }

    this.labelEls.forEach((el, i) => {
      const [dx, dy] = deltas[i];
      if (dx || dy) el.style.transform += ` translate(${dx.toFixed(0)}px, ${dy.toFixed(0)}px)`;
    });
  }

  private teardownWorld() {
    for (const island of this.islands) {
      this.scene.remove(island.group);
      island.dispose();
    }
    this.islands = [];

    if (this.hub) {
      this.scene.remove(this.hub.group);
      this.hub.dispose();
      this.hub = null;
    }
    if (this.bridges) {
      this.scene.remove(this.bridges.group);
      this.bridges.dispose();
      this.bridges = null;
    }
    // CSS2DRenderer leaves detached nodes behind when objects are removed.
    this.labelRenderer.domElement.replaceChildren();
    this.labelEls = [];
    this.selected = null;
    this.hovered = null;
  }

  /* ---------------------------------------------------------------- *
   * Interaction
   * ---------------------------------------------------------------- */

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  private onPointerLeave = () => {
    this.pointer.set(-2, -2);
  };

  private onClick = () => {
    if (this.rig.mode === 'flight' && !this.rig.isPointerLocked) {
      this.rig.requestPointerLock();
      return;
    }
    if (this.rig.scripted) return;

    // In flight mode the crosshair is the pointer.
    const target = this.rig.mode === 'flight' ? this.pickCentre() : this.hovered;
    if (target === null) {
      this.select(null);
      return;
    }
    this.select(target);
  };

  private pickCentre() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.rig.camera);
    return this.intersectIslands();
  }

  private intersectIslands(): number | null {
    const hits = this.raycaster.intersectObjects(
      this.islands.map((i) => i.hitbox),
      false,
    );
    if (!hits.length) return null;
    const idx = hits[0].object.userData.islandIndex;
    return typeof idx === 'number' ? idx : null;
  }

  select(index: number | null, fly = true) {
    if (index === this.selected) {
      this.cb.onSelect?.(index);
      return;
    }
    this.selected = index;

    this.islands.forEach((island, i) => {
      island.selected = i === index;
    });
    this.bridges?.setSelected(index);

    if (index !== null && fly && this.rig.mode === 'orbit') {
      const island = this.islands[index];
      this.tmp.set(island.spec.x, island.spec.y + island.spec.spire * 0.42, island.spec.z);
      this.rig.focus(this.tmp, Math.max(island.spec.radius, island.spec.spire * 0.4));
      this.rig.flash = 0.06;
    }

    this.cb.onSelect?.(index);
  }

  clearSelection() {
    this.select(null);
    this.rig.frameAll();
  }

  setMode(mode: CameraMode) {
    this.rig.setMode(mode);
  }

  setQuality(preset: keyof typeof QUALITY_PRESETS) {
    this.quality = QUALITY_PRESETS[preset];
    this.composer.setQuality(this.quality);
    const ratio = Math.min(window.devicePixelRatio, this.quality.pixelRatioCap);
    this.renderer.setPixelRatio(ratio);
    this.stars.setPixelRatio(ratio);
    this.motes.setPixelRatio(ratio);
    for (const island of this.islands) island.setPixelRatio(ratio);
    this.onResize();
  }

  setReducedMotion(v: boolean) {
    this.reducedMotion = v;
    this.rig.setReducedMotion(v);
  }

  /* ---------------------------------------------------------------- *
   * Readouts consumed by the HUD
   * ---------------------------------------------------------------- */

  /** Bearings to every island relative to the camera's heading. Reused array. */
  private bearings: Bearing[] = [];
  getBearings(): Bearing[] {
    if (!this.spec) return this.bearings;
    const heading = this.rig.heading;
    const cam = this.rig.camera.position;

    if (this.bearings.length !== this.islands.length) {
      this.bearings = this.islands.map((island) => ({
        index: island.spec.index,
        angle: 0,
        distance: 0,
        name: island.spec.repo.name,
        color: `#${island.spec.color.toString(16).padStart(6, '0')}`,
        selected: false,
      }));
    }

    for (let i = 0; i < this.islands.length; i++) {
      const island = this.islands[i];
      const dx = island.group.position.x - cam.x;
      const dz = island.group.position.z - cam.z;
      let angle = Math.atan2(dx, dz) - heading;
      // Normalise to (-π, π]
      angle = ((angle % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;

      const b = this.bearings[i];
      b.angle = angle;
      b.distance = Math.hypot(dx, dz);
      b.selected = this.selected === i;
    }
    return this.bearings;
  }

  /** Radar coordinates in the range -1..1, plus the camera's own position. */
  getRadar() {
    const extent = 190;
    const cam = this.rig.camera.position;
    return {
      heading: this.rig.heading,
      camera: { x: clamp(cam.x / extent, -1, 1), z: clamp(cam.z / extent, -1, 1) },
      blips: this.islands.map((island) => ({
        index: island.spec.index,
        x: clamp(island.group.position.x / extent, -1, 1),
        z: clamp(island.group.position.z / extent, -1, 1),
        selected: this.selected === island.spec.index,
        color: `#${island.spec.color.toString(16).padStart(6, '0')}`,
      })),
    };
  }

  get currentFps() {
    return this.fps;
  }

  /* ---------------------------------------------------------------- *
   * Frame loop
   * ---------------------------------------------------------------- */

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.clock.start();
    this.tick();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private onVisibility = () => {
    if (document.hidden) this.stop();
    else if (!this.disposed) this.start();
  };

  private tick = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);

    // Clamp dt so a backgrounded tab does not teleport the world on return.
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;

    this.frames++;
    this.fpsAccum += dt;
    if (this.fpsAccum > 0.5) {
      this.fps = Math.round(this.frames / this.fpsAccum);
      this.frames = 0;
      this.fpsAccum = 0;
    }

    this.runSequence(dt);

    this.sky.update(time);
    this.stars.update(time);
    this.motes.update(time);
    this.aether.update(time);

    this.hub?.update(time, dt);
    for (const island of this.islands) island.update(time, dt);
    this.bridges?.update(time, dt);

    this.rig.update(dt);

    // Hover picking only matters in orbit mode with a real pointer on screen.
    if (this.rig.mode === 'orbit' && !this.rig.scripted && this.pointer.x > -1.5) {
      this.raycaster.setFromCamera(this.pointer, this.rig.camera);
      const hit = this.intersectIslands();
      if (hit !== this.hovered) {
        this.hovered = hit;
        this.islands.forEach((island, i) => {
          island.hovered = i === hit;
        });
        this.renderer.domElement.style.cursor = hit === null ? 'grab' : 'pointer';
        this.cb.onHover?.(hit);
      }
    }

    this.composer.update(time, this.rig.flash);
    this.composer.render(dt);
    this.labelRenderer.render(this.scene, this.rig.camera);
    this.clampLabels();

    this.statsAccum += dt;
    if (this.statsAccum > 0.25) {
      this.statsAccum = 0;
      this.cb.onStats?.(this.fps, this.rig.mode, this.rig.camera.position.y);
    }
  };

  /**
   * The materialisation. Islands do not all appear at once: the hub lights
   * first, then repositories arrive in rank order, each pulling its bridge
   * behind it, while the sun comes up underneath the whole thing.
   */
  private runSequence(dt: number) {
    if (this.sequenceTime < 0 || this.sequenceDone) {
      this.skyIntensity = Math.min(1, this.skyIntensity + dt * 0.4);
      this.sky.intensity = this.skyIntensity;
      this.motes.reveal = this.skyIntensity;
      this.aether.reveal = this.skyIntensity;
      return;
    }

    this.sequenceTime += dt;
    const t = this.sequenceTime;

    // Sunrise.
    this.skyIntensity = clamp((t - 0.2) / 3.6, 0, 1);
    this.sky.intensity = this.skyIntensity;
    this.aether.reveal = clamp((t - 0.6) / 3.2, 0, 1);
    this.motes.reveal = clamp((t - 1.4) / 3.0, 0, 1);

    if (t > 0.35) this.hub?.materialize();

    const stagger = this.reducedMotion ? 0.02 : 0.14;
    for (let i = 0; i < this.islands.length; i++) {
      if (t > 1.0 + i * stagger) {
        this.islands[i].materialize();
        this.bridges?.materialize(i);
      }
    }

    const total = 1.0 + this.islands.length * stagger + 1.6;
    this.cb.onSequenceStage?.('Materialising', clamp(t / total, 0, 1));
  }

  /* ---------------------------------------------------------------- */

  private onResize = () => {
    const w = this.mount.clientWidth;
    const h = this.mount.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.rig.setAspect(w / h);
  };

  resize() {
    this.onResize();
  }

  dispose() {
    this.disposed = true;
    this.stop();

    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('click', this.onClick);
    this.renderer.domElement.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);

    this.teardownWorld();
    this.rig.dispose();
    this.sky.dispose();
    this.stars.dispose();
    this.motes.dispose();
    this.aether.dispose();
    this.composer.dispose();

    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }
}
