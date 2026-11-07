import {
  ACESFilmicToneMapping, AmbientLight, Color, DirectionalLight, DynamicDrawUsage, FogExp2,
  HemisphereLight, IcosahedronGeometry, InstancedMesh, Mesh, MeshBasicNodeMaterial,
  MeshStandardNodeMaterial, Object3D, PerspectiveCamera, Raycaster, Scene, SphereGeometry,
  TorusGeometry, UnsignedByteType, Vector2, Vector3, WebGPURenderer,
  type BufferGeometry, type Material,
} from 'three/webgpu';
import type { SimulationModel, CellState } from '../engine/types';
import { CameraController, type CameraAction } from './CameraController';
import { cellGeometry, virusSurface } from './geometry';
import { cellMaterial, immuneMaterial, unlitMaterial, virusMaterial } from './materials';

export interface RendererInfo { backend: 'WebGPU' | 'WebGL 2'; fps: number; quality: string }
export type { CameraAction } from './CameraController';
export interface RendererCallbacks {
  onSelect: (id: number | null) => void;
  onReady: (info: RendererInfo) => void;
  onError: (message: string) => void;
}

const CELL_COLORS: Record<CellState, Color> = {
  healthy: new Color('#f0eaf9'), infected: new Color('#d07996'), recovered: new Color('#acdac5'),
};
const CORE_COLORS: Record<CellState, Color> = {
  healthy: new Color('#78658f'), infected: new Color('#792e51'), recovered: new Color('#47836f'),
};

/** Imperative bridge: only engine arrays and GPU buffers change per frame, never React state. */
export class MicroscopeRenderer {
  readonly info: RendererInfo;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(39, 1, 0.1, 180);
  private readonly cameraController: CameraController;
  private readonly transform = new Object3D();
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly cells: InstancedMesh;
  private readonly nuclei: InstancedMesh;
  private readonly granules: InstancedMesh;
  private readonly virusBodies: InstancedMesh;
  private readonly virusHa: InstancedMesh;
  private readonly virusNa: InstancedMesh;
  private readonly immuneBodies: InstancedMesh;
  private readonly immuneCores: InstancedMesh;
  private readonly dust: InstancedMesh;
  private readonly selection: Mesh<TorusGeometry, MeshBasicNodeMaterial>;
  private readonly eventRings: Mesh<TorusGeometry, MeshBasicNodeMaterial>[] = [];
  private readonly meshes: InstancedMesh[] = [];
  private readonly resizeObserver: ResizeObserver;
  private selectedId: number | null = null;
  private pointerDown: { x: number; y: number } | null = null;
  private frame = 0;
  private previousTimestamp = 0;
  private reportStart = 0;
  private reportFrames = 0;
  private slowWindows = 0;
  private disposed = false;
  private started = false;
  private reducedMotion = false;
  private capacity: number;
  private pixelRatio: number;
  private lastSeed: number;
  private hidden = false;

  static async create(canvas: HTMLCanvasElement, model: SimulationModel, callbacks: RendererCallbacks): Promise<MicroscopeRenderer> {
    const forceWebGL = new URLSearchParams(window.location.search).get('renderer') === 'webgl' || !('gpu' in navigator);
    let gpu = new WebGPURenderer({ canvas, antialias: true, alpha: false, forceWebGL, outputBufferType: UnsignedByteType });
    try {
      await gpu.init();
    } catch (error) {
      gpu.dispose();
      if (forceWebGL) {
        const message = 'Este navegador não conseguiu inicializar WebGL 2.';
        callbacks.onError('Não foi possível iniciar a cena 3D. Ative a aceleração gráfica ou use um navegador com WebGL 2.');
        throw new Error(message, { cause: error });
      }
      gpu = new WebGPURenderer({ canvas, antialias: true, alpha: false, forceWebGL: true, outputBufferType: UnsignedByteType });
      try { await gpu.init(); } catch (fallbackError) {
        gpu.dispose();
        callbacks.onError('WebGPU e WebGL 2 não estão disponíveis. Ative a aceleração gráfica para abrir o simulador.');
        throw new Error('Nenhum backend gráfico disponível', { cause: fallbackError });
      }
    }
    let result: MicroscopeRenderer | null = null;
    try {
      result = new MicroscopeRenderer(canvas, model, gpu, callbacks);
      await gpu.compileAsync(result.scene, result.camera);
      if (!result.disposed) {
        gpu.render(result.scene, result.camera);
        callbacks.onReady({ ...result.info });
      }
      return result;
    } catch (error) {
      if (result) result.dispose(); else gpu.dispose();
      callbacks.onError('O navegador não conseguiu compilar a cena 3D. Tente o modo WebGL 2 ou atualize o navegador.');
      throw error;
    }
  }

