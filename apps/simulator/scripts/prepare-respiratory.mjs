/** Offline conversion only. Usage: node apps/simulator/scripts/prepare-respiratory.mjs /path/to/3d-vh-f-lung.glb */
import fs from 'node:fs';
import { Box3, BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from '../node_modules/three/build/three.module.js';
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from '../node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from '../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from '../../../node_modules/.pnpm/meshoptimizer@1.1.1/node_modules/meshoptimizer/meshopt_simplifier.js';
const source = 'https://cdn.humanatlas.io/digital-objects/ref-organ/lung-female/v1.4/assets/3d-vh-f-lung.glb';
const bytes=fs.readFileSync(process.argv[2]);
const model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
model.scene.updateMatrixWorld(true);await MeshoptSimplifier.ready;
const groups=new Map();
model.scene.traverse(object=>{
  if(!object.isMesh||object.name.includes('hilum'))return;
  const airway=/bronchus|bronchi$/.test(object.name)&&!/bronchopulmonary/.test(object.name);
  let parent=object;while(parent.parent&&!/lung_(upper|middle|lower)_lobe/.test(parent.name))parent=parent.parent;
  const key=airway?(/_R$|right_/.test(object.name)?'right-intrapulmonary-bronchi':'left-intrapulmonary-bronchi'):parent.name;
  const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);
  for(const attr of Object.keys(geometry.attributes))if(attr!=='position')geometry.deleteAttribute(attr);
  const entry=groups.get(key)??{airway,geometries:[],structures:[]};entry.geometries.push(geometry);entry.structures.push({name:object.name,label:object.userData.label,ontologyId:object.userData.ontologyid});groups.set(key,entry);
});
const result=new Group();result.name='HRA-Visible-Human-Female-Lung-v1.4';
result.userData={source,creators:'Kristen Browne and Heidi Schlehlein',license:'CC-BY-4.0',citation:'Browne, Kristen, and Heidi Schlehlein. 2024. 3D Reference Organ for Lung, Female v1.4. https://doi.org/10.48539/HBM994.HXJP.575',modifications:'Hilum helper surfaces excluded; named lobes and bronchial trees merged, welded and simplified; smooth normals recomputed; fit to educational body (not clinical registration).'};
let triangles=0,vertices=0;
for(const [name,entry]of groups){
  let geometry=mergeVertices(mergeGeometries(entry.geometries),1e-7);
  const p=geometry.attributes.position,indices=Uint32Array.from(geometry.index.array);
  const [simplified,error]=MeshoptSimplifier.simplify(indices,p.array,3,Math.floor(indices.length*(entry.airway?.58:.27)/3)*3,.0015,['LockBorder']);
  const remap=new Map(),positions=[],newIndices=[];
  for(const original of simplified){if(!remap.has(original)){remap.set(original,positions.length/3);positions.push(p.getX(original),p.getY(original),p.getZ(original));}newIndices.push(remap.get(original));}
  geometry.dispose();geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));geometry.setIndex(newIndices);
  // The source is in metres in the full Visible Human frame. Fit its thoracic anatomy to the local human.
  geometry.translate(.004961558,-.367073059,.080118929).scale(8.2,9,6.6).translate(0,1.85,.05);
  geometry.computeVertexNormals();geometry.computeBoundingBox();
  const mesh=new Mesh(geometry,new MeshStandardMaterial({color:entry.airway?0x397ba3:0xadc3cc,roughness:.5}));mesh.name=name;mesh.userData={kind:entry.airway?'airway':'lobe',regionId:entry.airway?'bronchioles':'bronchi',sourceStructures:entry.structures,simplificationError:error};result.add(mesh);
  triangles+=newIndices.length/3;vertices+=positions.length/3;
}
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(r=>{this.result=`data:application/octet-stream;base64,${Buffer.from(r).toString('base64')}`;this.onloadend?.();});}};
const output=await new GLTFExporter().parseAsync(result,{binary:true,onlyVisible:true});
const path='apps/simulator/public/models/respiratory-atlas.glb';fs.writeFileSync(path,Buffer.from(output));
console.log(JSON.stringify({path,bytes:output.byteLength,meshes:result.children.length,triangles,vertices,bounds:new Box3().setFromObject(result)},null,2));
