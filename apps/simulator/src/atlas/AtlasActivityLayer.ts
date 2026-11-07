import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {fractional,PHASE_NAMES,REGION_ANCHORS,type VisualRegion} from '../journey/visualState';
import type {RegionId} from '../journey/types';

export function virusGeometry():T.BufferGeometry {
  const core=new T.IcosahedronGeometry(.0044,1),directions=new T.IcosahedronGeometry(1,0).getAttribute('position');
  const pieces:T.BufferGeometry[]=[core];const seen=new Set<string>();
  for(let i=0;i<directions.count;i++){
    const direction=new T.Vector3().fromBufferAttribute(directions,i).normalize(),key=direction.toArray().map(x=>x.toFixed(3)).join(',');if(seen.has(key))continue;seen.add(key);
    const cone=new T.ConeGeometry(.001,.003,4),spike=cone.toNonIndexed();cone.dispose();const rotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction);
    spike.applyMatrix4(new T.Matrix4().compose(direction.clone().multiplyScalar(.0052),rotation,new T.Vector3(1,1,1)));pieces.push(spike);
  }
  const merged=mergeGeometries(pieces,false);for(const geometry of pieces)geometry.dispose();if(!merged)throw new Error('Não foi possível construir a geometria das partículas virais.');return merged;
}
const at=(id:RegionId)=>new T.Vector3(...REGION_ANCHORS[id]);
const fieldMaterial=(color:string,opacity:number)=>new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,depthTest:false});
const materialColor=new T.Color();
/** Bounded, schematic actors. Every semantic state comes from the current model,
 * and every phase comes from the same simulation clock used by replay/seek. */
