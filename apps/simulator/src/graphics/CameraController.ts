import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap } from 'gsap';
import type { SimulationModel, Vec3 } from '../engine/types';

export type CameraAction = 'left' | 'right' | 'in' | 'out';

export class CameraController {
  readonly controls: OrbitControls;
  private automatic = true;
  private reducedMotion = false;
  private manualUntil = 0;
  private lastEvent = -1;
  private lastFollowTime = -10;
  private lastSimulationTime = 0;
  private lastStatus: SimulationModel['status'] = 'running';
  private hasViewportFit = false;
  private readonly direction = new Vector3();
  private readonly home = new Vector3(0, 6.5, 38);

  constructor(readonly camera: PerspectiveCamera, canvas: HTMLCanvasElement, private readonly model: SimulationModel) {
    camera.position.copy(this.home);
    this.controls = new OrbitControls(camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 75;
    this.controls.maxPolarAngle = Math.PI * 0.88;
    this.controls.minPolarAngle = Math.PI * 0.08;
    this.controls.rotateSpeed = 0.5;
    this.controls.panSpeed = 0.6;
    this.controls.zoomSpeed = 0.8;
    this.controls.autoRotate = false;
    this.controls.addEventListener('start', this.onManual);
    this.controls.update();
  }

  private onManual = () => {
    this.manualUntil = performance.now() + 12000;
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);
  };

  setAuto(enabled: boolean): void {
    this.automatic = enabled; this.manualUntil = 0;
    if (!enabled) {
      this.controls.autoRotate = false;
      gsap.killTweensOf(this.camera.position);
      gsap.killTweensOf(this.controls.target);
    }
  }
  /** Desktop frames the chamber; portrait stays immersive, with manual zoom-out available. */
  fitToViewport(): void {
    const bounds = this.model.config.bounds;
    const tanHalfFov = Math.tan(this.camera.fov * Math.PI / 360);
    const fittedDistance = Math.max(bounds.y / tanHalfFov, bounds.x / (tanHalfFov * Math.max(0.25, this.camera.aspect))) * 1.12 + bounds.z * 1.25;
    const distance = this.camera.aspect < 1 ? Math.min(48, fittedDistance) : fittedDistance;
    const wasAtHome = this.camera.position.distanceTo(this.home) < 0.5;
    this.home.set(0, distance * 0.14, distance);
    this.controls.maxDistance = Math.max(75, fittedDistance * 1.5);
    this.camera.far = Math.max(180, fittedDistance * 2.2);
    this.camera.updateProjectionMatrix();
    if (!this.hasViewportFit || wasAtHome) {
      this.camera.position.copy(this.home);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
    this.hasViewportFit = true;
  }
  setReduced(enabled: boolean): void {
    this.reducedMotion = enabled;
    this.controls.enableDamping = !enabled;
    if (enabled) { gsap.killTweensOf(this.camera.position); gsap.killTweensOf(this.controls.target); }
  }

  private moveTo(position: Vec3, distance: number): void {
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);
    this.direction.copy(this.camera.position).sub(this.controls.target).normalize();
    const eye = new Vector3(position.x, position.y, position.z).addScaledVector(this.direction, distance);
    const duration = this.reducedMotion ? 0 : 1.6;
    gsap.to(this.controls.target, { x: position.x, y: position.y, z: position.z, duration, ease: 'power2.inOut' });
    gsap.to(this.camera.position, { x: eye.x, y: eye.y, z: eye.z, duration, ease: 'power2.inOut' });
  }

  focusCell(id: number): void {
    const cell = this.model.cells.find((item) => item.id === id);
    if (!cell) return;
    this.manualUntil = performance.now() + 18000;
    this.moveTo(cell.position, 7.5);
  }

  /** Accessible button equivalents of drag-to-orbit and wheel/pinch-to-zoom. */
  manualMove(action: CameraAction): void {
    this.onManual();
    this.controls.autoRotate = false;
    const offset = this.camera.position.clone().sub(this.controls.target);
    if (action === 'left' || action === 'right') {
      offset.applyAxisAngle(new Vector3(0, 1, 0), action === 'left' ? -0.22 : 0.22);
    } else {
      const distance = Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, offset.length() * (action === 'in' ? 0.8 : 1.25)));
      offset.setLength(distance);
    }
    const position = offset.add(this.controls.target);
    gsap.to(this.camera.position, { x: position.x, y: position.y, z: position.z, duration: this.reducedMotion ? 0 : 0.45, ease: 'power2.out' });
  }

  reset(): void {
    this.fitToViewport();
    this.lastEvent = -1;
    this.lastFollowTime = -10;
    this.manualUntil = performance.now() + 8000;
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);
    const duration = this.reducedMotion ? 0 : 1.4;
    gsap.to(this.camera.position, { x: this.home.x, y: this.home.y, z: this.home.z, duration, ease: 'power2.inOut' });
    gsap.to(this.controls.target, { x: 0, y: 0, z: 0, duration, ease: 'power2.inOut' });
  }

  update(delta: number): void {
    const simulationAdvanced = this.model.time > this.lastSimulationTime;
    const reset = this.model.time < this.lastSimulationTime;
    this.lastSimulationTime = this.model.time;
    if (this.lastStatus === 'running' && this.model.status !== 'running') {
      // A pause also stops a camera move started by an automatic event. Manual inspection remains available.
      gsap.killTweensOf(this.camera.position);
      gsap.killTweensOf(this.controls.target);
    }
    this.lastStatus = this.model.status;
    if (reset) { this.lastEvent = -1; this.lastFollowTime = -10; }
    const cinematic = this.automatic && !this.reducedMotion && this.model.status === 'running' && performance.now() > this.manualUntil;
    this.controls.autoRotate = cinematic;
    this.controls.autoRotateSpeed = 0.16;
    if (cinematic && simulationAdvanced && this.model.time - this.lastFollowTime > 9) {
      const event = [...this.model.events].reverse().find((entry) => entry.id > this.lastEvent && (entry.type === 'infection' || entry.type === 'replication' || entry.type === 'recovery'));
      if (event) {
        this.lastEvent = event.id;
        this.lastFollowTime = this.model.time;
        // Keep neighboring cells in view rather than jumping into a single object.
        this.moveTo({ x: event.position.x * 0.18, y: event.position.y * 0.18, z: event.position.z * 0.15 }, Math.max(30, this.home.length() * 0.88));
      }
    }
    this.controls.update(delta);
  }

  dispose(): void {
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);
    this.controls.removeEventListener('start', this.onManual);
    this.controls.dispose();
  }
}
