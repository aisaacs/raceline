// Lower a stand only when every sampled point along its lowest structural
// members floats above the terrain. A stand with any grounded support stays put.
import * as T from '../../vendor/three.module.js';
export function groundStands(g,ground){
 const groups=new Map(),meshes=[],replacements=[],adjustments=[];
 g.scene.traverse(o=>{const node=g.parser.associations.get(o)?.nodes,name=g.parser.json.nodes[node]?.name||o.name,match=/^(stand-[^/]+)\//.exec(name);if(!o.isMesh||!match)return;if(!groups.has(match[1]))groups.set(match[1],[]);groups.get(match[1]).push({o,node,name});});
 for(const [id,parts]of groups){const box=new T.Box3();for(const {o}of parts)box.union(new T.Box3().setFromObject(o));let minGap=Infinity,samples=0;const v=new T.Vector3();for(const {o}of parts){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(v.y>box.min.y+.15)continue;const y=ground.height(v.x,v.z);if(y===null)continue;minGap=Math.min(minGap,v.y-y);samples++;}}
  if(samples<3||minGap<=1)continue;const shift=minGap-.03;
  for(const {o,node,name}of parts){const geometry=o.geometry.clone(),source=o.geometry.attributes.position,positions=new Float32Array(source.count*3);for(let i=0;i<source.count;i++){v.fromBufferAttribute(source,i).applyMatrix4(o.matrixWorld);positions.set([v.x,v.y-shift,v.z],i*3);}geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.deleteAttribute('normal');geometry.computeVertexNormals();meshes.push({name,geometry,color:0xffffff,materialFrom:name});replacements.push({node,indices:[]});}adjustments.push({id,loweredBy:shift,supportSamples:samples});
 }return {meshes,replacements,adjustments};
}
