// Offline, repeatable authoring pass. Original compressed buffers are retained.
import{readFileSync,writeFileSync,mkdtempSync,rmSync,renameSync,existsSync}from'node:fs';
import{tmpdir}from'node:os';import{join,resolve}from'node:path';import{fileURLToPath}from'node:url';
import * as T from '../vendor/three.module.js';
import{readGLB,writeGLB}from'./lib/glb.mjs';
import{loadScene,disposeScene,auditScene}from'./lib/scene-audit.mjs';
import{restoreBase,appendMeshes,combineMeshes,sceneTriangles,Surface}from'./lib/scene-additions.mjs';
import{makePitLane}from'./lib/pitlanes.mjs';
import{buildPitFacilities,pitFacility,facadeRectangle}from'./lib/pit-facilities.mjs';
import{repairLandmarks,landmarkReplacements}from'./lib/landmark-repairs.mjs';
import{groundStands}from'./lib/grounded-stands.mjs';
import{extendLandscape}from'./lib/landscape-extensions.mjs';
import{addSignatures}from'./lib/signature-landmarks.mjs';
import{joinPitAsphalt}from'./lib/pit-junctions.mjs';
import{DrivingCorridor}from'./lib/driving-clearance.mjs';
import{compressAdditions}from'./lib/compress-additions.mjs';
const root=new URL('../',import.meta.url),context=JSON.parse(readFileSync(new URL('authoring/scene-context.json',root))).circuits;
const scenery=/^(track-finish-surface|edge-lines|kerbs|shoulder|runoff|tyre-barriers|barriers|barrier-posts|barrier-terminals|fence|fences|catch-fence|street-walls|monaco-retaining|trees|foliage|scenery|grass-tufts|floodlights|brake-boards)/;
const architecture=/^(pit-|hero-|stand-|building-map-|urban-map-tile-|scenery-detail-canopy\/)/;
const originalName=(g,o)=>g.parser.json.nodes[g.parser.associations.get(o)?.nodes]?.name||o.name;
function catalogue(id,c,g){
 const features=[],meshes=[];g.scene.traverse(o=>{if(o.isMesh)meshes.push({o,name:originalName(g,o)});});
 function feature(name,prefix,position,distance=260,note='Retained stylised geometry from the supplied scene.',sources=[]){
  const matched=meshes.filter(m=>prefix.some(p=>m.name.startsWith(p)));if(!matched.length)throw new Error(`${id}: missing signature geometry: ${name} (${prefix})`);
  const box=new T.Box3();for(const m of matched)box.union(new T.Box3().setFromObject(m.o));
  features.push({id:`feature-${features.length+1}`,name,position:position||box.getCenter(new T.Vector3()).toArray(),viewDistance:position?distance:Math.max(distance,box.getSize(new T.Vector3()).length()*1.5),meshPrefixes:prefix,status:'retained',kind:'landmark',note,sources});
 }
 for(const l of c.landmarks.filter(l=>l.id!=='pit-01')){
  const p=l.id==='wall-01'?(id==='Montreal'?'champions-wall/':'interlagos-wall/'):l.id==='tunnel-01'?'monaco-tunnel/':l.id==='bridge-01'?'bridge-deck/':l.id;
  if([...(pitFacility(id)?.replacePrefixes||[]),...(landmarkReplacements[id]||[])].some(prefix=>p.startsWith(prefix)||prefix.startsWith(p)))continue;
  feature(l.label,[p],null,l.radiusM?Math.min(650,Math.max(140,l.radiusM*4)):260);
 }
 const specials={
 Melbourne:['Albert Park lake',['water-'],null,1100],
 Budapest:['Main straight grandstand',['stand-map-01/'],null,380],
 Catalunya:['Main grandstand',['stand-map-01/'],null,480],
 Hockenheim:['Motodrom stadium',['stand-map-03/','stand-map-04/','stand-map-01/'],[-510,15,330],760],
 'Mexico City':['Stadium section',['stand-map-01/','stand-map-02/','stand-map-04/','stand-map-05/','stand-map-06/'],[-547,3,-537],580],
 Lusail:['Floodlit main straight',['floodlights/'],c.landmarks[0]?.position,540],
 Madrid:['IFEMA pavilions',['urban-map-tile-'],[250,15,430],750],
 Spa:['Eau Rouge / Raidillon hillside',['stand-map-03/'],[160,95,-650],620],
 Zandvoort:['Dunes and banked final corner',['road/','terrain/'],null,430],
 IMS:['Yard of Bricks',['yard-of-bricks/'],null,150],
 PaulRicard:['Blue and red runoff',['painted-runoff'],null,850],
 Jeddah:['Red Sea waterfront',['water-'],[120,2,750],1600],
 Monza:['Parabolica and parkland',['road/','terrain-woodland/'],c.corners.Parabolica,550],
 };
 if(specials[id])feature(...specials[id]);
 const turns={Austin:'Turn 1',Baku:'Castle',Budapest:'Final corner',Catalunya:'Campsa',Hockenheim:'Hairpin',Istanbul:'Turn 8',Kyalami:'The Esses',MagnyCours:'Adelaide',Mugello:'Arrabbiata 2',SaoPaulo:'Senna S',Silverstone:'Becketts',WatkinsGlen:'The Boot',Zandvoort:'Arie Luyendyk',Madrid:'La Monumental'};
 if(turns[id]){
  let key=Object.keys(c.corners).find(k=>k.toLowerCase().includes(turns[id].toLowerCase()));
  if(key)feature(key,['road/'],c.corners[key],360,'Signature corner in the supplied layout; its elevation and road width retain the game model’s approximations.');
 }
 if(id==='Madrid')feature('Banked curve · supplied Madrid concept',['road/'],c.path[Math.round(c.path.length*.59)],500,'This is the supplied concept layout and authored banking, not an as-built 2026 circuit survey.');
 if(id==='Zandvoort')features.find(f=>f.name.startsWith('Dunes')).position=c.path[Math.round(c.path.length*.93)];
 return features;
}
function clearCorridor(g,pit){
 const replacements=[],meshes=[],v=new T.Vector3(),grid=new Map(),radius=pit.width/2+2,footprint=new Surface(pit.footprint),workingArea=new Surface(pit.apronFootprint),markingOpening=new Surface(pit.markingOpening);
 const clearPrefixes=pitFacility(g.scene.userData.circuitId)?.clearPrefixes||[],excavation=new Surface(Array.from({length:pit.excavation.length/9},(_,i)=>[0,1,2].map(k=>pit.excavation.slice(i*9+k*3,i*9+k*3+3))));
 const cutGround=new Surface([...pit.footprint,...excavation.triangles]),driving=new DrivingCorridor(pit.points,pit.width+1,{bottom:-.4,height:3.8});
 for(const p of pit.points){const key=`${Math.floor(p[0]/12)},${Math.floor(p[2]/12)}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(p);}
 const near=p=>{const apronY=workingArea.height(p[0],p[2]);if(apronY!==null&&p[1]>apronY-.6&&p[1]<apronY+4)return true;const surface=footprint.height(p[0],p[2]);if(surface!==null&&p[1]>surface-.6&&p[1]<surface+4)return true;const x=Math.floor(p[0]/12),z=Math.floor(p[2]/12);for(let i=x-1;i<=x+1;i++)for(let j=z-1;j<=z+1;j++)for(const q of grid.get(`${i},${j}`)||[])if(Math.hypot(p[0]-q[0],p[2]-q[2])<radius+1.8&&p[1]>q[1]-.6&&p[1]<q[1]+4)return true;return false;};
 g.scene.traverse(o=>{
  if(!o.isMesh)return;const name=originalName(g,o),trimFoundation=clearPrefixes.some(p=>name.startsWith(p)),excavate=/^(terrain(?!-skirt)|runoff|shoulder|paddock-ground|apron)/.test(name);if(!scenery.test(name)&&!trimFoundation&&!excavate)return;
  const a=o.geometry.attributes.position,idx=o.geometry.index,pts=[],indices=[],boundary=[];let removed=0;
  for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);pts.push(v.toArray());}
  if(excavate){
   const patch=[],keep=[];let changed=false;
   for(let i=0;i<(idx?.count??a.count);i+=3){const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k),tri=ids.map(k=>pts[k]),clipped=joinPitAsphalt(tri.flat(),cutGround,{fitHeight:false});if(clipped.removedArea>.000001){changed=true;for(const v of clipped.vertices)patch.push(v);}else keep.push(...ids);}
   if(changed){if(patch.length){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(patch,3));geometry.computeVertexNormals();meshes.push({name:`pitlane/excavated-${name}`,geometry,color:0xeeeeee,materialFrom:name});}replacements.push({node:g.parser.associations.get(o).nodes,indices:keep});}return;
  }
  for(let i=0;i<(idx?.count??a.count);i+=3){const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k),tri=ids.map(k=>pts[k]);const mid=[0,1,2].map(k=>tri.reduce((s,p)=>s+p[k]/3,0));if(tri.some(near)||near(mid)||driving.intersections(tri).length){removed++;if(trimFoundation||/^(track-finish-surface|edge-lines|kerbs|shoulder|runoff)/.test(name))boundary.push(...tri.flat());continue;}indices.push(...ids);}
  if(boundary.length){const vertices=joinPitAsphalt(boundary,name.startsWith('edge-lines/')?markingOpening:footprint,{fitHeight:false}).vertices;if(vertices.length){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();meshes.push({name:`pitlane/junction-${name}`,geometry,color:0xeeeeee,materialFrom:name});}}
  const blue=g.scene.userData.circuitId==='WatkinsGlen'&&name.startsWith('barriers/');if(!removed&&!blue)return;
  const node=g.parser.associations.get(o)?.nodes;if(node===undefined)throw new Error('Cannot replace anonymous scenery');
  replacements.push({node,indices,...(blue?{color:0x438dc0}:{})});
 });
 return {meshes,replacements};
}
export async function buildDetails(id,destination){
 const c=context[id];if(!c)throw new Error(`Unknown circuit ${id}`);
 const temp=mkdtempSync(join(tmpdir(),'raceline-details-')),baseline=join(temp,'base.glb'),staged=join(temp,'output.glb');let g;
 try{
  const glb=readGLB(destination);restoreBase(glb);writeGLB(baseline,glb);writeGLB(staged,glb);
  g=await loadScene(baseline);g.scene.userData.circuitId=id;
  const removedPrefixes=[...(pitFacility(id)?.replacePrefixes||[]),...(landmarkReplacements[id]||[])],removedNodes=[];g.scene.traverse(o=>{if(o.isMesh&&removedPrefixes.some(p=>originalName(g,o).startsWith(p)))removedNodes.push({node:g.parser.associations.get(o).nodes,indices:[]});});
  // Replacing a mapped building must also remove its copy in an urban tile.
  const replaceVolumes=(pitFacility(id)?.buildings||[]).filter(s=>s.replaceMappedFootprint).map(s=>{const r=facadeRectangle(s.polygon,s.axis);return new DrivingCorridor([[r.center[0]-r.axis[0]*(r.width/2+1),-100,r.center[1]-r.axis[1]*(r.width/2+1)],[r.center[0]+r.axis[0]*(r.width/2+1),-100,r.center[1]+r.axis[1]*(r.width/2+1)]],r.depth+2,{bottom:0,height:1000});});
  if(replaceVolumes.length)g.scene.traverse(o=>{if(!o.isMesh||!/^urban-map-tile-/.test(originalName(g,o)))return;const a=o.geometry.attributes.position,idx=o.geometry.index,v=new T.Vector3(),indices=[];let removed=0;for(let i=0;i<(idx?.count??a.count);i+=3){const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k),tri=ids.map(k=>v.fromBufferAttribute(a,k).applyMatrix4(o.matrixWorld).toArray());if(replaceVolumes.some(d=>d.intersections(tri).length))removed++;else indices.push(...ids);}if(removed)removedNodes.push({node:g.parser.associations.get(o).nodes,indices});});
  const road=new Surface(sceneTriangles(g,n=>/^(road|bridge-deck)\//.test(n))),ground=new Surface(sceneTriangles(g,n=>/^terrain(?!-skirt)|^(runoff|shoulder|apron|paddock-ground|bridge-underpass-ground)\//.test(n))),arch=new Surface(sceneTriangles(g,n=>architecture.test(n)&&![...removedPrefixes,...(pitFacility(id)?.clearPrefixes||[])].some(p=>n.startsWith(p))));
  const landscape=extendLandscape(id,c,g),stands=groundStands(g,new Surface([...ground.triangles,...sceneTriangles(g,n=>/^(painted-runoff|ricard-runoff-base)\//.test(n))]));
  const retained=catalogue(id,c,g),added=addSignatures(id,c,road,ground),facility=buildPitFacilities(id,c,ground,road);const repaired=repairLandmarks(id,c,ground);added.meshes.push(...facility.meshes,...repaired.meshes);added.features.push(...facility.features,...repaired.features);
  const extraTriangles=[];for(const m of added.meshes){const geometry=m.geometry.index?m.geometry.toNonIndexed():m.geometry,p=geometry.attributes.position;for(let i=0;i<p.count;i+=3)extraTriangles.push([0,1,2].map(k=>[p.getX(i+k),p.getY(i+k),p.getZ(i+k)]));}
  const pit=makePitLane(id,c,g,road,ground,new Surface([...arch.triangles,...extraTriangles]),root,facility.garages),cleared=clearCorridor(g,pit);
  appendMeshes(staged,combineMeshes([...added.meshes,...pit.meshes,...cleared.meshes,...landscape.meshes,...stands.meshes]),[...cleared.replacements,...removedNodes,...landscape.replacements,...stands.replacements]);
  compressAdditions(staged);
  const verify=await loadScene(staged);const audit=auditScene(verify);disposeScene(verify);if(!audit.passed)throw new Error(audit.errors.join('; '));
  const bytes=readFileSync(staged);writeFileSync(destination,bytes);
  return {features:[...added.features,...retained,pit.feature,{...pit.feature,id:'pit-entry',name:id==='Montreal'?'Pit entry · before Turn 13':'Pit entry',position:pit.points[Math.min(18,pit.points.length-1)],viewDistance:185},{...pit.feature,id:'pit-exit',name:id==='Montreal'?'Pit exit · Senna S':'Pit exit',position:pit.points.at(-18),viewDistance:210}],pitlane:{width:pit.width,method:pit.feature.method,sources:pit.feature.sources,points:pit.points.map(p=>p.map(v=>Math.round(v*1000)/1000))},bytes:bytes.length,clearedNodes:cleared.replacements.length,audit};
 }finally{if(g)disposeScene(g);rmSync(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const index=JSON.parse(readFileSync(new URL('circuits/index.json',root))),only=process.argv.slice(2),ids=only.length?only:index.circuits.map(c=>c.id);
 const cataloguePath=new URL('scenes/signatures.json',root),routesPath=new URL('authoring/pitlanes.json',root);
 const catalogueData=existsSync(cataloguePath)?JSON.parse(readFileSync(cataloguePath)):{schema:'raceline.signatures/1',notice:'Original stylised artwork, CC BY-SA 4.0. Map-derived positions © OpenStreetMap contributors, ODbL 1.0.',circuits:{}};
 const routes=existsSync(routesPath)?JSON.parse(readFileSync(routesPath)):{schema:'raceline.pitlanes/1',notice:catalogueData.notice,circuits:{}};let failed=0;
 for(const id of ids){try{const r=await buildDetails(id,fileURLToPath(new URL(`scenes/${id}.glb`,root)));catalogueData.circuits[id]={features:r.features};routes.circuits[id]=r.pitlane;writeFileSync(cataloguePath,JSON.stringify(catalogueData,null,2)+'\n');writeFileSync(routesPath,JSON.stringify(routes)+'\n');console.log(`${id}: ${r.features.length} signatures; pit ${r.pitlane.method}; ${r.clearedNodes} scenery groups cleared; PASS`);}catch(e){console.error(`${id}: ${e.stack}`);failed++;}}
 if(failed)process.exitCode=1;
}