  private constructor(private readonly canvas: HTMLCanvasElement, private readonly model: SimulationModel, private readonly renderer: WebGPURenderer, private readonly callbacks: RendererCallbacks) {
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    this.capacity = Math.max(1000, model.config.maxViruses);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
    this.lastSeed = model.config.seed;
    this.info = { backend: (renderer.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL 2', fps: 0, quality: mobile ? 'Equilibrada' : 'Alta' };
    renderer.setPixelRatio(this.pixelRatio);
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    this.scene.background = new Color('#f4f2ef');
    this.scene.fog = new FogExp2('#f4f2ef', 0.003);
    this.scene.add(new AmbientLight('#ffffff', 0.4), new HemisphereLight('#fff9f2', '#a08aaa', 1.05));
    const key = new DirectionalLight('#fff6e9', 2.6); key.position.set(-9, 14, 18);
    const fill = new DirectionalLight('#d8e5f5', 0.8); fill.position.set(14, 1, 8);
    const rim = new DirectionalLight('#f5c5d1', 1.4); rim.position.set(0, 8, -15);
    this.scene.add(key, fill, rim);
    const soft = cellMaterial();
    const bodyGeo = cellGeometry();
    this.cells = this.instanced(bodyGeo, soft, 256);
    this.nuclei = this.instanced(new SphereGeometry(1, 16, 10), new MeshStandardNodeMaterial({ color: '#ffffff', roughness: 0.42 }), 256);
    this.granules = this.instanced(new IcosahedronGeometry(1, 1), new MeshStandardNodeMaterial({ color: '#e6dcea', roughness: 0.55 }), 256 * 3);
    const surface = virusSurface();
    this.virusBodies = this.instanced(new IcosahedronGeometry(0.263, 2), virusMaterial(), this.capacity);
    this.virusHa = this.instanced(surface.ha, new MeshStandardNodeMaterial({ color: '#b72f56', roughness: 0.45 }), this.capacity);
    this.virusNa = this.instanced(surface.na, new MeshStandardNodeMaterial({ color: '#edb3c0', roughness: 0.36 }), this.capacity);
    this.immuneBodies = this.instanced(cellGeometry(), immuneMaterial(), 40);
    this.immuneCores = this.instanced(new IcosahedronGeometry(1, 1), new MeshStandardNodeMaterial({ color: '#2c7668', roughness: 0.38 }), 40);
    this.dust = this.instanced(new IcosahedronGeometry(1, 0), unlitMaterial('#bcb2be', 0.32), 180);
    this.seedDust();
    this.selection = new Mesh(new TorusGeometry(1, 0.018, 5, 64), unlitMaterial('#685273', 0.8));
    this.selection.visible = false;
    this.scene.add(this.selection);
    for (let i = 0; i < 12; i++) {
      const ring = new Mesh(new TorusGeometry(1, 0.022, 5, 40), unlitMaterial('#bc607d', 0.6));
      ring.visible = false;
      this.eventRings.push(ring); this.scene.add(ring);
    }
    this.cameraController = new CameraController(this.camera, canvas, model);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.hidden = document.hidden;
    this.resize();
    this.updateInstances();
  }

  private instanced(geometry: BufferGeometry, material: Material, capacity: number): InstancedMesh {
    const mesh = new InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    // Dynamic matrices move beyond the initial bounding sphere. The chamber is small enough for one batch.
    mesh.frustumCulled = false;
    this.scene.add(mesh); this.meshes.push(mesh);
    return mesh;
  }

  private resize = (): void => {
    if (this.disposed) return;
    const rect = (this.canvas.parentElement ?? this.canvas).getBoundingClientRect();
    const width = Math.max(1, rect.width); const height = Math.max(1, rect.height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.cameraController.fitToViewport();
    this.renderer.setSize(width, height, false);
  };

  private seedDust(): void {
    let state = this.model.config.seed >>> 0;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    this.dust.count = this.info.quality === 'Compacta' ? 80 : 180;
    for (let i = 0; i < this.dust.count; i++) {
      this.transform.position.set((random() - 0.5) * 48, (random() - 0.5) * 30, (random() - 0.5) * 32);
      this.transform.rotation.set(0, 0, 0);
      this.transform.scale.setScalar(0.018 + random() * 0.029);
      this.transform.updateMatrix(); this.dust.setMatrixAt(i, this.transform.matrix);
    }
    this.dust.instanceMatrix.needsUpdate = true;
  }

  private updateInstances(): void {
    const time = this.model.time;
    if (this.lastSeed !== this.model.config.seed) { this.lastSeed = this.model.config.seed; this.seedDust(); }
    this.cells.count = Math.min(256, this.model.cells.length);
    this.nuclei.count = this.cells.count;
    this.granules.count = this.cells.count * 3;
    for (let i = 0; i < this.cells.count; i++) {
      const cell = this.model.cells[i]!;
      const pulse = this.reducedMotion ? 1 : 1 + Math.sin(time * 1.5 + cell.id * 0.9) * 0.025;
      const budding = cell.state === 'infected' ? Math.sin(Math.max(0, cell.replicationProgress) * Math.PI) * 0.045 : 0;
      const radius = cell.radius * (pulse + budding);
      this.transform.position.set(cell.position.x, cell.position.y, cell.position.z);
      this.transform.rotation.set(cell.id * 0.73, cell.id * 1.17, cell.id * 0.41);
      this.transform.scale.set(radius, radius * (0.94 + Math.sin(cell.id) * 0.06), radius);
      this.transform.updateMatrix(); this.cells.setMatrixAt(i, this.transform.matrix);
      this.cells.setColorAt(i, CELL_COLORS[cell.state]);
      this.transform.position.set(cell.position.x + radius * 0.1, cell.position.y + radius * 0.07, cell.position.z + radius * 0.2);
      this.transform.rotation.set(0, 0, 0);
      this.transform.scale.set(radius * 0.36, radius * 0.31, radius * 0.26);
      this.transform.updateMatrix(); this.nuclei.setMatrixAt(i, this.transform.matrix);
      this.nuclei.setColorAt(i, CORE_COLORS[cell.state]);
      for (let k = 0; k < 3; k++) {
        const angle = k * 2.09 + cell.id;
        this.transform.position.set(cell.position.x + Math.cos(angle) * radius * 0.47, cell.position.y + Math.sin(angle) * radius * 0.48, cell.position.z + radius * 0.35);
        this.transform.scale.set(radius * 0.095, radius * 0.075, radius * 0.065);
        this.transform.updateMatrix(); this.granules.setMatrixAt(i * 3 + k, this.transform.matrix);
      }
    }
    let vi = 0;
    for (const virus of this.model.viruses) {
      if (virus.state === 'neutralized' || vi >= this.capacity) continue;
      this.transform.position.set(virus.position.x, virus.position.y, virus.position.z);
      const rotationTime = this.reducedMotion ? 0 : time;
      this.transform.rotation.set(virus.phase + rotationTime * 0.21, virus.phase * 0.7 + rotationTime * 0.16, virus.phase * 1.6);
      const birth = Math.min(1, 0.3 + virus.age * 2.5);
      this.transform.scale.set(birth, birth * 0.94, birth);
      this.transform.updateMatrix();
      this.virusBodies.setMatrixAt(vi, this.transform.matrix);
      this.virusHa.setMatrixAt(vi, this.transform.matrix);
      this.virusNa.setMatrixAt(vi, this.transform.matrix);
      vi++;
    }
    this.virusBodies.count = this.virusHa.count = this.virusNa.count = vi;
    this.immuneBodies.count = Math.min(40, this.model.immuneCells.length);
    this.immuneCores.count = this.immuneBodies.count;
    for (let i = 0; i < this.immuneBodies.count; i++) {
      const immune = this.model.immuneCells[i]!;
      this.transform.position.set(immune.position.x, immune.position.y, immune.position.z);
      this.transform.rotation.set(immune.phase, immune.phase * 1.2 + (this.reducedMotion ? 0 : time * 0.12), 0);
      const pulse = this.reducedMotion ? 1 : 1 + Math.sin(time * 2 + immune.phase) * 0.04;
      this.transform.scale.set(0.59 * pulse, 0.67 * pulse, 0.59 * pulse);
      this.transform.updateMatrix(); this.immuneBodies.setMatrixAt(i, this.transform.matrix);
      this.transform.position.z += 0.48;
      this.transform.scale.set(0.21, 0.28, 0.13);
      this.transform.updateMatrix(); this.immuneCores.setMatrixAt(i, this.transform.matrix);
    }
    for (const mesh of this.meshes) {
      if (mesh === this.dust) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const selected = this.model.cells.find((cell) => cell.id === this.selectedId);
    this.selection.visible = Boolean(selected);
    if (selected) {
      this.selection.position.set(selected.position.x, selected.position.y, selected.position.z);
      this.selection.scale.setScalar(selected.radius * 1.35);
      this.selection.quaternion.copy(this.camera.quaternion);
    }
    let ringIndex = 0;
    for (const event of [...this.model.events].reverse()) {
      const age = time - event.time;
      if (age < 0 || age > 1.2 || ringIndex >= this.eventRings.length || event.type === 'seed' || event.type === 'complete') continue;
      const ring = this.eventRings[ringIndex++]!;
      ring.visible = true;
      ring.position.set(event.position.x, event.position.y, event.position.z);
      ring.quaternion.copy(this.camera.quaternion);
      ring.scale.setScalar(this.reducedMotion ? 1.2 : 0.4 + age * 1.4);
      ring.material.opacity = Math.max(0, 0.65 * (1 - age / 1.2));
      ring.material.color.set(event.type === 'recovery' || event.type === 'neutralization' ? '#499381' : '#b95779');
    }
    for (let i = ringIndex; i < this.eventRings.length; i++) this.eventRings[i]!.visible = false;
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button === 0) this.pointerDown = { x: event.clientX, y: event.clientY };
  };
  private onPointerCancel = (): void => { this.pointerDown = null; };
  private onPointerUp = (event: PointerEvent): void => {
    const down = this.pointerDown; this.pointerDown = null;
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.cells.computeBoundingSphere();
    const hit = this.raycaster.intersectObject(this.cells, false)[0];
    const cell = hit?.instanceId === undefined ? undefined : this.model.cells[hit.instanceId];
    this.selectedId = cell?.id ?? null;
    this.callbacks.onSelect(this.selectedId);
    if (cell) this.cameraController.focusCell(cell.id);
  };

  private onVisibility = (): void => {
    this.hidden = document.hidden;
    this.previousTimestamp = 0;
    this.reportStart = 0;
    this.reportFrames = 0;
  };

  start(): void {
    if (this.disposed || this.started) return;
    this.started = true;
    this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (timestamp: number): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    if (this.hidden) { this.previousTimestamp = 0; return; }
    const delta = this.previousTimestamp ? Math.min((timestamp - this.previousTimestamp) / 1000, 0.1) : 0;
    this.previousTimestamp = timestamp;
    try {
      this.model.advance(delta);
      this.cameraController.update(delta);
      this.updateInstances();
      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      this.callbacks.onError('A renderização foi interrompida. Reinicie a cena ou tente o modo WebGL 2.');
      this.dispose();
      return;
    }
    this.reportFrames++;
    if (!this.reportStart) this.reportStart = timestamp;
    if (timestamp - this.reportStart >= 1200) {
      this.info.fps = Math.round((this.reportFrames * 1000) / (timestamp - this.reportStart));
      this.reportFrames = 0; this.reportStart = timestamp;
      this.slowWindows = this.info.fps < 28 ? this.slowWindows + 1 : Math.max(0, this.slowWindows - 1);
      if (this.slowWindows >= 2 && this.pixelRatio > 1) {
        this.pixelRatio = 1; this.info.quality = 'Compacta';
        this.renderer.setPixelRatio(1); this.resize(); this.seedDust();
      }
      this.callbacks.onReady({ ...this.info });
    }
  };

  focusCell(id: number): void { this.selectedId = id; this.cameraController.focusCell(id); }
  clearSelection(): void { this.selectedId = null; this.selection.visible = false; }
  moveCamera(action: CameraAction): void { this.cameraController.manualMove(action); }
  resetCamera(): void { this.selectedId = null; this.callbacks.onSelect(null); this.cameraController.reset(); }
  setAutoCamera(enabled: boolean): void { this.cameraController.setAuto(enabled); }
  setReducedMotion(enabled: boolean): void { this.reducedMotion = enabled; this.cameraController.setReduced(enabled); }

  /** Clean up every GPU resource and browser subscription, including async StrictMode mounts. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.cameraController.dispose();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    document.removeEventListener('visibilitychange', this.onVisibility);
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      if (object instanceof InstancedMesh) object.dispose();
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this.scene.clear();
    this.renderer.dispose();
  }
}
