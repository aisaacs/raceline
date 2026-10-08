// Frozen, compact polygons support architecture outside the original cutout.
// Existing terrain and circuit geometry are untouched by these additions.
import {readFileSync} from 'node:fs';
import * as T from '../../vendor/three.module.js';
import {Builder,Surface,sceneTriangles} from './scene-additions.mjs';
const mappedWater=JSON.parse(readFileSync(new URL('../../authoring/landmark-water.json',import.meta.url)));
const extensions=JSON.parse(readFileSync(new URL('../../authoring/landscape-extensions.json',import.meta.url))).circuits;
export function extendLandscape(id,c,g){
 const spec=extensions[id];if(!spec)return {meshes:[],replacements:[]};
 const base=sceneTriangles(g,n=>/^terrain\//.test(n)),ground=new Surface(base),vertices=base.flat(),b=new Builder('terrain-extension');
 const cache=new Map();function level(x,z){const key=`${x},${z}`;if(cache.has(key))return cache.get(key);let y;if(id==='Singapore')y=-.26;else{
  const near=ground.closest(x,z);if(near.point)y=near.point[1];else{let best=Infinity;for(const p of vertices){const d=(p[0]-x)**2+(p[2]-z)**2;if(d<best){best=d;y=p[1];}}}
  if(id==='Baku'){const l=c.landmarks.find(l=>l.kind==='flames'),d=Math.hypot(x-l.position[0],z-l.position[2]),weight=Math.max(0,Math.min(1,(330-d)/120));y=y*(1-weight)+(l.position[1]-.15)*weight;}
 }cache.set(key,y);return y;}
 function surface(tris,part,material,color){const positions=tris.flatMap(t=>t.flatMap(p=>[p[0],part==='water'?-1.1:level(...p),p[1]]));if(!positions.length)return;const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.computeVertexNormals();b.add(geo,color,part,true);b.meshes.at(-1).materialFrom=g.parser.json.nodes.find(n=>material.test(n.name))?.name;}
 surface(spec.land,'land',/^terrain\//,0x444d4c);surface(spec.water,'water',/^water-/,0x3b6576);
 const bottom=Math.min(-16,...vertices.map(p=>p[1]-16));for(let i=0;i<spec.outline.length;i++){const a=spec.outline[i],z=spec.outline[(i+1)%spec.outline.length];b.panel([[a[0],level(...a),a[1]],[z[0],level(...z),z[1]],[z[0],bottom,z[1]],[a[0],bottom,a[1]]],0x303a38,'skirt');}
 const replacements=[];g.scene.traverse(o=>{const node=g.parser.associations.get(o)?.nodes;if(o.isMesh&&/^terrain-skirt/.test(g.parser.json.nodes[node]?.name||''))replacements.push({node,indices:[]});});
 // Remove the old cutout's artificial concrete edge across open reservoir
 // water, while retaining concrete along the mapped land/water boundary.
 if(id==='Singapore'){
  const pts=[...new Map(vertices.map(p=>[[p[0],p[2]].join(','),[p[0],p[2]]])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]),lo=[],hi=[];
  for(const p of pts){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}for(const p of pts.slice().reverse()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p);}const oldOutline=lo.slice(0,-1).concat(hi.slice(0,-1)),rings=mappedWater.Singapore.flatMap(w=>w.rings);
  const distance=(p,ring)=>Math.min(...ring.map((a,i)=>{const z=ring[(i+1)%ring.length],dx=z[0]-a[0],dz=z[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);}));
  const inside=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++)if((ring[i][1]>p[1])!==(ring[j][1]>p[1])&&p[0]<(ring[j][0]-ring[i][0])*(p[1]-ring[i][1])/(ring[j][1]-ring[i][1])+ring[i][0])yes=!yes;return yes;};
  g.scene.traverse(o=>{const node=g.parser.associations.get(o)?.nodes,name=g.parser.json.nodes[node]?.name||o.name;if(!o.isMesh||name!=='shoreline/concrete')return;const pos=o.geometry.attributes.position,idx=o.geometry.index,v=new T.Vector3(),keep=[];let removed=0;for(let i=0;i<(idx?.count??pos.count);i+=3){const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k),tri=ids.map(k=>v.fromBufferAttribute(pos,k).applyMatrix4(o.matrixWorld).toArray()),p=[tri.reduce((s,q)=>s+q[0]/3,0),tri.reduce((s,q)=>s+q[2]/3,0)];if(distance(p,oldOutline)<2&&rings.some(r=>inside(p,r)&&distance(p,r)>3))removed++;else keep.push(...ids);}if(removed)replacements.push({node,indices:keep});});
 }
 return{meshes:b.meshes,replacements};
}
