import { ACESFilmicToneMapping, AmbientLight, DirectionalLight, FogExp2, HemisphereLight, InstancedMesh, Mesh, PerspectiveCamera, Raycaster, Scene, UnsignedByteType, Vector2, Vector3, WebGPURenderer, type BufferGeometry, type Object3D } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap } from 'gsap';
import { LEVELS, anatomyRegion } from '../../journey/anatomy';
import type { AnatomyLevel, JourneyRenderContext, JourneyRendererInfo, RegionId } from '../../journey/types';
import { buildJourneyScene, type SceneParts, type RespiratoryAsset } from './scenes';

export interface JourneyRendererCallbacks {
  onAdvance: (seconds: number) => void;
  onReady: (info: JourneyRendererInfo) => void;
  onError: (message: string) => void;
  onSelectRegion: (id: RegionId) => void;
  onSelectCell: (slot: number) => void;
  onNavigate: (level: AnatomyLevel) => void;
}
export type CameraAction = 'left' | 'right' | 'in' | 'out';

/** Specialized anatomical scenes share one read-only context and the same hour clock. */
export class JourneyRenderer {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(38,1,.05,140);
  private readonly controls: OrbitControls;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly resizeObserver: ResizeObserver;
  private readonly tooltip: HTMLDivElement;
  private active: SceneParts | null = null;
  private sceneKey = '';
  private disposed = false;
  private started = false;
  private frame = 0;
  private previousTime = 0;
  private reportStart = 0;
  private reportFrames = 0;
  private slowReports = 0;
  private motion = 0;
  private manualUntil = 0;
  private transitioningUntil = 0;
  private down: { x:number;y:number } | null = null;
  private hoverAt = 0;
  private lastNavigate = 0;
  private homeDistance = 20;
  private homeTarget = new Vector3();
  private dpr: number;
  private readonly info: JourneyRendererInfo;

