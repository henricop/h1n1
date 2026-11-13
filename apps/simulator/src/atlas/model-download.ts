// Adapted from ashemag/human-atlas, MIT. Copyright (c) 2026 ashemag.
// Pinned source: 1c38bf35c254a891200d3cedecfd57abebe83d8d. License: /models/atlas/HUMAN-ATLAS-MIT.txt
/** Static hosts may serve .gz as a compressed response or as a gzip file.
 * Fetch already decodes Content-Encoding; inspect the payload to avoid decoding twice.
 */
export async function decodeModelResponse(response:Response,expectedBytes:number,compressed:boolean):Promise<ArrayBuffer>{
 if(!response.ok)throw new Error('Não foi possível carregar um arquivo de anatomia.');
 const payload=await response.arrayBuffer(),signature=new Uint8Array(payload,0,Math.min(2,payload.byteLength));
 const gzip=compressed&&signature[0]===0x1f&&signature[1]===0x8b;
 const buffer=gzip?await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():payload;
 if(buffer.byteLength!==expectedBytes)throw new Error('Um arquivo de anatomia chegou incompleto. Recarregue o visualizador.');
 return buffer;
}
