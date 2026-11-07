/** Offline conversion: node apps/simulator/scripts/prepare-human-body.mjs /path/to/FJ2810.obj */
import fs from 'node:fs';
import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, Ray, Vector3 } from '../node_modules/three/build/three.module.js';
import { OBJLoader } from '../node_modules/three/examples/jsm/loaders/OBJLoader.js';
import { GLTFExporter } from '../node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from '../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from '../../../node_modules/.pnpm/meshoptimizer@1.1.1/node_modules/meshoptimizer/meshopt_simplifier.js';
import { MeshBVH } from '../../../node_modules/.pnpm/three-mesh-bvh@0.8.3_three@0.186.1/node_modules/three-mesh-bvh/src/index.js';
const source='https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_BP3D_4.0_obj_99.zip';
const model=new OBJLoader().parse(fs.readFileSync(process.argv[2],'utf8'));
let geometry=model.children.find(x=>x.isMesh).geometry;
for(const attr of Object.keys(geometry.attributes))if(attr!=='position')geometry.deleteAttribute(attr);
geometry=mergeVertices(geometry,1e-4);await MeshoptSimplifier.ready;
const position=geometry.attributes.position;
const [indices,error]=MeshoptSimplifier.simplify(Uint32Array.from(geometry.index.array),position.array,3,Math.floor(geometry.index.count*.48/3)*3,.0006,['LockBorder']);
const remap=new Map(),vertices=[],compact=[];
for(const original of indices){if(!remap.has(original)){remap.set(original,vertices.length/3);vertices.push(position.getX(original),position.getY(original),position.getZ(original));}compact.push(remap.get(original));}
geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(new Float32Array(vertices),3));geometry.setIndex(compact);
// Source millimetres: +Z superior, -Y anterior; the runtime uses +Y superior, +Z anterior.
geometry.rotateX(-Math.PI/2).scale(.006572,.006572,.006572).translate(0,-5.0365,-.65);geometry.computeVertexNormals();geometry.computeBoundingBox();
// Small-radius geometric AO makes eyes, nose/ear creases and fingers legible without a texture or runtime pass.
const bvh=new MeshBVH(geometry,{maxLeafTris:10});const colors=new Uint8Array(vertices.length);
const p=geometry.attributes.position,n=geometry.attributes.normal,origin=new Vector3(),normal=new Vector3(),tangent=new Vector3(),bitangent=new Vector3(),ray=new Ray();
for(let i=0;i<p.count;i++){
  origin.fromBufferAttribute(p,i);normal.fromBufferAttribute(n,i).normalize();tangent.crossVectors(normal,Math.abs(normal.y)<.95?new Vector3(0,1,0):new Vector3(1,0,0)).normalize();bitangent.crossVectors(normal,tangent);let occlusion=0;
  for(let sample=0;sample<24;sample++){
    const u=(sample+.5)/24,angle=sample*2.3999632297+i*.6180339887,r=Math.sqrt(u);
    ray.origin.copy(origin).addScaledVector(normal,.003);ray.direction.copy(tangent).multiplyScalar(Math.cos(angle)*r).addScaledVector(bitangent,Math.sin(angle)*r).addScaledVector(normal,Math.sqrt(1-u)).normalize();
    const hit=bvh.raycastFirst(ray,DoubleSide,0,.28);if(hit)occlusion+=1-hit.distance/.28;
  }
  // Keep the anatomical face readable; suppress AO on broad skin surfaces where source seams can look like spots.
  const smooth=(a,b,value)=>{const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t);};
  const head=smooth(4.15,4.5,origin.y),hands=smooth(1.25,1.6,Math.abs(origin.x))*(1-smooth(.1,.65,origin.y)),feet=1-smooth(-5.1,-4.8,origin.y);
  const strength=Math.max(.08,head,hands*.5,feet*.3);
  const shade=Math.round(255*(1-Math.min(.55,occlusion/24*.9)*strength));colors.set([shade,shade,shade],i*3);
}
geometry.setAttribute('color',new BufferAttribute(colors,3,true));

const body=new Mesh(geometry,new MeshStandardMaterial({color:0xb5b9b6,roughness:.68,vertexColors:true}));body.name='human-anatomical-surface';
body.userData={source,sourceFile:'FJ2810.obj',ontologyId:'FMA:7163',representationId:'BP10155',license:'CC-BY-4.0',author:'The Database Center for Life Science (DBCLS)',attribution:'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International',licenseSource:'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',modifications:'Position welding, error-bounded simplification, recomputed normals, millimetres converted to atlas coordinates; original neutral anatomical pose retained; 24-ray geometric ambient occlusion baked into vertex colors.',simplificationError:error};
const group=new Group();group.name='BodyParts3D-adult-reference-human';group.add(body);
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(r=>{this.result=`data:application/octet-stream;base64,${Buffer.from(r).toString('base64')}`;this.onloadend?.();});}};
const output=await new GLTFExporter().parseAsync(group,{binary:true,onlyVisible:true});fs.writeFileSync('apps/simulator/public/models/human-body.glb',Buffer.from(output));
console.log(JSON.stringify({bytes:output.byteLength,positions:vertices.length/3,triangles:indices.length/3,error,bounds:geometry.boundingBox},null,2));