  static async create(canvas: HTMLCanvasElement, getContext:()=>JourneyRenderContext, callbacks:JourneyRendererCallbacks):Promise<JourneyRenderer>{
    const forceWebGL = new URLSearchParams(location.search).get('renderer')==='webgl'||!('gpu'in navigator);
    let renderer=new WebGPURenderer({canvas,antialias:true,alpha:true,forceWebGL,outputBufferType:UnsignedByteType});
    try{await renderer.init();}catch(error){renderer.dispose();if(forceWebGL)throw new Error('WebGL 2 não pôde iniciar. Verifique a aceleração gráfica.',{cause:error});renderer=new WebGPURenderer({canvas,antialias:true,alpha:true,forceWebGL:true,outputBufferType:UnsignedByteType});try{await renderer.init();}catch(fallbackError){renderer.dispose();throw new Error('WebGPU e WebGL 2 não puderam iniciar.',{cause:fallbackError});}}
    let humanGeometry:BufferGeometry|undefined;
    let instance:JourneyRenderer|undefined;
    const respiratoryAssets:RespiratoryAsset[]=[];
    try{
      // Distributed local CC BY 4.0 anatomical assets; no remote model/font/API is requested in runtime.
      const model=await new GLTFLoader().loadAsync('/models/human-body.glb');
      model.scene.traverse(object=>{if(object instanceof Mesh&&!humanGeometry){humanGeometry=object.geometry;for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});
      if(!humanGeometry)throw new Error('O modelo anatômico local não contém uma superfície humana.');
      const respiratory=await new GLTFLoader().loadAsync('/models/respiratory-atlas.glb');
      respiratory.scene.updateMatrixWorld(true);
      respiratory.scene.traverse(object=>{if(object instanceof Mesh){object.geometry.applyMatrix4(object.matrixWorld);respiratoryAssets.push({geometry:object.geometry,name:object.name,kind:object.userData.kind==='airway'?'airway':'lobe',sourceStructures:object.userData.sourceStructures});for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});
      if(!respiratoryAssets.length)throw new Error('O atlas pulmonar local não contém estruturas.');
      instance=new JourneyRenderer(canvas,getContext,callbacks,renderer,humanGeometry,respiratoryAssets);
      await renderer.compileAsync(instance.scene,instance.camera);
      renderer.render(instance.scene,instance.camera);callbacks.onReady(instance.getDiagnostics());return instance;
    }catch(error){if(instance)instance.dispose();else{humanGeometry?.dispose();respiratoryAssets.forEach(asset=>asset.geometry.dispose());renderer.dispose();}throw error;}
  }

  private constructor(private readonly canvas:HTMLCanvasElement,private readonly getContext:()=>JourneyRenderContext,private readonly callbacks:JourneyRendererCallbacks,private readonly renderer:WebGPURenderer,private readonly humanGeometry:BufferGeometry,private readonly respiratoryAssets:readonly RespiratoryAsset[]){
    const mobile=matchMedia('(max-width:767px)').matches;
    this.dpr=Math.min(devicePixelRatio||1,mobile?1.25:1.5);
    this.info={backend:(renderer.backend as unknown as {isWebGPUBackend?:boolean}).isWebGPUBackend?'WebGPU':'WebGL 2',fps:0,quality:mobile?'Equilibrada':'Alta',geometries:0,textures:0,drawCalls:0,triangles:0,activeLevel:'body'};
    renderer.setPixelRatio(this.dpr);renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    this.scene.background=null;renderer.setClearColor('#f5f7f8',0);this.scene.fog=new FogExp2('#f5f7f8',.002);
    const key=new DirectionalLight('#fff6ee',2.6);key.position.set(-5,8,8);
    const fill=new DirectionalLight('#cadce9',.65);fill.position.set(7,3,5);
    const rim=new DirectionalLight('#e4f1ff',1.4);rim.position.set(0,5,-7);
    this.scene.add(new AmbientLight('#d9e2e9',.2),new HemisphereLight('#ffffff','#8fa3b3',.7),key,fill,rim);
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enableDamping=true;this.controls.dampingFactor=.075;this.controls.rotateSpeed=.48;this.controls.panSpeed=.45;this.controls.zoomSpeed=.7;this.controls.maxPolarAngle=Math.PI*.88;this.controls.minPolarAngle=Math.PI*.1;
    this.controls.addEventListener('start',this.onManual);
    this.tooltip=document.createElement('div');this.tooltip.className='journey-3d-tooltip';this.tooltip.setAttribute('role','tooltip');this.tooltip.style.cssText='position:absolute;display:none;pointer-events:none;z-index:4;padding:8px 11px;border:1px solid #ccd7df;border-radius:7px;background:#ffffff;color:#273c4b;font:12px system-ui;box-shadow:0 5px 25px #233e4d18;max-width:220px';canvas.parentElement?.appendChild(this.tooltip);
    canvas.addEventListener('pointerdown',this.onPointerDown);canvas.addEventListener('pointerup',this.onPointerUp);canvas.addEventListener('pointermove',this.onPointerMove);canvas.addEventListener('pointerleave',this.onPointerLeave);canvas.addEventListener('pointercancel',this.onPointerCancel);canvas.addEventListener('webglcontextlost',this.onContextLost);
    document.addEventListener('visibilitychange',this.onVisibility);
    this.resizeObserver=new ResizeObserver(this.resize);this.resizeObserver.observe(canvas.parentElement??canvas);
    this.refreshContext(true);this.resize();
  }

  private refreshContext(immediate=false):void{
    const ctx=this.getContext();
    const key=`${ctx.level}:${ctx.regionId}:${ctx.level==='cell'?ctx.selectedCellSlot:''}`;
    if(key===this.sceneKey)return;
    gsap.killTweensOf(this.camera.position);gsap.killTweensOf(this.controls.target);
    if(this.active){this.scene.remove(this.active.group);this.active.dispose();}
    this.active=buildJourneyScene(ctx,this.humanGeometry,this.respiratoryAssets);this.scene.add(this.active.group);this.sceneKey=key;this.info.activeLevel=ctx.level;
    this.tooltip.style.display='none';
    this.setAnchor(immediate||ctx.reducedMotion);
  }
  private resize=():void=>{
    if(this.disposed)return;const bounds=(this.canvas.parentElement??this.canvas).getBoundingClientRect();
    this.camera.aspect=Math.max(1,bounds.width)/Math.max(1,bounds.height);this.camera.updateProjectionMatrix();this.renderer.setSize(Math.max(1,bounds.width),Math.max(1,bounds.height),false);this.setAnchor(true);
  };
  private setAnchor(immediate:boolean):void{
    if(!this.active)return;const {extent,target,minDistance}=this.active;this.homeTarget.copy(target);
    const tan=Math.tan(this.camera.fov*Math.PI/360);const fit=Math.max(extent.y/tan,extent.x/(tan*Math.max(.3,this.camera.aspect)))*1.11;
    this.homeDistance=fit;this.controls.minDistance=minDistance;this.controls.maxDistance=fit*2.1;
    const ctx=this.getContext();const direction=ctx.level==='body'||ctx.level==='respiratory'?new Vector3(.18,.025,1):ctx.level==='organ'?new Vector3(.24,.12,1):ctx.level==='tissue'?new Vector3(.15,.78,1):new Vector3(.25,.13,1);direction.normalize();
    const eye=target.clone().addScaledVector(direction,fit);const duration=immediate?0:.65;
    if(immediate){this.controls.target.copy(target);this.camera.position.copy(eye);this.controls.update();}
    else{gsap.to(this.controls.target,{x:target.x,y:target.y,z:target.z,duration,ease:'power2.inOut'});gsap.to(this.camera.position,{x:eye.x,y:eye.y,z:eye.z,duration,ease:'power2.inOut'});}
    this.transitioningUntil=performance.now()+duration*1000;this.manualUntil=performance.now()+3000;
  }
  private onManual=():void=>{this.manualUntil=performance.now()+16000;gsap.killTweensOf(this.camera.position);gsap.killTweensOf(this.controls.target);};
  private onVisibility=():void=>{this.previousTime=0;this.reportStart=0;this.reportFrames=0;};
  private onContextLost=(event:Event):void=>{event.preventDefault();this.callbacks.onError('O contexto gráfico foi perdido. Recarregue a cena para continuar a partir dos controles.');};
  private onPointerDown=(event:PointerEvent):void=>{if(event.button===0)this.down={x:event.clientX,y:event.clientY};};
  private onPointerCancel=():void=>{this.down=null;};
  private intersect(event:PointerEvent){const box=this.canvas.getBoundingClientRect();this.pointer.set((event.clientX-box.left)/box.width*2-1,-(event.clientY-box.top)/box.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);for(const object of this.active?.pickables??[])if(object instanceof InstancedMesh)object.computeBoundingSphere();return this.raycaster.intersectObjects(this.active?.pickables??[],false).find(hit=>hit.object.visible);}
  private onPointerUp=(event:PointerEvent):void=>{
    const down=this.down;this.down=null;if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)return;
    const hit=this.intersect(event);if(!hit)return;
    const ctx=this.getContext();
    if(hit.object.userData.cellPick&&hit.instanceId!==undefined){const cell=ctx.snapshot.regions.find(r=>r.regionId===ctx.regionId)?.cells[hit.instanceId];if(cell){this.callbacks.onSelectCell(cell.slot);this.callbacks.onNavigate('cell');}}
    else if(hit.object.userData.regionId){const id=hit.object.userData.regionId as RegionId;this.callbacks.onSelectRegion(id);this.callbacks.onNavigate(ctx.level==='body'?(id==='nasal'||id==='trachea'?'respiratory':'organ'):ctx.level==='respiratory'?'organ':'tissue');}
  };
  private onPointerMove=(event:PointerEvent):void=>{
    if(event.buttons||performance.now()-this.hoverAt<70)return;this.hoverAt=performance.now();const hit=this.intersect(event);
    if(!hit){this.onPointerLeave();return;}
    const id=hit.object.userData.regionId as RegionId|undefined;
    const text=id?anatomyRegion(id).name:hit.instanceId!==undefined?`Célula epitelial ${hit.instanceId+1} · explorar`:'';
    if(!text){this.onPointerLeave();return;}this.tooltip.textContent=text;this.tooltip.style.display='block';const rect=this.canvas.getBoundingClientRect();this.tooltip.style.left=`${Math.min(rect.width-185,Math.max(8,event.clientX-rect.left+12))}px`;this.tooltip.style.top=`${Math.max(8,event.clientY-rect.top-40)}px`;this.canvas.style.cursor='pointer';
  };
  private onPointerLeave=():void=>{this.tooltip.style.display='none';this.canvas.style.cursor='grab';};

  start():void{if(this.started||this.disposed)return;this.started=true;this.frame=requestAnimationFrame(this.tick);}
  private tick=(timestamp:number):void=>{
    if(this.disposed)return;this.frame=requestAnimationFrame(this.tick);if(document.hidden){this.previousTime=0;return;}
    const delta=this.previousTime?Math.min(.1,(timestamp-this.previousTime)/1000):0;this.previousTime=timestamp;
    try{
      this.callbacks.onAdvance(delta);this.refreshContext();const ctx=this.getContext();this.motion=ctx.reducedMotion?ctx.snapshot.simulatedHour:(ctx.visualHour??ctx.snapshot.simulatedHour);
      this.controls.enableDamping=!ctx.reducedMotion;
      this.controls.autoRotate=ctx.playing&&ctx.autoCamera&&!ctx.reducedMotion&&performance.now()>this.manualUntil;this.controls.autoRotateSpeed=.12;
      this.controls.update(delta);this.active?.update(ctx,this.motion);this.renderer.render(this.scene,this.camera);
      if(this.camera.position.distanceTo(this.controls.target)<this.homeDistance*.44&&ctx.level!=='cell'&&performance.now()>this.transitioningUntil+800&&performance.now()-this.lastNavigate>1800){this.lastNavigate=performance.now();const next=LEVELS[LEVELS.findIndex(x=>x.id===ctx.level)+1];if(next)this.callbacks.onNavigate(next.id);}
    }catch(error){this.callbacks.onError(error instanceof Error?error.message:'A cena não pôde continuar.');this.dispose();return;}
    if(!this.reportStart){this.reportStart=timestamp;this.reportFrames=0;}else this.reportFrames++;
    if(timestamp-this.reportStart>=1200){this.info.fps=Math.round(this.reportFrames*1000/(timestamp-this.reportStart));this.reportFrames=0;this.reportStart=timestamp;this.slowReports=this.info.fps<28?this.slowReports+1:Math.max(0,this.slowReports-1);if(this.slowReports>=2&&this.dpr>1){this.dpr=1;this.info.quality='Compacta';this.renderer.setPixelRatio(1);this.resize();}this.callbacks.onReady(this.getDiagnostics());}
  };
  moveCamera(action:CameraAction):void{this.onManual();const offset=this.camera.position.clone().sub(this.controls.target);if(action==='left'||action==='right')offset.applyAxisAngle(new Vector3(0,1,0),action==='left'?-.22:.22);else offset.setLength(Math.max(this.controls.minDistance,Math.min(this.controls.maxDistance,offset.length()*(action==='in'?.78:1.28))));const p=offset.add(this.controls.target);gsap.to(this.camera.position,{x:p.x,y:p.y,z:p.z,duration:this.getContext().reducedMotion?0:.4,ease:'power2.out'});}
  resetCamera():void{this.onManual();this.setAnchor(this.getContext().reducedMotion);}
  getDiagnostics():JourneyRendererInfo{const memory=this.renderer.info.memory;const render=this.renderer.info.render;return {...this.info,geometries:memory.geometries,textures:memory.textures,drawCalls:render.calls,triangles:render.triangles};}
  dispose():void{if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.controls.removeEventListener('start',this.onManual);this.controls.dispose();gsap.killTweensOf(this.camera.position);gsap.killTweensOf(this.controls.target);this.active?.dispose();this.active=null;this.humanGeometry.dispose();this.respiratoryAssets.forEach(asset=>asset.geometry.dispose());this.tooltip.remove();this.canvas.removeEventListener('pointerdown',this.onPointerDown);this.canvas.removeEventListener('pointerup',this.onPointerUp);this.canvas.removeEventListener('pointermove',this.onPointerMove);this.canvas.removeEventListener('pointerleave',this.onPointerLeave);this.canvas.removeEventListener('pointercancel',this.onPointerCancel);this.canvas.removeEventListener('webglcontextlost',this.onContextLost);document.removeEventListener('visibilitychange',this.onVisibility);this.scene.clear();this.renderer.dispose();}
}
