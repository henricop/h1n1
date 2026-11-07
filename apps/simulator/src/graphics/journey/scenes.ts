import { BoxGeometry, BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, DynamicDrawUsage, Group, IcosahedronGeometry, InstancedMesh, LatheGeometry, Mesh, MeshBasicNodeMaterial, MeshPhysicalNodeMaterial, MeshStandardNodeMaterial, Object3D, SphereGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3, type Material } from 'three/webgpu';
import { abs, color, dot, float, mix, normalView, oneMinus, positionViewDirection, materialColor, positionLocal, smoothstep } from 'three/tsl';
import { virusSurface } from '../geometry';
import { anatomyRegion } from '../../journey/anatomy';
import { cellVisualScale, fractional } from '../../journey/visualState';
import type { CellStatus, JourneyCell, JourneyRenderContext, RegionId } from '../../journey/types';

export const STATUS_COLORS: Record<CellStatus, string> = {
  healthy: '#39bca8', exposed: '#d28cbd', infected: '#eb4f91', damaged: '#d18b4d', controlled: '#609de1', removed: '#59646a', recovering: '#7bc6a1',
};
const transform = new Object3D();
const rgbaColor = new Color();
const point = (x: number, y: number, z: number) => new Vector3(x, y, z);
const epithelialRadius=6.4;
const tissuePoint=(p:{x:number;y:number;z:number})=>point(epithelialRadius*Math.sin(p.x/epithelialRadius),p.y+epithelialRadius*(1-Math.cos(p.x/epithelialRadius)),p.z);
function curvedSheet(width:number,height:number,depth:number,elevation:number):BufferGeometry{
  const geometry=new BoxGeometry(width,height,depth,48,1,1);const p=geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){const mapped=tissuePoint({x:p.getX(i),y:p.getY(i)+elevation,z:p.getZ(i)});p.setXYZ(i,mapped.x,mapped.y,mapped.z);}
  geometry.computeVertexNormals();return geometry;
}
const simple = (hex: string, opacity = 1) => new MeshStandardNodeMaterial({ color: hex, roughness: .48, metalness: .08, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
const glow = (hex: string, opacity = 1) => new MeshBasicNodeMaterial({ color: hex, transparent: opacity < 1, opacity, depthWrite: false });

export function membraneMaterial(body = false): MeshPhysicalNodeMaterial {
  // The human surface is solid with an anatomical window. Blending the whole
  // closed mesh without depth writes exposes unsorted triangles as dark patches.
  const material = new MeshPhysicalNodeMaterial({ color: '#ffffff', vertexColors: body, roughness: body ? .8 : .42, metalness: 0, clearcoat: body ? 0 : .25, transparent: !body, depthWrite: body, alphaTest: body ? .5 : 0 });
  const rim = oneMinus(abs(dot(normalView, positionViewDirection))).clamp(0, 1).pow(1.8);
  // Use view direction rather than a back-end-specific shader; both WGSL/GLSL share the same graph.
  material.colorNode = body ? materialColor.mul(color('#c3c3b9')) : materialColor.mul(mix(color('#598da5'), color('#bed8e3'), rim));
  const thorax = smoothstep(1.55,2.05,positionLocal.y).mul(oneMinus(smoothstep(3.8,4.3,positionLocal.y))).mul(oneMinus(smoothstep(.75,1.35,abs(positionLocal.x))));
  const anterior = smoothstep(-.02,.2,positionLocal.z);
  material.opacityNode = body ? oneMinus(thorax.mul(anterior)) : mix(float(.32),float(.7),rim);
  return material;
}

export function epithelialGeometry(radius = .55, height = 1.25): BufferGeometry {
  const p = [new Vector2(0, -.5 * height), new Vector2(radius * .86, -.5 * height), new Vector2(radius, -.37 * height), new Vector2(radius, .31 * height), new Vector2(radius * .93, .47 * height), new Vector2(radius * .52, .55 * height), new Vector2(0, .55 * height)];
  return new LatheGeometry(p, 12);
}

export function lungGeometry(side: -1 | 1): BufferGeometry {
  // A tapered apex and broad diaphragmatic base read as a lung rather than a capsule.
  const profile = [[0,-1.02],[.28,-1.03],[.46,-.92],[.51,-.65],[.49,-.22],[.42,.22],[.32,.62],[.16,.98],[0,1.11]];
  const geo = new LatheGeometry(profile.map(([radius,y])=>new Vector2(radius!,y!)),32);
  const attr = geo.getAttribute('position');
  for (let i=0;i<attr.count;i++) {
    const x=attr.getX(i), y=attr.getY(i), z=attr.getZ(i);
    const medial=Math.max(0,-side*x/.51), anterior=Math.max(0,z/.51);
    const cardiacNotch=Math.exp(-(((y-.05)/.42)**2))*medial*anterior*(side===1?.22:.065);
    attr.setXYZ(i,x+side*cardiacNotch,y+Math.max(0,-y-.7)*.1,z*.73-cardiacNotch*.2);
  }
  geo.computeVertexNormals(); return geo;
}

function mesh(geometry: BufferGeometry, material: Material, name: string, parent: Group, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(geometry, material); m.name = name; m.position.set(x, y, z); parent.add(m); return m;
}
function tube(parent: Group, coords: number[][], radius: number, material: Material, name: string, region?: RegionId, segments = 24): Mesh {
  const curve = new CatmullRomCurve3(coords.map(p => point(p[0]!, p[1]!, p[2]!)));
  const m = mesh(new TubeGeometry(curve, segments, radius, 7, false), material, name, parent);
  if (region) m.userData.regionId = region;
  return m;
}
function instance(parent: Group, geometry: BufferGeometry, material: Material, capacity: number, name: string): InstancedMesh {
  const m = new InstancedMesh(geometry, material, capacity); m.name = name; m.count = 0; m.instanceMatrix.setUsage(DynamicDrawUsage); m.frustumCulled = false; parent.add(m); return m;
}
function matrixAt(m: InstancedMesh, i: number, position: Vector3, scale: Vector3 | number, rotation: Vector3 = point(0, 0, 0)): void {
  transform.position.copy(position); transform.rotation.set(rotation.x, rotation.y, rotation.z);
  if (typeof scale === 'number') transform.scale.setScalar(scale); else transform.scale.copy(scale);
  transform.updateMatrix(); m.setMatrixAt(i, transform.matrix);
}
function setInstanceColors(m: InstancedMesh): void { if (m.instanceColor) m.instanceColor.needsUpdate = true; m.instanceMatrix.needsUpdate = true; }

export interface RespiratoryAsset { geometry: BufferGeometry; name: string; kind: 'lobe' | 'airway'; sourceStructures?: unknown[]; }

export interface SceneParts {
  group: Group; pickables: Object3D[]; target: Vector3; extent: Vector2; minDistance: number;
  update(context: JourneyRenderContext, motion: number): void;
  dispose(): void;
}

/** One named scene at a time; geometry/material disposal is explicit on every scale change. */
export function buildJourneyScene(context: JourneyRenderContext, humanGeometry: BufferGeometry, respiratoryAssets: readonly RespiratoryAsset[] = []): SceneParts {
  const group = new Group(); group.name = `journey-${context.level}-${context.regionId}`;
  const pickables: Object3D[] = [];
  const updateFns: ((ctx: JourneyRenderContext, motion: number) => void)[] = [];
  let target = point(0, .56, 0), extent = new Vector2(3, 6.2), minDistance = 5;
  const regionMeshes = new Map<RegionId, Mesh[]>();
  const register = (region: RegionId, m: Mesh) => { m.userData.regionId = region; pickables.push(m); regionMeshes.set(region, [...(regionMeshes.get(region) ?? []), m]); };

  const respiratory = (parent: Group, detailed: boolean) => {
    const airway = simple('#4a91b6', .95);
    const nose = tube(parent, [[0,4.78,.71],[0,4.8,.36],[0,4.62,.12],[0,4.35,.08]], .105, airway, 'nasal-cavity-nasopharynx', 'nasal'); register('nasal', nose);
    const trachea = tube(parent, [[0,4.38,.08],[0,4.1,.17],[0,3.8,.22],[0,3.45,.22]], .12, simple('#4b91b8', .98), 'trachea', 'trachea'); register('trachea', trachea);
    const rings = instance(parent, new TorusGeometry(.13, .017, 5, 16), simple('#b6d3e1', .9), 14, 'tracheal-cartilage-rings'); rings.count = 14;
    for (let i=0;i<14;i++) matrixAt(rings,i,point(0,3.5+i*.062,.2),1,point(Math.PI/2,0,0)); rings.instanceMatrix.needsUpdate = true;
    for(const asset of respiratoryAssets){
      const material=asset.kind==='lobe'?membraneMaterial():simple('#397fa7',.98);
      const structure=mesh(asset.geometry,material,asset.kind==='lobe'?`${asset.name}-lung`:asset.name,parent);
      structure.userData.sourceStructures=asset.sourceStructures;structure.userData.atlas='HRA Female Lung v1.4';
      register(asset.kind==='lobe'?'bronchi':'bronchioles',structure);
    }
    for (const side of [-1,1] as const) {
      if(!respiratoryAssets.length){
      const lung = mesh(lungGeometry(side), membraneMaterial(), side===1?'left-lung':'right-lung',parent,side*.53,2.85,.1);lung.scale.x=.85; register('bronchi',lung);
      tube(parent,[[side*.7,3.54,.24],[side*.51,2.9,.49],[side*.2,2.21,.22]],.012,glow('#17474b',.65),`oblique-lobar-fissure-${side}`);
      if(side===-1)tube(parent,[[side*.76,3.16,.25],[side*.51,3.15,.5],[side*.2,3.13,.29]],.01,glow('#17474b',.6),'right-horizontal-lobar-fissure');
      }
      const main = tube(parent, [[0,3.45,.2],[side*.21,3.27,.1],[side*.4,3.14,.02]], .105, simple('#4c91b3', .98), `${side===1?'left':'right'}-primary-bronchus`,'bronchi'); register('bronchi',main);
      for(let branch=0;branch<(respiratoryAssets.length?0:detailed?9:5);branch++) {
        const f=branch/8; const x=side*(.4+.32*(branch%3)/2); const y=2+f*1.6; const z=.12+Math.sin(branch*2.2)*.2;
        const small=tube(parent, [[side*.4,3.1,.3],[x*.9,(3.1+y)/2,z],[x,y,z]], detailed?.037:.035, simple('#46bda7', .85), `bronchiole-${side}-${branch}`,'bronchioles',12); register('bronchioles',small);
      }
      if(detailed&&!respiratoryAssets.length){
        const sacs=instance(parent,new SphereGeometry(1,10,8),membraneMaterial(),30,`alveolar-clusters-${side}`); sacs.count=30; register('alveoli',sacs);
        for(let i=0;i<30;i++){const a=i*2.399; const yy=1.98+(i%6)*.25; matrixAt(sacs,i,point(side*(.56+Math.cos(a)*.25),yy,.2+Math.sin(a)*.35),.09+((i*13)%7)*.005);}sacs.instanceMatrix.needsUpdate=true;
      }
    }
  };

  if(context.level==='body'||context.level==='respiratory') {
    // This scale isolates the respiratory anatomy instead of magnifying a
    // full-body ghost whose head/legs would fall outside the camera framing.
    const body=context.level==='body'?mesh(humanGeometry,membraneMaterial(true),'human-anatomical-surface',group):null;
    if(body)body.renderOrder=-1;
    respiratory(group, context.level==='respiratory');
    const marker=mesh(new TorusGeometry(.16,.012,5,32),glow('#367ca4',.8),'selected-anatomical-anchor',group);
    updateFns.push(ctx=>{const a=anatomyRegion(ctx.regionId).bodyAnchor;marker.position.set(a.x,a.y,a.z+.08);});
    if(context.level==='respiratory'){target=point(0,3.4,.2);extent=new Vector2(1.65,1.95);minDistance=2.2;}
    updateFns.push((ctx,motion)=>{
      if(body)body.scale.y=ctx.playing&&!ctx.reducedMotion?1+Math.sin(motion*.9)*.002:1;
      for(const [id,meshes]of regionMeshes){const r=ctx.snapshot.regions.find(x=>x.regionId===id);if(!r)continue;
        const tint=new Color('#347fa8').lerp(new Color('#ed4b8c'),Math.min(.88,r.viralActivity/95)).lerp(new Color('#efb465'),r.inflammation/220);
        for(const m of meshes){const mat=m.material as MeshStandardNodeMaterial;const lungs=m.name.endsWith('-lung')?ctx.snapshot.regions.filter(x=>x.regionId==='bronchi'||x.regionId==='bronchioles'||x.regionId==='alveoli'):[];const lungViral=lungs.length?lungs.reduce((sum,x)=>sum+x.viralActivity,0)/lungs.length:r.viralActivity;mat.color.copy(m.name.endsWith('-lung')?new Color('#65a2bf').lerp(new Color('#ed4b8c'),Math.min(.88,lungViral/95)):tint); if(mat.emissive)mat.emissive.copy(mat.color).multiplyScalar(.05+lungViral*.0006);}
      }
    });
    // Entry tracer follows the actual exposure path only when this region has activity.
    const entry=instance(group,new IcosahedronGeometry(.045,1),simple('#fa659e'),14,'representative-respiratory-entry');
    updateFns.push((ctx,motion)=>{const r=ctx.snapshot.regions.find(x=>x.regionId==='nasal')!;entry.count=r.viralActivity>0?Math.min(ctx.level==='body'?6:14,Math.ceil(r.representativeViruses/2)):0;
      for(let i=0;i<entry.count;i++){const phase=(i/Math.max(1,entry.count)+(ctx.playing&&!ctx.reducedMotion?motion*.12:0))%1;matrixAt(entry,i,point(Math.sin(i*2.4)*.09,4.86-phase*.38,1.05-phase*.79),1);}entry.instanceMatrix.needsUpdate=true;});
  } else if(context.level==='organ') {
    const anchor=anatomyRegion(context.regionId).organAnchor;target=point(anchor.x,anchor.y,anchor.z);extent=new Vector2(2.55,2.05);minDistance=2;
    const organGroup=new Group();organGroup.name='regional-lung-bronchial-tree';group.add(organGroup);organGroup.scale.setScalar(1.7);organGroup.position.y=-4.82;
    respiratory(organGroup,true);
    // Reveal just lungs and lower airway in this anchor scene.
    for(const object of organGroup.children)if(object.name.includes('nasal')||object.name.includes('trachea')||object.name.includes('tracheal'))object.visible=false;
    const selected=ctxRegion(context);
    const cluster=new Group();cluster.name='representative-alveolar-unit';group.add(cluster);cluster.position.set(2.1,-.65,.55);cluster.visible=context.regionId==='alveoli';
    const sacs=instance(cluster,new SphereGeometry(1,16,12),membraneMaterial(),24,'alveolar-sac-membranes');sacs.count=24;register('alveoli',sacs);
    for(let i=0;i<24;i++){const a=i*2.399;const y=1-(i/23)*2;const r=Math.sqrt(Math.max(0,1-y*y));matrixAt(sacs,i,point(Math.cos(a)*r*.65,y*.7,Math.sin(a)*r*.6),.24);}sacs.instanceMatrix.needsUpdate=true;
    tube(cluster,[[0,1.3,0],[0,.8,0],[0,0,0]],.11,simple('#69bcac'),'alveolar-duct','bronchioles');
    updateFns.push(ctx=>{for(const [id,meshes]of regionMeshes){const r=ctx.snapshot.regions.find(x=>x.regionId===id);if(!r)continue;for(const m of meshes){const mat=m.material as MeshStandardNodeMaterial;mat.color.set(m.name.endsWith('-lung')?'#65a0ba':'#236b99').lerp(new Color('#ec538e'),r.viralActivity/110);}} sacs.material instanceof MeshPhysicalNodeMaterial && sacs.material.color.set('#75c7b6').lerp(new Color('#e15c96'),(ctx.snapshot.regions.find(r=>r.regionId==='alveoli')?.viralActivity??0)/130);});
    void selected;
  } else {
    const r=ctxRegion(context);
    const tissue=context.level==='tissue';
    target=tissue?point(0,.9,0):point(0,.25,0);extent=tissue?new Vector2(5.5,4.8):new Vector2(2.9,3);minDistance=tissue?3:2.4;
    const count=tissue?256:1;
    const membrane=instance(group,epithelialGeometry(tissue?.54:1.65,tissue?1.25:3.3),membraneMaterial(),count,tissue?'connected-respiratory-epithelium':'selected-epithelial-cell');
    membrane.userData.cellPick=true;pickables.push(membrane);
    const nuclei=instance(group,new SphereGeometry(1,20,14),simple('#6b8fae'),count,'cell-nuclei');
    const granules=instance(group,new IcosahedronGeometry(1,1),simple('#82bdb7'),count*3,'cell-organelles');
    const cilia=instance(group,new CylinderGeometry(.013,.018,.3,4),simple('#78c5bc',.8),count*7,'epithelial-cilia');
    if(tissue){
      mesh(curvedSheet(9.6,.35,8,-.84),simple('#b3cbd4'),'continuous-basal-tissue',group);
      const mucus=mesh(curvedSheet(9.4,.035,7.8,.93),new MeshPhysicalNodeMaterial({color:'#9fcbd5',roughness:.18,transparent:true,opacity:.11,depthWrite:false}),'mucus-film',group);mucus.renderOrder=4;
      // The connected basal layer and shared mucus surface remain visible across every cellular state.
    }else{
      const reticulum=new Group();reticulum.name='illustrative-endoplasmic-reticulum';group.add(reticulum);
      for(let i=0;i<5;i++){const a=i*.4;const arc=new CatmullRomCurve3([point(-.9,.1+i*.12,.2),point(-.7,.3+i*.12,-.6),point(.2,.4+i*.11,-.8),point(.8,.2+i*.1,-.2)]);mesh(new TubeGeometry(arc,18,.045,5,false),simple('#9ec9c4',.6),`reticulum-${a}`,reticulum);}
      const rnaGroup=new Group();rnaGroup.name='illustrative-viral-rna';group.add(rnaGroup);
      const vesicle=mesh(new SphereGeometry(.31,18,12),membraneMaterial(),'illustrative-entry-vesicle',group,0,1.13,.36);
      for(let i=0;i<8;i++){const a=i*.79;const curve=new CatmullRomCurve3([point(Math.cos(a)*.45,-.35,Math.sin(a)*.45),point(Math.cos(a+.3)*.7,.1,Math.sin(a+.3)*.7),point(Math.cos(a)*.6,.6,Math.sin(a)*.6)]);mesh(new TubeGeometry(curve,12,.024,4,false),glow('#f375ac'),`viral-rnp-${i+1}`,rnaGroup);}
      updateFns.push(ctx=>{const cell=selectedCell(ctx);rnaGroup.visible=cell.status==='infected';rnaGroup.scale.setScalar(Math.min(1,.25+cell.infectionAge/10));reticulum.visible=cell.status!=='removed';vesicle.visible=cell.status==='exposed'||(cell.status==='infected'&&cell.infectionAge<3);vesicle.position.y=cell.status==='exposed'?1.13:.8;});
    }
    const selection=mesh(new TorusGeometry(tissue?.65:1.88,.025,5,64),glow('#3f7eac',.85),'selected-cell-outline',group);selection.rotation.x=tissue?-Math.PI/2:0;
    updateFns.push((ctx,motion)=>{
      const cells=tissue?ctxRegion(ctx).cells.slice(0,256):[selectedCell(ctx)];membrane.count=nuclei.count=cells.length;granules.count=cells.length*3;cilia.count=cells.length*7;
      cells.forEach((cell,i)=>{
        const p=tissue?tissuePoint(cell.position):point(0,.2,0);
        const angle=tissue?cell.position.x/epithelialRadius:0;
        const local=(offset:Vector3)=>offset.applyAxisAngle(point(0,0,1),angle).add(p);
        const scale=cellVisualScale(cell,ctx.visualHour??ctx.snapshot.simulatedHour);
        const pulse=ctx.reducedMotion?1:1+Math.sin(motion*.8+cell.slot*.7)*.015;
        matrixAt(membrane,i,p,point(1,scale*pulse,1),point(0,0,angle));membrane.setColorAt(i,rgbaColor.set(STATUS_COLORS[cell.status]));
        matrixAt(nuclei,i,local(point(.03,cell.status==='removed'?-.5:.05,.08)),point(tissue?.22:.52,tissue?.25:.61,tissue?.19:.48).multiplyScalar(scale),point(0,0,angle));nuclei.setColorAt(i,rgbaColor.set(STATUS_COLORS[cell.status]).lerp(new Color('#c3d9ef'),.2));
        for(let k=0;k<3;k++){const a=k*2.1+cell.slot;matrixAt(granules,i*3+k,local(point(Math.cos(a)*(tissue?.3:.9),.12+Math.sin(a)*.15,Math.sin(a)*(tissue?.3:.9))),tissue?.06:.15);}
        for(let k=0;k<7;k++){const a=k*2.399,bend=ctx.reducedMotion?0:Math.sin(motion+cell.slot+k)*.09;matrixAt(cilia,i*7+k,local(point(Math.cos(a)*(tissue?.26:.8),(tissue?.8:2.05)*scale,Math.sin(a)*(tissue?.26:.8))),tissue?1:2,point(bend,0,angle+(ctx.reducedMotion?0:Math.cos(motion+k)*.06)));}
      });
      [membrane,nuclei,granules,cilia].forEach(setInstanceColors);
      selection.visible=ctx.selectedCellSlot!==null;
      const selected=tissue?cells.find(c=>c.slot===ctx.selectedCellSlot):cells[0];if(selected){selection.position.copy(tissue?tissuePoint({x:selected.position.x,y:1,z:selected.position.z}):point(0,.2,1.25));if(tissue)selection.rotation.set(-Math.PI/2,0,selected.position.x/epithelialRadius,'ZYX');(selection.material as MeshBasicNodeMaterial).color.set(STATUS_COLORS[selected.status]);}
    });
    const surface=virusSurface();const virusBodies=instance(group,new IcosahedronGeometry(.263,2),simple('#d73678'),120,'representative-virus-membranes');
    const virusHA=instance(group,surface.ha,simple('#f95f99'),120,'representative-ha-spikes');const virusNA=instance(group,surface.na,simple('#f6b6d3'),120,'representative-na-spikes');
    const defenders=instance(group,new IcosahedronGeometry(1,2),membraneMaterial(),24,'representative-immune-agents');const defenderNuclei=instance(group,new SphereGeometry(1,12,8),simple('#66a8ed'),24,'immune-agent-nuclei');
    updateFns.push((ctx,motion)=>{
      const reg=ctxRegion(ctx);const cell=selectedCell(ctx);const virusCount=tissue?Math.min(120,reg.representativeViruses):cell.status==='infected'&&cell.infectionAge>=4?Math.min(24,Math.max(1,Math.ceil(reg.representativeViruses/5))):cell.status==='exposed'||cell.status==='infected'?1:0;
      virusBodies.count=virusHA.count=virusNA.count=virusCount;
      const hot=reg.cells.filter(c=>c.status==='infected'||c.status==='exposed');
      for(let i=0;i<virusCount;i++){
        const c=tissue?hot[i%Math.max(1,hot.length)]??reg.cells[i%reg.cells.length]!:cell;const a=i*2.399;const phase=fractional((ctx.visualHour??ctx.snapshot.simulatedHour)/5+i/Math.max(1,virusCount));
        const origin=tissue?tissuePoint(c.position):point(0,0,0);
        const replicating=c.status==='infected'&&c.infectionAge>=4;
        const rr=tissue?(replicating?.25+phase*.65:.4):(replicating?.45+phase*1.35:1.1);
        const y=tissue?(replicating?1.05+phase*.7:2.05-phase*.85):(replicating?.6+phase*1.1:2.2-phase*1.1);
        const p=origin.add(point(Math.cos(a)*rr,y,Math.sin(a)*rr));
        const s=tissue?.4:.75;for(const m of[virusBodies,virusHA,virusNA])matrixAt(m,i,p,s,point(a+phase,a*.6,phase));
      }
      [virusBodies,virusHA,virusNA].forEach(setInstanceColors);
      const defenseCount=tissue?Math.min(24,reg.representativeDefenders):Math.min(3,reg.representativeDefenders);defenders.count=defenderNuclei.count=defenseCount;
      for(let i=0;i<defenseCount;i++){const c=hot[i%Math.max(1,hot.length)]??reg.cells[(i*7)%reg.cells.length]!;const base=tissue?tissuePoint(c.position):point(0,0,0);const a=i*2.4;const approaching=1-fractional((ctx.visualHour??ctx.snapshot.simulatedHour)/7+i/Math.max(1,defenseCount));const radius=(tissue?1.05:2.3)*approaching+(tissue?.45:.75);const p=base.add(point(Math.cos(a)*radius,tissue?1.3:.8,Math.sin(a)*radius));const s=tissue?.32:.67;matrixAt(defenders,i,p,point(s,s*1.1,s));defenders.setColorAt(i,rgbaColor.set('#6aaff5'));matrixAt(defenderNuclei,i,p.clone().add(point(0,0,s*.6)),s*.32);}
      [defenders,defenderNuclei].forEach(setInstanceColors);
    });
    void r;
  }

  const update=(ctx:JourneyRenderContext,motion:number)=>updateFns.forEach(fn=>fn(ctx,motion));
  update(context,0);
  return {group,pickables,target,extent,minDistance,update,dispose(){const geos=new Set<BufferGeometry>();const mats=new Set<Material>();group.traverse(o=>{if(o instanceof Mesh){if(o.geometry!==humanGeometry&&!respiratoryAssets.some(asset=>asset.geometry===o.geometry))geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);if(o instanceof InstancedMesh)o.dispose();}});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());group.clear();}};
}
export const ctxRegion=(ctx:JourneyRenderContext)=>ctx.snapshot.regions.find(r=>r.regionId===ctx.regionId)??ctx.snapshot.regions[0]!;
export const selectedCell=(ctx:JourneyRenderContext):JourneyCell=>ctxRegion(ctx).cells.find(c=>c.slot===ctx.selectedCellSlot)??ctxRegion(ctx).cells[0]!;
