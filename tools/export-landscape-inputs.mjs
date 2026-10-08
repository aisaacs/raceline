// Authoring helper for tools/prepare-landscape-extensions.py; no runtime deps.
import fs from 'node:fs';import{loadScene,disposeScene}from'./lib/scene-audit.mjs';import{sceneTriangles,restoreBase}from'./lib/scene-additions.mjs';import{readGLB,writeGLB}from'./lib/glb.mjs';import * as T from'../vendor/three.module.js';
const dir=process.argv[2];if(!dir)throw new Error('Pass a temporary output directory');fs.mkdirSync(dir,{recursive:true});
for(const {id}of JSON.parse(fs.readFileSync('circuits/index.json')).circuits){const glb=readGLB(`scenes/${id}.glb`);restoreBase(glb);writeGLB(`${dir}/base.glb`,glb);const g=await loadScene(`${dir}/base.glb`),base=sceneTriangles(g,n=>/^terrain\//.test(n)),water=sceneTriangles(g,n=>/^water-/.test(n)),boxes=[];g.scene.traverse(o=>{const n=g.parser.json.nodes[g.parser.associations.get(o)?.nodes]?.name||o.name;if(!o.isMesh||!/^(hero-|building-map-|urban-map-tile-|pit-|stand-)/.test(n))return;
// Urban tiles batch many independent buildings. Use their individual vertices,
// not a tile bounding rectangle that could extend across a bay.
const p=o.geometry.attributes.position,v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);boxes.push([v.x,v.z]);}});
fs.writeFileSync(`${dir}/${id}.json`,JSON.stringify({base,water,points:boxes}));disposeScene(g);}fs.unlinkSync(`${dir}/base.glb`);
