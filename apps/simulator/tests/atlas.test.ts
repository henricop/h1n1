import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {decodeModelResponse} from '../src/atlas/model-download';
import {createExplosionLayout} from '../src/atlas/explosion-layout';
import {PointerTap} from '../src/atlas/pointer-tap';
import {matchesConcept,regionForPart} from '../src/atlas/presentation';
import type {Atlas} from '../src/atlas/anatomy';
const base='public/models/atlas/';
const atlas=JSON.parse(readFileSync(base+'atlas.json','utf8')) as Atlas;

describe('complete licensed anatomical atlas',()=>{
  it('retains all 2234 source pieces and 3432 resolvable concepts',()=>{
    expect(atlas.parts).toHaveLength(2234);expect(atlas.concepts).toHaveLength(3432);
    const ids=new Set(atlas.parts.map(p=>p.id));expect(ids.size).toBe(2234);
    for(const concept of atlas.concepts){if(!concept.elements.length||concept.elements.some(id=>!ids.has(id)))throw new Error(`Invalid anatomy membership: ${concept.id}`);}
    expect(readFileSync(base+'HUMAN-ATLAS-MIT.txt','utf8')).toContain('Copyright (c) 2026 ashemag');
    expect(readFileSync(base+'ATTRIBUTION.md','utf8')).toContain('Attribution 4.0');
  });
  it('serves valid local buffers with finite positions and bounded triangle indices',()=>{
    const buffers=atlas.chunks.map(c=>{expect(c.url).toMatch(/^\/models\/atlas\//);const b=readFileSync(base+c.url.split('/').at(-1));expect(b.length).toBe(c.bytes);return b;});
    let triangles=0;
    for(const p of atlas.parts){const buffer=buffers[p.chunk]!;const positions=new Float32Array(buffer.buffer,buffer.byteOffset+p.positions,p.vertexCount*3);const indices=new Uint32Array(buffer.buffer,buffer.byteOffset+p.indices,p.indexCount);for(const v of positions){if(!Number.isFinite(v))throw new Error(`Non-finite position ${p.id}`);}for(const index of indices){if(index>=p.vertexCount)throw new Error(`Invalid vertex ${p.id}`);}triangles+=p.indexCount/3;}
    expect(triangles).toBe(atlas.triangles);expect(triangles).toBe(2288268);
  });
  it('decodes gzip files and already-decoded HTTP payloads without double decompression',async()=>{
    const chunk=atlas.chunks[0]!;const compressed=readFileSync(base+chunk.gzip!.split('/').at(-1));const raw=readFileSync(base+chunk.url.split('/').at(-1));
    expect((await decodeModelResponse(new Response(compressed),chunk.bytes,true)).byteLength).toBe(chunk.bytes);
    expect((await decodeModelResponse(new Response(raw),chunk.bytes,true)).byteLength).toBe(chunk.bytes);
    await expect(decodeModelResponse(new Response(raw.subarray(0,40)),chunk.bytes,true)).rejects.toThrow('incompleto');
  });
  it('packs respiratory parts without overlapping cells at desktop and mobile proportions',()=>{
    const parts=atlas.parts.filter(p=>p.system==='respiratory');
    for(const aspect of [390/600,1470/560]){const layout=createExplosionLayout(parts,aspect);expect(layout.cells.size).toBe(119);const cells=[...layout.cells.values()];for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++){const a=cells[i]!,b=cells[j]!;if(Math.abs(a.x-b.x)<(a.width+b.width)/2-1e-8&&Math.abs(a.y-b.y)<(a.height+b.height)/2-1e-8)throw new Error('Exploded parts overlap');}}
  });
  it('searches Portuguese accents and maps source airway structures to real simulation regions',()=>{
    expect(matchesConcept('left lung','FMA','pulmao')).toBe(true);expect(matchesConcept('heart','FMA','coração')).toBe(true);
    expect(regionForPart({name:'Trachea',system:'respiratory'})).toBe('trachea');expect(regionForPart({name:'Right main bronchus',system:'respiratory'})).toBe('bronchi');expect(regionForPart({name:'Left apical segmental bronchial tree',system:'respiratory'})).toBe('bronchioles');expect(regionForPart({name:'Heart',system:'cardiac'})).toBeNull();
  });
});
describe('anatomical pointer selection',()=>{
  it('selects taps, ignores drags and canceled or multi-touch gestures',()=>{
    const tap=new PointerTap();tap.down(1,10,10,5);expect(tap.up(1,12,12)).toBe(true);
    tap.down(1,10,10,5);tap.move(1,25,25);expect(tap.up(1,10,10)).toBe(false);
    tap.down(1,10,10,12);tap.down(2,20,20,12);expect(tap.up(1,10,10)).toBe(false);expect(tap.up(2,20,20)).toBe(false);
    tap.down(1,10,10,5);tap.cancel(1);expect(tap.up(1,10,10)).toBe(false);
  });
});