export class AtlasActivityLayer {
  readonly group=new T.Group();
  private readonly viruses=new T.InstancedMesh(virusGeometry(),new T.MeshBasicMaterial({color:'#cc3b75',depthTest:false,depthWrite:false}),120);
  private readonly defenders=new T.InstancedMesh(new T.IcosahedronGeometry(.007,2),new T.MeshBasicMaterial({color:'#498ed2',depthTest:false,depthWrite:false}),48);
  private readonly nuclei=new T.InstancedMesh(new T.IcosahedronGeometry(.0027,1),new T.MeshBasicMaterial({color:'#dceeff',depthTest:false,depthWrite:false}),48);
  private readonly transform=new T.Object3D();
  private readonly nodes:{id:RegionId;core:T.Mesh<T.TorusGeometry,T.MeshBasicMaterial>;wave:T.Mesh<T.TorusGeometry,T.MeshBasicMaterial>;damage:T.Mesh<T.TorusGeometry,T.MeshBasicMaterial>;pin:HTMLButtonElement;title:HTMLElement;caption:HTMLElement}[]=[];
  private readonly links:{from:RegionId;to:RegionId;curve:T.CatmullRomCurve3;mesh:T.Mesh}[]=[];
  private lastKey='';
  constructor(host:HTMLElement,scene:T.Scene,onRegion:(id:RegionId)=>void){
    this.group.name='h1n1-semantic-activity';scene.add(this.group);
    for(const mesh of [this.viruses,this.defenders,this.nuclei]){mesh.count=0;mesh.frustumCulled=false;mesh.renderOrder=8;this.group.add(mesh);}
    const ids=Object.keys(REGION_ANCHORS) as RegionId[];
    ids.forEach((id,index)=>{
      const center=at(id);center.z+=.014;
      const core=new T.Mesh(new T.TorusGeometry(.018,.0015,5,32),fieldMaterial('#ce4878',.8));
      const wave=new T.Mesh(new T.TorusGeometry(.02,.0008,4,32),fieldMaterial('#ce4878',.5));
      const damage=new T.Mesh(new T.TorusGeometry(.027,.0022,5,32),fieldMaterial('#d59d4b',.6));
      for(const object of [core,wave,damage]){object.position.copy(center);object.renderOrder=7;this.group.add(object);}
      const pin=document.createElement('button');pin.className='h1n1-pin';pin.type='button';pin.textContent=String(index+1);pin.addEventListener('click',()=>onRegion(id));
      const label=document.createElement('span');label.className='h1n1-pin-label';const title=document.createElement('strong'),caption=document.createElement('small');label.append(title,caption);pin.append(label);host.append(pin);
      this.nodes.push({id,core,wave,damage,pin,title,caption});
      if(index>0){const from=ids[index-1]!,a=at(from),b=at(id),middle=a.clone().lerp(b,.5).add(new T.Vector3(.008,0,.02));const curve=new T.CatmullRomCurve3([a,middle,b]);const mesh=new T.Mesh(new T.TubeGeometry(curve,20,.0009,4,false),fieldMaterial('#c9477b',.45));mesh.renderOrder=6;this.group.add(mesh);this.links.push({from,to:id,curve,mesh});}
    });
  }
  update(regions:VisualRegion[],selected:RegionId,hour:number,visualHour:number,camera:T.PerspectiveCamera,width:number,height:number,enabled:boolean,reduced:boolean):void {
    this.group.visible=enabled;
    const key=`${hour}:${selected}:`+regions.map(r=>`${r.phase}/${r.counts.exposed}/${r.counts.infected}/${r.counts.recovering}/${r.counts.controlled}/${Math.round(r.inflammation)}`).join(':');
    const regionsById=new Map(regions.map(region=>[region.id,region]));let vi=0,di=0;
    const time=reduced?hour:visualHour;
    for(const [index,node]of this.nodes.entries()){
      const region=regionsById.get(node.id)!;const active=region.phase!=='quiet';const center=at(node.id);
      if(key!==this.lastKey){
        node.pin.style.setProperty('--zone-color',region.color);node.pin.classList.toggle('is-quiet',!active);node.pin.setAttribute('aria-pressed',String(selected===node.id));node.pin.setAttribute('aria-label',`Inspecionar ${region.name} no 3D: ${PHASE_NAMES[region.phase]}`);node.title.textContent=region.name;node.caption.textContent=region.counts.infected?`${region.counts.infected} infectadas · ${region.counts.controlled} controladas`:region.counts.exposed?`${region.counts.exposed} expostas · nenhuma infectada`:PHASE_NAMES[region.phase];
        node.core.material.color.set(region.color);node.wave.material.color.set(region.color);
      }
      node.core.visible=active||selected===node.id;node.core.quaternion.copy(camera.quaternion);node.core.scale.setScalar(selected===node.id?1.15:1);
      const cycle=fractional(time/4+index*.19);node.wave.visible=active&&region.phase!=='controlled'&&!reduced;node.wave.quaternion.copy(camera.quaternion);node.wave.scale.setScalar(1+cycle*1.5);node.wave.material.opacity=(1-cycle)*.42;
      node.damage.visible=region.inflammation>4||region.counts.damaged+region.counts.removed>0;node.damage.quaternion.copy(camera.quaternion);node.damage.material.opacity=Math.min(.85,.25+region.inflammation/100);node.damage.scale.setScalar(1+region.inflammation/130);
      const projected=center.clone().add(new T.Vector3(0,0,.028)).project(camera),x=(projected.x+1)*width/2,y=(1-projected.y)*height/2;
      node.pin.hidden=!enabled||projected.z< -1||projected.z>1||x<12||x>width-12||y<14||y>height-14;
      node.pin.style.left=`${x}px`;node.pin.style.top=`${y}px`;node.pin.classList.toggle('is-left',x>width-190);
      const count=Math.min(14,Math.ceil(region.viruses/5));
      for(let i=0;i<count&&vi<112;i++){
        const t=fractional(time/6+i/Math.max(1,count)),angle=i*2.399+index*.9;
        const replication=region.phase==='replication';const radius=replication?.006+t*.026:.014;
        this.transform.position.copy(center).add(new T.Vector3(Math.cos(angle)*radius,replication?t*.03:(1-t)*.032,Math.sin(angle)*radius+.02));
        this.transform.rotation.set(t*1.2,angle,t);this.transform.scale.setScalar(region.phase==='controlled'?1-t*.6:1);this.transform.updateMatrix();this.viruses.setMatrixAt(vi,this.transform.matrix);this.viruses.setColorAt(vi,materialColor.set('#ffffff'));vi++;
      }
      const engaged=region.defense>12&&(region.counts.infected+region.counts.exposed+region.counts.controlled>0);
      for(let i=0;i<(engaged?Math.min(7,region.defenders):0)&&di<48;i++){
        const t=fractional(time/8+i*.23),angle=i*2.399+index;const radius=.047-t*.031;
        this.transform.position.copy(center).add(new T.Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius,.033));this.transform.scale.setScalar(1);this.transform.updateMatrix();this.defenders.setMatrixAt(di,this.transform.matrix);
        this.transform.position.z+=.006;this.transform.updateMatrix();this.nuclei.setMatrixAt(di,this.transform.matrix);di++;
      }
    }
    for(const link of this.links){
      const source=regionsById.get(link.from)!,destination=regionsById.get(link.to)!;const flowing=source.viral>.08&&destination.receiving&&destination.viral>.08;
      link.mesh.visible=flowing;
      if(flowing)for(let i=0;i<2&&vi<120;i++){const t=fractional(time/8+i*.5);this.transform.position.copy(link.curve.getPoint(t));this.transform.scale.setScalar(.85);this.transform.rotation.set(t*2,0,t);this.transform.updateMatrix();this.viruses.setMatrixAt(vi,this.transform.matrix);this.viruses.setColorAt(vi,materialColor.set('#ffffff'));vi++;}
    }
    this.viruses.count=vi;this.defenders.count=this.nuclei.count=di;
    for(const mesh of [this.viruses,this.defenders,this.nuclei])mesh.instanceMatrix.needsUpdate=true;
    if(this.viruses.instanceColor)this.viruses.instanceColor.needsUpdate=true;
    this.lastKey=key;
  }
  dispose(){for(const node of this.nodes)node.pin.remove();this.group.traverse(object=>{if(object instanceof T.Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();if(object instanceof T.InstancedMesh)object.dispose();}});this.group.removeFromParent();this.group.clear();}
}
