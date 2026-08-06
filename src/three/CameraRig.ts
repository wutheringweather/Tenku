import * as THREE from 'three';
import type { CameraMode } from './types';
import { clamp, damp, easeInOutCubic, easeOutExpo } from '@/lib/math';
import { world } from '@/config/site';

interface Cinematic {
  from: THREE.Vector3;
  to: THREE.Vector3;
  lookFrom: THREE.Vector3;
  lookTo: THREE.Vector3;
  /** Control point that bends the path so the camera arcs instead of sliding. */
  bend: THREE.Vector3;
  elapsed: number;
  duration: number;
  onDone?: () => void;
}

/**
 * Two ways to move.
 *
 * orbit  — the default. Drag to swing around the archipelago, scroll to close
 *          in. Selecting an island arcs the camera to it on a bent path.
 * flight — pointer lock, WASD, mouse look, shift to sprint. For people who want
 *          to fly between the islands rather than look at them.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;

  mode: CameraMode = 'orbit';
  /** Set while a cinematic is running; input is ignored. */
  scripted = false;
  /** Rises to 1 during a hard cut, consumed by the grade pass as a flash. */
  flash = 0;

  private readonly target = new THREE.Vector3(0, 6, 0);
  private readonly smoothTarget = new THREE.Vector3(0, 6, 0);

  // Orbit state
  private azimuth = Math.PI * 0.35;
  private polar = Math.PI * 0.40;
  private distance: number = world.orbitDistance;
  private azimuthTarget = Math.PI * 0.35;
  private polarTarget = Math.PI * 0.40;
  private distanceTarget: number = world.orbitDistance;

  // Flight state
  private readonly velocity = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private readonly keys = new Set<string>();

  private cinematic: Cinematic | null = null;
  private readonly lookAtPoint = new THREE.Vector3();
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();

  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private pointerLocked = false;

  private readonly dom: HTMLElement;
  private reducedMotion: boolean;

  constructor(dom: HTMLElement, aspect: number, reducedMotion = false) {
    this.dom = dom;
    this.reducedMotion = reducedMotion;
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.5, 4000);
    this.camera.position.set(0, 40, 260);
    this.bindInput();
  }

  /* ---------------------------------------------------------------- *
   * Input
   * ---------------------------------------------------------------- */

  private bindInput() {
    const dom = this.dom;

    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.mode === 'flight') return;
    if (e.button !== 0) return;
    this.dragging = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.mode === 'flight') {
      if (!this.pointerLocked || this.scripted) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = clamp(this.pitch - e.movementY * 0.0022, -1.35, 1.35);
      return;
    }

    if (!this.dragging || this.scripted) return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.azimuthTarget -= dx * 0.0045;
    this.polarTarget = clamp(this.polarTarget - dy * 0.0035, 0.14, Math.PI * 0.52);
  };

  private onPointerUp = () => {
    this.dragging = false;
  };

  private onWheel = (e: WheelEvent) => {
    if (this.mode === 'flight' || this.scripted) return;
    e.preventDefault();
    const factor = Math.exp(e.deltaY * 0.0011);
    this.distanceTarget = clamp(this.distanceTarget * factor, 34, 460);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    this.keys.add(e.code);
    if (this.mode === 'flight' && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.dom;
  };

  /* ---------------------------------------------------------------- *
   * Mode
   * ---------------------------------------------------------------- */

  setMode(mode: CameraMode) {
    if (mode === this.mode) return;
    this.mode = mode;

    if (mode === 'flight') {
      // Carry the current view into flight so the switch is seamless.
      const dir = this.tmpA.copy(this.smoothTarget).sub(this.camera.position).normalize();
      this.yaw = Math.atan2(-dir.x, -dir.z);
      this.pitch = Math.asin(clamp(dir.y, -1, 1));
      this.velocity.set(0, 0, 0);
      this.dom.requestPointerLock?.();
    } else {
      if (document.pointerLockElement === this.dom) document.exitPointerLock();
      // Rebuild orbit parameters from where the camera actually is.
      const offset = this.tmpA.copy(this.camera.position).sub(this.target);
      this.distance = this.distanceTarget = clamp(offset.length(), 34, 460);
      this.azimuth = this.azimuthTarget = Math.atan2(offset.x, offset.z);
      this.polar = this.polarTarget = clamp(
        Math.acos(clamp(offset.y / Math.max(0.001, offset.length()), -1, 1)),
        0.14,
        Math.PI * 0.52,
      );
    }
  }

  requestPointerLock() {
    if (this.mode === 'flight') this.dom.requestPointerLock?.();
  }

  get isPointerLocked() {
    return this.pointerLocked;
  }

  /* ---------------------------------------------------------------- *
   * Cinematics
   * ---------------------------------------------------------------- */

  /** Arc the camera to a new position on a bent path. */
  flyTo(position: THREE.Vector3, lookAt: THREE.Vector3, duration = 2.2, onDone?: () => void) {
    if (this.reducedMotion) {
      this.camera.position.copy(position);
      this.target.copy(lookAt);
      this.smoothTarget.copy(lookAt);
      this.syncOrbitFromCamera();
      onDone?.();
      return;
    }

    const from = this.camera.position.clone();
    const bend = from.clone().lerp(position, 0.5);
    // Push the midpoint up and outward so the move reads as an arc.
    bend.y += from.distanceTo(position) * 0.22;
    bend.addScaledVector(this.tmpB.copy(bend).sub(lookAt).setY(0).normalize(), 22);

    this.cinematic = {
      from,
      to: position.clone(),
      lookFrom: this.lookAtPoint.clone(),
      lookTo: lookAt.clone(),
      bend,
      elapsed: 0,
      duration,
      onDone,
    };
    this.scripted = true;
  }

  /** Frame an island: sit back from it, at a slight elevation, facing the hub side. */
  focus(point: THREE.Vector3, radius: number, onDone?: () => void) {
    const away = this.tmpA.copy(point).setY(0).normalize();
    if (away.lengthSq() < 0.001) away.set(0, 0, 1);
    const dist = Math.max(38, radius * 3.4);
    const pos = point
      .clone()
      .addScaledVector(away, dist * 0.75)
      .add(new THREE.Vector3(0, dist * 0.42, 0));
    this.flyTo(pos, point.clone(), 1.9, onDone);
  }

  /** The opening move: rise out of the void and settle into orbit. */
  openingSequence(onDone?: () => void) {
    if (this.reducedMotion) {
      this.azimuth = this.azimuthTarget = Math.PI * 0.35;
      this.polar = this.polarTarget = Math.PI * 0.4;
      this.distance = this.distanceTarget = world.orbitDistance;
      this.target.set(0, 6, 0);
      onDone?.();
      return;
    }

    this.camera.position.set(-14, -96, 44);
    this.lookAtPoint.set(0, 10, 0);
    this.azimuth = this.azimuthTarget = Math.PI * 0.35;
    this.polar = this.polarTarget = Math.PI * 0.4;
    this.distance = this.distanceTarget = world.orbitDistance;

    const settle = new THREE.Vector3(
      Math.sin(this.azimuth) * Math.sin(this.polar) * this.distance,
      Math.cos(this.polar) * this.distance + 6,
      Math.cos(this.azimuth) * Math.sin(this.polar) * this.distance,
    );

    this.flyTo(settle, new THREE.Vector3(0, 6, 0), 5.4, onDone);
  }

  private syncOrbitFromCamera() {
    const offset = this.tmpA.copy(this.camera.position).sub(this.target);
    this.distance = this.distanceTarget = clamp(offset.length(), 34, 460);
    this.azimuth = this.azimuthTarget = Math.atan2(offset.x, offset.z);
    this.polar = this.polarTarget = clamp(
      Math.acos(clamp(offset.y / Math.max(0.001, offset.length()), -1, 1)),
      0.14,
      Math.PI * 0.52,
    );
  }

  /** Reset the view back to the whole archipelago. */
  frameAll() {
    this.target.set(0, 6, 0);
    this.distanceTarget = world.orbitDistance;
    this.polarTarget = Math.PI * 0.4;
    if (this.mode === 'flight') this.setMode('orbit');
  }

  /* ---------------------------------------------------------------- *
   * Frame
   * ---------------------------------------------------------------- */

  update(dt: number) {
    this.flash = damp(this.flash, 0, 5, dt);

    if (this.cinematic) {
      const c = this.cinematic;
      c.elapsed += dt;
      const t = clamp(c.elapsed / c.duration, 0, 1);
      const e = easeInOutCubic(t);

      // Quadratic bezier through the bend point.
      const inv = 1 - e;
      this.camera.position
        .copy(c.from)
        .multiplyScalar(inv * inv)
        .addScaledVector(c.bend, 2 * inv * e)
        .addScaledVector(c.to, e * e);

      this.lookAtPoint.lerpVectors(c.lookFrom, c.lookTo, easeOutExpo(t));
      this.camera.lookAt(this.lookAtPoint);
      this.smoothTarget.copy(this.lookAtPoint);
      this.target.copy(c.lookTo);

      if (t >= 1) {
        this.cinematic = null;
        this.scripted = false;
        // Orbit mode recomputes the camera position from azimuth/polar/distance
        // every frame. Without this, those still hold their pre-cinematic
        // values, so the very next orbit update snaps the camera back to
        // wherever it was before the flight started.
        this.syncOrbitFromCamera();
        c.onDone?.();
      }
      return;
    }

    if (this.mode === 'orbit') this.updateOrbit(dt);
    else this.updateFlight(dt);
  }

  private updateOrbit(dt: number) {
    // Idle drift keeps the scene breathing when nobody is touching it.
    if (!this.dragging && !this.reducedMotion) this.azimuthTarget += dt * 0.014;

    this.azimuth = damp(this.azimuth, this.azimuthTarget, 4.5, dt);
    this.polar = damp(this.polar, this.polarTarget, 4.5, dt);
    this.distance = damp(this.distance, this.distanceTarget, 3.6, dt);
    this.smoothTarget.lerp(this.target, 1 - Math.exp(-4 * dt));

    const sinP = Math.sin(this.polar);
    this.camera.position.set(
      this.smoothTarget.x + Math.sin(this.azimuth) * sinP * this.distance,
      this.smoothTarget.y + Math.cos(this.polar) * this.distance,
      this.smoothTarget.z + Math.cos(this.azimuth) * sinP * this.distance,
    );
    this.lookAtPoint.copy(this.smoothTarget);
    this.camera.lookAt(this.lookAtPoint);
  }

  private updateFlight(dt: number) {
    const forward = this.tmpA.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    const right = this.tmpB.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 3.1 : 1;
    const accel = 210 * sprint;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      this.velocity.addScaledVector(forward, accel * dt);
    }
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      this.velocity.addScaledVector(forward, -accel * dt);
    }
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
      this.velocity.addScaledVector(right, accel * dt);
    }
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
      this.velocity.addScaledVector(right, -accel * dt);
    }
    if (this.keys.has('Space')) this.velocity.y += accel * dt * 0.75;
    if (this.keys.has('KeyC') || this.keys.has('ControlLeft')) this.velocity.y -= accel * dt * 0.75;

    // Drag. Higher than real air resistance — this is a camera, not a spacecraft.
    const drag = Math.exp(-4.2 * dt);
    this.velocity.multiplyScalar(drag);

    this.camera.position.addScaledVector(this.velocity, dt);
    // Soft ceiling and floor so you cannot fly out of the world.
    this.camera.position.y = clamp(this.camera.position.y, -62, 300);
    const flat = Math.hypot(this.camera.position.x, this.camera.position.z);
    if (flat > 520) {
      this.camera.position.x *= 520 / flat;
      this.camera.position.z *= 520 / flat;
      this.velocity.multiplyScalar(0.4);
    }

    this.lookAtPoint.copy(this.camera.position).add(forward);
    this.camera.lookAt(this.lookAtPoint);
    this.smoothTarget.copy(this.lookAtPoint);
  }

  get speed() {
    return this.mode === 'flight' ? this.velocity.length() : Math.abs(this.distance - this.distanceTarget) * 4;
  }

  get heading() {
    // Screen-space bearing of the camera, used by the reticle.
    const dir = this.tmpA.copy(this.lookAtPoint).sub(this.camera.position);
    return Math.atan2(dir.x, dir.z);
  }

  setAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setReducedMotion(v: boolean) {
    this.reducedMotion = v;
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.dom.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    if (document.pointerLockElement === this.dom) document.exitPointerLock();
  }
}
