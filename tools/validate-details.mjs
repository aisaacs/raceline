// Verify the geometry a consumer receives, including pit-lane visibility.
import{readFileSync,writeFileSync}from'node:fs';
import{loadScene,disposeScene,auditScene,intersectionArea,intersectionPolygon}from'./lib/scene-audit.mjs';
import{sceneTriangles,Surface,triangleHeight}from'./lib/scene-additions.mjs';
import{joinPitAsphalt}from'./lib/pit-junctions.mjs';
import{DrivingCorridor,drivingObstacles}from'./lib/driving-clearance.mjs';
import{facilityClearance}from'./lib/facility-clearance.mjs';
import{paintStripesAt}from'./lib/pit-merges.mjs';
const catalogue=JSON.parse(readFileSync('scenes/signatures.json')),routes=JSON.parse(readFileSync('authoring/pitlanes.json')),index=JSON.parse(readFileSync('circuits/index.json')),facilities=JSON.parse(readFileSync('authoring/pit-facilities.json')).circuits;
const selected=process.argv.slice(2);
for(const id of selected)if(!index.circuits.some(c=>c.id===id))throw new Error(`Unknown circuit ${id}`);
const previous=selected.length?JSON.parse(readFileSync('validation/details.json')).circuits:[],results=previous.filter(r=>!selected.includes(r.id));
const context=JSON.parse(readFileSync('authoring/scene-context.json')).circuits;
for(const {id}of index.circuits.filter(c=>!selected.length||selected.includes(c.id))){
 const g=await loadScene(`scenes/${id}.glb`),errors=[],features=catalogue.circuits[id]?.features||[],route=routes.circuits[id];
 const facility=facilities[id],tunnel=facility?.route?.tunnel;
 if(!facility?.references?.length)errors.push('Pit facility has no visual reference');
 if(!facility?.buildings?.length)errors.push('Pit facility has no garage inventory');
 const names=[];g.scene.traverse(o=>{if(o.isMesh)names.push(g.parser.json.nodes[g.parser.associations.get(o)?.nodes]?.name||o.name);});
 if(features.length<2)errors.push('Missing signature inventory');
 for(const f of features){if(!f.position?.every(Number.isFinite))errors.push(`Invalid camera: ${f.name}`);for(const p of f.meshPrefixes)if(!names.some(n=>n.startsWith(p)))errors.push(`Missing feature geometry: ${f.name}: ${p}`);}
 const pit=new Surface(sceneTriangles(g,n=>n==='pitlane/asphalt')),road=new Surface(sceneTriangles(g,n=>/^road\//.test(n))),ground=new Surface(sceneTriangles(g,n=>/^terrain(?!-skirt)|^(runoff|shoulder|apron|paddock-ground)\/|^pitlane\/(excavated-|junction-(shoulder|runoff))/.test(n)));
 const junction=joinPitAsphalt(pit.triangles.flat(2),road,{verticalSeparation:tunnel?3:Infinity});let maxJoinGap=0,minUnderpassClearance=Infinity;
 for(const tri of pit.triangles)for(const p of tri){const near=road.closest(p[0],p[2]);if(near.distance<.002){const gap=near.point[1]-p[1];if(tunnel&&gap>3)minUnderpassClearance=Math.min(minUnderpassClearance,gap);else maxJoinGap=Math.max(maxJoinGap,Math.abs(gap));}}
 if(tunnel&&(!Number.isFinite(minUnderpassClearance)||minUnderpassClearance<tunnel.clearance))errors.push(`Pit underpass lacks ${tunnel.clearance} metres of clear height`);
 if(junction.removedArea>.05)errors.push(`Pit asphalt overlaps the road by ${junction.removedArea.toFixed(3)} square metres`);
 if(junction.removedArea<-.0001)errors.push(`Invalid pit clipping area: ${junction.removedArea}`);
 if(maxJoinGap>.005)errors.push(`Pit junction has a ${(maxJoinGap*100).toFixed(2)} cm vertical gap`);
 const apron=new Surface(sceneTriangles(g,n=>n==='pitlane/working-apron'));let apronObstruction=0,buriedApron=0;
 for(const t of apron.triangles){const p=[0,1,2].map(k=>t.reduce((s,q)=>s+q[k]/3,0)),y=ground.height(p[0],p[2]);if(y!==null&&y>p[1]+.025)buriedApron++;}
 if(buriedApron)errors.push(`${buriedApron} working-apron triangles buried below terrain`);
 const apronOverlap=joinPitAsphalt(apron.triangles.flat(2),road,{verticalSeparation:tunnel?3:Infinity}).removedArea;
 if(apronOverlap>.05)errors.push(`Working apron has duplicate road asphalt (${apronOverlap.toFixed(3)} square metres)`);
 if(apronOverlap<-.0001)errors.push(`Invalid apron clipping area: ${apronOverlap}`);
 if(apron.triangles.length)for(const t of sceneTriangles(g,n=>/^(barriers|barrier-posts|fence|fences|tyre-barriers)/.test(n))){
  const nearby=new Set();for(const p of t)for(const a of apron.grid.get(`${Math.floor(p[0]/40)},${Math.floor(p[2]/40)}`)||[])nearby.add(a);
  for(const a of nearby){const footprint=t.map(p=>[p[0],p[2]]),target=a.map(p=>[p[0],p[2]]),intersection=intersectionPolygon(footprint,target);if(intersection.some(([x,z])=>(triangleHeight(t,x,z)??-Infinity)>(triangleHeight(a,x,z)??Infinity)+.05))apronObstruction+=intersectionArea(footprint,target);}
 }
 if(apronObstruction>.01)errors.push(`Guardrail or fence obstructs the garage working apron (${apronObstruction.toFixed(3)} square metres)`);
 for(const f of features.filter(f=>f.status==='added'&&f.kind==='landmark')){
  const elevation=ground.height(f.position[0],f.position[2]);
  if(elevation!==null&&f.position[1]<elevation-.5)errors.push(`Landmark camera buried below visible ground: ${f.name}`);
 }
 let maxGrade=0,buried=0,uncovered=0;const mergePaintStripes=[];
 const obstructions=new Set(),mainObstructions=new Set(),obstacleTriangles=sceneTriangles(g,n=>drivingObstacles.test(n));
 // A figure-eight circuit has two road elevations at its crossing. Follow
 // the source path's deck, including explicit bridge surfaces.
 const mainSurface=new Surface(sceneTriangles(g,n=>/^(road|bridge-deck)\//.test(n)));
 const mainPoints=context[id].path.map(p=>{
  const heights=(mainSurface.grid.get(`${Math.floor(p[0]/40)},${Math.floor(p[2]/40)}`)||[]).map(t=>triangleHeight(t,p[0],p[2])).filter(y=>y!==null);
  heights.sort((a,b)=>Math.abs(a-p[1])-Math.abs(b-p[1]));return[p[0],heights[0]??p[1],p[2]];
 });mainPoints.push(mainPoints[0]);
 const mainCorridor=new DrivingCorridor(mainPoints,6);
 for(const t of obstacleTriangles)for(const i of mainCorridor.intersections(t))mainObstructions.add(i);
 if(mainObstructions.size)errors.push(`Obstructions inside the main-track driving centre at ${mainObstructions.size} segments: ${[...mainObstructions].slice(0,6).join(', ')}`);
 if(!route)errors.push('No pit route');else{
  if(route.method==='reference-authored'){
   const paint=sceneTriangles(g,n=>n==='pitlane/markings'),pts=route.points;
   for(const [a,b]of[[pts[0],pts[1]],[pts.at(-1),pts.at(-2)]]){
    const p=a.map((v,k)=>v+(b[k]-v)*.25);p[1]=road.height(p[0],p[2])??p[1];
    const stripes=paintStripesAt(paint,p,b.map((v,k)=>v-a[k]),route.width);mergePaintStripes.push(stripes.length);
   }
   if(mergePaintStripes.some(n=>n!==1))errors.push(`Expected one pit merge divider at each shared-road endpoint; found ${mergePaintStripes.join(', ')}`);
  }
  const pavedPoints=route.points.map(p=>[p[0],pit.height(p[0],p[2])??road.height(p[0],p[2])??p[1],p[2]]),corridor=new DrivingCorridor(pavedPoints,route.width-.8);
  for(const t of obstacleTriangles)for(const i of corridor.intersections(t))obstructions.add(i);
  if(obstructions.size)errors.push(`Obstructions inside the pit driving corridor at ${obstructions.size} segments: ${[...obstructions].slice(0,6).join(', ')}`);
  for(const [i,p]of route.points.entries()){
   const main=road.height(p[0],p[2]);let y=pit.height(p[0],p[2])??main;if(y===null&&(i===0||i===route.points.length-1)){const q=route.points[i===0?1:i-1];y=pit.height(p[0]+(q[0]-p[0])*.01,p[2]+(q[2]-p[2])*.01);}const base=ground.height(p[0],p[2]);if(y===null)uncovered++;else if(main===null&&base!==null&&y<base-.02)buried++;
   if(i){const q=route.points[i-1],d=Math.hypot(p[0]-q[0],p[2]-q[2]);if(d>.01)maxGrade=Math.max(maxGrade,Math.abs(p[1]-q[1])/d);}
  }
  for(const p of [route.points[0],route.points.at(-1)])if(road.height(p[0],p[2])===null)errors.push('Disconnected pit endpoint');
  if(uncovered)errors.push(`${uncovered} pit route samples lack asphalt`);if(buried)errors.push(`${buried} pit samples buried below terrain/runoff`);
  if(maxGrade>.3)errors.push(`Abrupt pit elevation: ${(maxGrade*100).toFixed(1)}% grade`);
 }
 errors.push(...facilityClearance(g,facility,context[id]));
 const audit=auditScene(g);errors.push(...audit.errors);disposeScene(g);
 results.push({id,features:features.length,pitMethod:route?.method,mergePaintStripes,maxPitGrade:Math.round(maxGrade*1000)/1000,pitRoadOverlapSquareMetres:junction.removedArea,maxPitJoinGapMetres:maxJoinGap,...(tunnel?{minUnderpassClearanceMetres:minUnderpassClearance}:{}),blockedPitSegments:obstructions.size,blockedMainTrackSegments:mainObstructions.size,apronObstructionSquareMetres:apronObstruction,apronRoadOverlapSquareMetres:apronOverlap,buriedApronTriangles:buriedApron,buriedSamples:buried,uncoveredSamples:uncovered,passed:!errors.length,errors});console.log(id,errors.length?errors.join('; '):'PASS');
}
results.sort((a,b)=>index.circuits.findIndex(c=>c.id===a.id)-index.circuits.findIndex(c=>c.id===b.id));
writeFileSync('validation/details.json',JSON.stringify({circuits:results,passed:results.every(r=>r.passed)},null,2)+'\n');if(results.some(r=>!r.passed))process.exitCode=1;
