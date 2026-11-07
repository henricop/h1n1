import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, InstancedMesh, Mesh } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildJourneyScene, type RespiratoryAsset, epithelialGeometry, lungGeometry, membraneMaterial, STATUS_COLORS } from '../src/graphics/journey/scenes';
import { ANATOMY, LEVELS } from '../src/journey/anatomy';
import type { JourneyRenderContext, JourneySnapshot, RegionState } from '../src/journey/types';

function bodyAsset() {
  const bytes=readFileSync('public/models/human-body.glb');
  const jsonLength=bytes.readUInt32LE(12);const json=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
  const primitive=json.meshes[0].primitives[0];const accessor=json.accessors[primitive.attributes.POSITION];const view=json.bufferViews[accessor.bufferView];
  const start=28+jsonLength+(view.byteOffset??0)+(accessor.byteOffset??0);
  const position=Float32Array.from({length:accessor.count*3},(_,i)=>bytes.readFloatLE(start+i*4));
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(position,3));geometry.computeBoundingBox();
  return {bytes,json,accessor,geometry};
}

async function respiratoryAsset() {
  const bytes=readFileSync('public/models/respiratory-atlas.glb');
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
  const model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const assets:RespiratoryAsset[]=[];
  model.scene.traverse(object=>{if(object instanceof Mesh){assets.push({geometry:object.geometry,name:object.name,kind:object.userData.kind,sourceStructures:object.userData.sourceStructures});for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});
  return {bytes,json,assets};
}

function fixture():JourneyRenderContext{
  const regions:RegionState[]=ANATOMY.map(entry=>({regionId:entry.regionId,cells:Array.from({length:64},(_,slot)=>({id:`${entry.regionId}:${slot}:0`,slot,generation:0,status:slot%7===0?'infected':'healthy',sinceHour:3,age:48,position:{x:(slot%8-3.5)*1.07,y:0,z:(Math.floor(slot/8)-3.5)*.95},infectionAge:9,damage:0})),viralActivity:30,immuneActivity:40,inflammation:20,tissueIntegrity:90,healthyCellRatio:.8,exposedCellRatio:0,infectedCellRatio:.2,damagedCellRatio:0,recoveringCellRatio:0,representativeViruses:45,representativeDefenders:8,repairedCells:0,factors:['local-infection-activity']}));
  const snapshot:JourneySnapshot={scenarioId:'A',simulatedHour:48,config:{seed:2009,horizonDays:14,cellsPerRegion:64,initialConditions:{defense:.65,resilience:.6,protection:.15,vulnerability:.15,exposure:.55}},regions,body:{viralActivity:30,immuneActivity:40,inflammation:20,tissueIntegrity:90,discomfort:15,condition:85,stage:'response',factors:[],recoveryHour:null,worseningHour:null},events:[],activeEvents:[],log:[],history:[]};
  return {snapshot,level:'body',regionId:'bronchi',selectedCellSlot:0,reducedMotion:true,autoCamera:false,playing:false};
}

describe('redistributable full anatomical body',()=>{
  it('ships an actual compact glTF mesh with full-body dimensions and source identity',()=>{
    const {bytes,json,accessor,geometry}=bodyAsset();
    expect(bytes.subarray(0,4).toString()).toBe('glTF');expect(bytes.readUInt32LE(4)).toBe(2);expect(bytes.length).toBeLessThan(2_000_000);
    expect(accessor.count).toBeGreaterThan(45_000);expect(Array.from(geometry.attributes.position!.array).every(Number.isFinite)).toBe(true);
    expect(geometry.boundingBox!.max.y-geometry.boundingBox!.min.y).toBeGreaterThan(11);
    expect(geometry.boundingBox!.max.x-geometry.boundingBox!.min.x).toBeLessThan(4.5); // natural arms-near-body stance
    const vertexColor=json.accessors[json.meshes[0].primitives[0].attributes.COLOR_0];expect(vertexColor.count).toBe(accessor.count);expect(vertexColor.normalized).toBe(true);
    expect(json.nodes.some((node:{name?:string})=>node.name==='human-anatomical-surface')).toBe(true);
    expect(json.nodes.some((node:{extras?:{license?:string}})=>node.extras?.license==='CC-BY-4.0')).toBe(true);
    expect(readFileSync('public/models/BODYPARTS3D-CC-BY-4.0.txt','utf8')).toContain('BodyParts3D');geometry.dispose();
  });
});

describe('redistributable expert-reviewed respiratory anatomy',()=>{
  it('ships five real lung lobes and bilateral bronchial trees within the static asset budget',async()=>{
    const {bytes,json,assets}=await respiratoryAsset();
    expect(bytes.length).toBeLessThan(5_000_000);expect(assets.filter(x=>x.kind==='lobe')).toHaveLength(5);expect(assets.filter(x=>x.kind==='airway')).toHaveLength(2);
    expect(json.nodes.some((n:{extras?:{license?:string;creators?:string}})=>n.extras?.license==='CC-BY-4.0'&&n.extras.creators?.includes('Browne'))).toBe(true);
    expect(json.images).toBeUndefined();
    const source=assets.flatMap(x=>x.sourceStructures??[]);expect(source.length).toBeGreaterThan(40);
    for(const asset of assets){asset.geometry.computeBoundingBox();expect(asset.geometry.boundingBox!.min.y).toBeGreaterThanOrEqual(1.84);expect(asset.geometry.boundingBox!.max.y).toBeLessThan(3.9);expect(asset.geometry.attributes.normal?.count).toBe(asset.geometry.attributes.position!.count);asset.geometry.dispose();}
    expect(readFileSync('public/models/ATTRIBUTION.md','utf8')).toContain('10.48539/HBM994.HXJP.575');
  });
  it('uses the actual cached anatomy across scales without disposing it during scene swaps',async()=>{
    const {assets}=await respiratoryAsset();const body=bodyAsset().geometry;const ctx=fixture();let sharedDisposals=0;
    for(const asset of assets)asset.geometry.addEventListener('dispose',()=>sharedDisposals++);
    for(const level of ['body','respiratory','organ','tissue','cell'] as const){ctx.level=level;const scene=buildJourneyScene(ctx,body,assets);
      if(level==='body'||level==='respiratory'||level==='organ'){let actualMeshes=0;scene.group.traverse(object=>{if(object instanceof Mesh&&assets.some(x=>x.geometry===object.geometry)){actualMeshes++;expect(object.userData.atlas).toContain('HRA');}});expect(actualMeshes).toBe(7);expect(scene.group.getObjectByName('left-lung')).toBeUndefined();}
      scene.dispose();expect(sharedDisposals).toBe(0);
    }
    assets.forEach(x=>x.geometry.dispose());expect(sharedDisposals).toBe(7);body.dispose();
  });
});

describe('specialized active anatomical scenes',()=>{
  it('builds all five named scales with the correct pickable anatomy and finite repeated geometry',()=>{
    const ctx=fixture();const body=bodyAsset().geometry;
    for(const level of LEVELS){ctx.level=level.id;const scene=buildJourneyScene(ctx,body);expect(scene.group.name).toContain(level.id);expect(scene.pickables.length).toBeGreaterThan(0);
      scene.group.traverse(object=>{if(object instanceof Mesh){const attr=object.geometry.getAttribute('position');expect(attr?.count).toBeGreaterThan(0);expect(Array.from(attr.array).every(Number.isFinite)).toBe(true);}});
      if(level.id==='body')expect(scene.group.getObjectByName('human-anatomical-surface')).toBeDefined();
      if(level.id==='tissue'){expect(scene.group.getObjectByName('continuous-basal-tissue')).toBeDefined();expect(scene.group.getObjectByName('mucus-film')).toBeDefined();const cells=scene.group.getObjectByName('connected-respiratory-epithelium') as InstancedMesh;expect(cells.count).toBe(64);expect(cells.userData.cellPick).toBe(true);}
      if(level.id==='cell')expect(scene.group.getObjectByName('illustrative-viral-rna')).toBeDefined();scene.dispose();
    }body.dispose();
  });
  it('does not dispose the shared body when changing scenes; every owned geometry is disposed',()=>{
    const ctx=fixture();const body=bodyAsset().geometry;let bodyDisposals=0;body.addEventListener('dispose',()=>bodyDisposals++);
    for(const level of LEVELS){ctx.level=level.id;const scene=buildJourneyScene(ctx,body);let own=0,disposed=0;const tracked=new Set<BufferGeometry>();scene.group.traverse(object=>{if(object instanceof Mesh&&object.geometry!==body&&!tracked.has(object.geometry)){tracked.add(object.geometry);own++;object.geometry.addEventListener('dispose',()=>disposed++);}});scene.dispose();expect(disposed).toBe(own);expect(scene.group.children).toHaveLength(0);}
    expect(bodyDisposals).toBe(0);body.dispose();expect(bodyDisposals).toBe(1);
  });
  it('keeps the paired lungs inside the thoracic height and aligns the selected registry marker',()=>{
    const ctx=fixture();const body=bodyAsset().geometry;const scene=buildJourneyScene(ctx,body);
    for(const name of ['left-lung','right-lung']){const lung=scene.group.getObjectByName(name) as Mesh;lung.geometry.computeBoundingBox();expect(lung.position.y+lung.geometry.boundingBox!.min.y).toBeGreaterThan(1.8);expect(lung.position.y+lung.geometry.boundingBox!.max.y).toBeLessThan(4.1);expect(lung.scale.x).toBeLessThanOrEqual(1);}
    const marker=scene.group.getObjectByName('selected-anatomical-anchor')!;expect(marker.position.y).toBe(ANATOMY.find(r=>r.regionId==='bronchi')!.bodyAnchor.y);
    expect(scene.group.getObjectByName('right-horizontal-lobar-fissure')).toBeDefined();scene.dispose();body.dispose();
  });
  it('reflects the actual selected cell state and slots instead of a scripted day',()=>{
    const ctx=fixture();ctx.level='cell';ctx.selectedCellSlot=0;const body=bodyAsset().geometry;const scene=buildJourneyScene(ctx,body);const rna=scene.group.getObjectByName('illustrative-viral-rna')!;expect(rna.visible).toBe(true);
    ctx.snapshot.regions.find(r=>r.regionId==='bronchi')!.cells[0]!.status='healthy';scene.update(ctx,10);expect(rna.visible).toBe(false);scene.dispose();body.dispose();
  });
  it('has distinct status colors, rounded epithelial topology and asymmetric lung geometry',()=>{
    expect(new Set(Object.values(STATUS_COLORS)).size).toBe(7);
    const cell=epithelialGeometry(),left=lungGeometry(-1),right=lungGeometry(1);for(const geometry of[cell,left,right]){geometry.computeBoundingSphere();expect(geometry.boundingSphere!.radius).toBeGreaterThan(.5);expect(geometry.attributes.normal?.count).toBe(geometry.attributes.position!.count);geometry.dispose();}
    expect(Array.from(left.attributes.position!.array)).not.toEqual(Array.from(right.attributes.position!.array));
    const material=membraneMaterial();expect(material.isNodeMaterial).toBe(true);expect(material.opacityNode).not.toBeNull();expect(()=>JSON.stringify(material.toJSON())).not.toThrow();material.dispose();
  });
});
