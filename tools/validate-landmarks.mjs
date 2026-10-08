// Inspect the exported scene, including terrain beneath every mapped structure.
import fs from'node:fs';import crypto from'node:crypto';import * as T from'../vendor/three.module.js';import{loadScene,disposeScene}from'./lib/scene-audit.mjs';import{Surface,sceneTriangles}from'./lib/scene-additions.mjs';import{groundStands}from'./lib/grounded-stands.mjs';
const context=JSON.parse(fs.readFileSync('authoring/scene-context.json')).circuits,results=[];
for(const [id,c]of Object.entries(context)){
 const g=await loadScene(`scenes/${id}.glb`),ground=new Surface(sceneTriangles(g,n=>/^terrain(?!-skirt|-extension\/water|-extension\/skirt)|^(road|runoff|shoulder|apron|paddock-ground|painted-runoff|ricard-runoff-base)\//.test(n))),issues=[],samples=[];
 const live=new Map();g.scene.traverse(o=>{const n=g.parser.json.nodes[g.parser.associations.get(o)?.nodes]?.name||o.name;if(o.isMesh){const prefix=n.split('/')[0];if(!live.has(prefix))live.set(prefix,new T.Box3());live.get(prefix).union(new T.Box3().setFromObject(o));}});
 for(const s of c.structures){if(s.kind==='decorativeMarina'||!live.has(s.id))continue;const box=live.get(s.id),center=box.getCenter(new T.Vector3()),gy=ground.height(center.x,center.z);if(gy===null)issues.push({id:s.id,name:s.name,kind:s.kind,reason:'No land beneath retained structure centre'});samples.push({id:s.id,height:gy});}
 const floatingStands=groundStands(g,ground).adjustments;
 const dimensions=[];g.scene.traverse(o=>{const n=g.parser.json.nodes[g.parser.associations.get(o)?.nodes]?.name||o.name;if(o.isMesh&&/^signature-(observation-wheel|flame-towers|bull)/.test(n)){const b=new T.Box3().setFromObject(o);dimensions.push({name:n,min:b.min.toArray(),max:b.max.toArray()});}});
 results.push({id,sha256:crypto.createHash('sha256').update(fs.readFileSync(`scenes/${id}.glb`)).digest('hex'),retainedStructureCentres:samples.length,terrainReview:issues,floatingStands,dimensions});console.log(id,JSON.stringify(issues));disposeScene(g);
}
fs.writeFileSync('validation/landmarks.json',JSON.stringify({schema:'raceline.landmark-validation/1',date:'2026-10-07',scope:'Retained structure centres sampled against visible ground, all grandstand lowest support points checked, and authored landmark world bounds. Does not certify survey accuracy or inspect every facade in batched urban geometry.',circuits:results},null,2)+'\n');
