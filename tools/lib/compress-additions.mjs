// Lossless compression of authored buffers only. Keep the original baseline
// byte-for-byte so restoreBase still works after the published file is packed.
import {MeshoptEncoder} from '../../vendor/meshopt_encoder.mjs';
import {readGLB,writeGLB} from './glb.mjs';
await MeshoptEncoder.ready;
export function compressAdditions(path){
 const glb=readGLB(path),j=glb.json,base=j.asset.extras?.racelineAdditions;
 if(!base)return;
 const views=j.bufferViews.slice(base.counts.bufferViews);
 if(views.every(v=>v.extensions?.EXT_meshopt_compression))return;
 base.counts.buffers??=j.buffers.length;
 const virtual=j.buffers.length,parts=[glb.chunks[0].data.subarray(0,base.binLength)];
 let offset=base.binLength,fallbackOffset=0;
 for(let i=base.counts.bufferViews;i<j.bufferViews.length;i++){
  const view=j.bufferViews[i],accessor=j.accessors.find(a=>a.bufferView===i);
  if(!accessor)throw Error(`No accessor for authored buffer ${i}`);
  const stride=view.byteLength/accessor.count,mode=accessor.type==='SCALAR'?'INDICES':'ATTRIBUTES';
  const data=glb.chunks[0].data.subarray(view.byteOffset,view.byteOffset+view.byteLength);
  const packed=Buffer.from(MeshoptEncoder.encodeGltfBuffer(data,accessor.count,stride,mode));
  view.extensions={EXT_meshopt_compression:{buffer:0,byteOffset:offset,byteLength:packed.length,byteStride:stride,count:accessor.count,mode,filter:'NONE'}};
  view.buffer=virtual;view.byteOffset=fallbackOffset;fallbackOffset+=view.byteLength;
  const pad=Buffer.alloc((4-packed.length%4)%4);parts.push(packed,pad);offset+=packed.length+pad.length;
 }
 j.buffers.push({byteLength:fallbackOffset,extensions:{EXT_meshopt_compression:{fallback:true}}});
 for(const key of ['extensionsUsed','extensionsRequired'])j[key]=[...new Set([...(j[key]||[]),'EXT_meshopt_compression'])];
 j.buffers[0].byteLength=offset;glb.chunks[0].data=Buffer.concat(parts);writeGLB(path,glb);
}
