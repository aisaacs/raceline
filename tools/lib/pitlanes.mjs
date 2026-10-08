import * as T from '../../vendor/three.module.js';
import {Builder, project,Surface} from './scene-additions.mjs';
import {existsSync,readFileSync} from 'node:fs';
import {joinPitAsphalt,paintOnRoad} from './pit-junctions.mjs';
import {pitFacility,referenceRoute,makeWorkingAprons} from './pit-facilities.mjs';
import {adaptPitMerges} from './pit-merges.mjs';
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const lerp=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
export function resample(points,step=4){const out=[points[0]];for(let i=1;i<points.length;i++){const n=Math.max(1,Math.ceil(dist(points[i-1],points[i])/step));for(let j=1;j<=n;j++)out.push(lerp(points[i-1],points[i],j/n));}return out;}
export function nearest(path,p){let best=Infinity,index=0;for(let i=0;i<path.length;i++){const d=dist(path[i],p);if(d<best){best=d;index=i;}}return {index,distance:best,point:path[index]};}
export function blendPitEndpoint(points,path,metres,exit=false){
 const chain=exit?points.slice().reverse():points.slice();let end=1,length=dist(chain[0],chain[1]);while(end<chain.length-2&&length<metres){end++;length+=dist(chain[end-1],chain[end]);}
 const at=nearest(path,chain[0]).index,n=path.length,a=path[(at-4+n)%n],b=path[(at+4)%n],start=new T.Vector3(...chain[0]),finish=new T.Vector3(...chain[end]),tangent=new T.Vector3(b[0]-a[0],0,b[2]-a[2]).normalize(),direction=finish.clone().sub(start);
 if(tangent.dot(direction)<0)tangent.negate();const tail=new T.Vector3(...chain[end+1]).sub(new T.Vector3(...chain[end-1])).normalize(),span=start.distanceTo(finish)/3;
 const curve=new T.CubicBezierCurve3(start,start.clone().addScaledVector(tangent,span),finish.clone().addScaledVector(tail,-span),finish);
 for(let i=0;i<=end;i++)chain[i]=curve.getPoint(i/end).toArray();return exit?chain.reverse():chain;
}
export function makePitLane(id,context,gltf,road,ground,architecture,root,garages=[]){
 const facility=pitFacility(id),reference=referenceRoute(id,context),tunnel=facility?.route?.tunnel;
 const path=context.path,n=path.length;
 const at=i=>path[(i%n+n)%n];
 let pitPoints=[];
 gltf.scene.traverse(o=>{if(!o.isMesh)return;const name=gltf.parser.json.nodes[gltf.parser.associations.get(o)?.nodes]?.name||o.name;if(!(id==='Jacarepagua'?/^hero-01\//:/^pit-01\//).test(name))return;const a=o.geometry.attributes.position,v=new T.Vector3();for(let i=0;i<a.count;i+=3){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);pitPoints.push(v.toArray());}});
 const pit=context.landmarks.find(l=>l.id===(id==='Jacarepagua'?'hero-01':'pit-01'))?.position || (pitPoints.length?new T.Box3().setFromPoints(pitPoints.map(p=>new T.Vector3(...p))).getCenter(new T.Vector3()).toArray():at(0));
 const anchor=nearest(path,pit),i0=anchor.index,origin=at(i0),before=at(i0-5),after=at(i0+5);
 const t=new T.Vector2(after[0]-before[0],after[2]-before[2]).normalize(),normal=[-t.y,t.x];
 let side=Math.sign((pit[0]-origin[0])*normal[0]+(pit[2]-origin[2])*normal[1])||1;
 // Prefer map routes where they still fit the deliberately widened game road.
 const file=new URL(`authoring/raceway-extracts/${id}.json`,root);
 let ways=[];if(existsSync(file))ways=JSON.parse(readFileSync(file)).elements.filter(e=>e.geometry&&e.tags?.sport!=='karting'&&/pit|boxengasse|boksz|pitstraat/i.test(Object.values(e.tags||{}).join(' '))&&!/west circuit|national|oval|alternate|warmup/i.test(e.tags?.name||''));
 ways.sort((a,b)=>b.geometry.length-a.geometry.length);
 let sources=ways.map(w=>`https://www.openstreetmap.org/way/${w.id}`),mapped=null;
 if(ways.length){
   const used=new Set([ways[0].id]);let chain=ways[0].geometry.map(p=>project(context.geoFrame,p.lon,p.lat)).map(p=>[p[0],0,p[1]]);
   for(let pass=0;pass<ways.length;pass++)for(const w of ways){if(used.has(w.id))continue;let pts=w.geometry.map(p=>project(context.geoFrame,p.lon,p.lat)).map(p=>[p[0],0,p[1]]);if(dist(chain.at(-1),pts[0])<2){chain.push(...pts.slice(1));used.add(w.id);}else if(dist(pts.at(-1),chain[0])<2){chain.unshift(...pts.slice(0,-1));used.add(w.id);}}
   if(chain.length>2){mapped=chain;sources=ways.filter(w=>used.has(w.id)).map(w=>`https://www.openstreetmap.org/way/${w.id}`);}
 }
 const tangentSpan=pitPoints.length?Math.max(...pitPoints.map(p=>(p[0]-pit[0])*t.x+(p[2]-pit[2])*t.y))-Math.min(...pitPoints.map(p=>(p[0]-pit[0])*t.x+(p[2]-pit[2])*t.y)):240;
 const half=Math.max(90,Math.min(320,tangentSpan/2+25));
 let chosen=reference?new T.CatmullRomCurve3(resample(reference,8).map(p=>new T.Vector3(...p)),false,'centripetal').getSpacedPoints(Math.max(100,Math.ceil(reference.reduce((sum,p,i)=>sum+(i?dist(p,reference[i-1]):0),0)/3))).map(p=>p.toArray()):null,method=reference?'reference-authored':'authored',width=facility?.route?.width||(id==='Montreal'?7:6);
 if(reference)sources=facility.references.map(r=>r.url).concat(facility.buildings.map(b=>b.source).filter(Boolean));
 if(reference&&facility.route.junctionBlend){const blend=facility.route.junctionBlend;if(blend.entry)chosen=blendPitEndpoint(chosen,path,blend.entry);if(blend.exit)chosen=blendPitEndpoint(chosen,path,blend.exit,true);}
 const safe=p=>{for(let k=-1;k<12;k++){const a=k/12*Math.PI*2,r=k<0?0:width/2+(reference?.1:1.1);if(architecture.height(p[0]+Math.cos(a)*r,p[2]+Math.sin(a)*r)!==null)return false;}return true;};
 if(mapped&&!chosen){
   const ends=[nearest(path,mapped[0]),nearest(path,mapped.at(-1))];
   const lead=at(ends[0].index-12),tail=at(ends[1].index+12);
   const route=resample([lead,...mapped,tail],3);
   const separated=route.filter(p=>road.distance(p[0],p[2])>width/2+1).length/route.length;
   if(route.every(safe)&&separated>.35&&route.length<1000){chosen=route;method='mapped-adapted';}
 }
 if(id==='Montreal'&&mapped&&!reference){chosen=new T.CatmullRomCurve3(mapped.map(p=>new T.Vector3(...p)),false,'centripetal').getSpacedPoints(420).map(p=>p.toArray());method='mapped';sources.push('https://www.fia.com/system/files/decision-document/2025_canadian_grand_prix_-_event_notes_-_circuit_map_pit_lane_emergency_exits_map_ers_battery_containment_area_red_zones.pdf');}
 if(!chosen){
   const step=5,extent=half+125;
   // Sample by actual arc length around the pit building, not a fixed index count.
   const walk=(sign,distance)=>{let index=i0,d=0;while(d<distance){d+=dist(at(index),at(index+sign));index+=sign;if(Math.abs(index-i0)>n/2)break;}return index;};
   const start=walk(-1,extent),end=walk(1,extent);
   const spine=resample(Array.from({length:end-start+1},(_,k)=>at(start+k)),step);
   const rows=spine.length,offsets=61,costs=new Float64Array(rows*offsets).fill(Infinity),prev=new Int16Array(rows*offsets).fill(-1);
   const positions=[];
   const preferred=Math.max(22,Math.min(90,anchor.distance-10));
   let found=false;
   for(const trySide of [side,-side]){
     costs.fill(Infinity);prev.fill(-1);positions.length=0;
     for(let i=0;i<rows;i++){
       const a=spine[Math.max(0,i-1)],b=spine[Math.min(rows-1,i+1)],len=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
       const nx=-(b[2]-a[2])/len*trySide,nz=(b[0]-a[0])/len*trySide;
       const u=i/(rows-1),ramp=Math.min(1,u*6,(1-u)*6),target=preferred*ramp;
       positions.push([]);
       for(let k=0;k<offsets;k++){
         const off=k*2,p=[spine[i][0]+nx*off,spine[i][1],spine[i][2]+nz*off];positions[i].push(p);
         if((i===0||i===rows-1)&&k!==0)continue;
         if(!safe(p))continue;
         const clearance=road.distance(p[0],p[2]);
         if(u>.22&&u<.78&&clearance<width/2+1)continue;
         const score=(off-target)**2*.004+(u>.22&&u<.78?Math.max(0,8-clearance)*2:0);
         if(i===0){costs[k]=0;continue;}
         for(let j=Math.max(0,k-3);j<=Math.min(offsets-1,k+3);j++){
           const v=costs[(i-1)*offsets+j]+score+(k-j)**2*1.6;
           if(v<costs[i*offsets+k]&&safe(lerp(positions[i-1][j],p,.5))){costs[i*offsets+k]=v;prev[i*offsets+k]=j;}
         }
       }
     }
     if(Number.isFinite(costs[(rows-1)*offsets])){chosen=[];let k=0;for(let i=rows-1;i>=0;i--){chosen.unshift(positions[i][k]);k=prev[i*offsets+k];}side=trySide;found=true;break;}
   }
   if(!found)throw new Error(`${id}: no clear pit corridor; needs manual route`);
   method=mapped?'mapped-corridor-adapted':'authored';
 }
 // A straight garage frontage must remain straight. Grid search only selects
 // a clear corridor; smoothing removes its two-metre lateral quantisation.
 if(id!=='Montreal'&&!reference){
   for(let pass=0;pass<55;pass++){
     const next=chosen.map(p=>p.slice());
     for(let i=1;i<chosen.length-1;i++){
       const p=chosen[i].map((v,k)=>v*.3+(chosen[i-1][k]+chosen[i+1][k])*.35);
       if(safe(p))next[i]=p;
     }
     chosen=next;
   }
 }
 const merge=reference?adaptPitMerges(chosen,path,road,width):null;
 if(merge)chosen=merge.points;
 if(!chosen.every(safe))throw new Error(`${id}: pit lane intersects building near ${JSON.stringify(chosen.filter(p=>!safe(p)).filter((p,i)=>i%4===0))}`);
 // Height follows the baked terrain, with exact main-road height at each join.
 const normals=chosen.map((p,i)=>{const a=chosen[Math.max(0,i-1)],c=chosen[Math.min(chosen.length-1,i+1)],d=Math.hypot(c[0]-a[0],c[2]-a[2])||1;return [-(c[2]-a[2])/d,(c[0]-a[0])/d];});
 const surfaceAt=(x,z,fallback)=>Math.max(ground.height(x,z)??fallback,road.height(x,z)??-Infinity);
 chosen=chosen.map((p,i)=>{let y=-Infinity;for(const offset of [-width/2,0,width/2])y=Math.max(y,surfaceAt(p[0]+normals[i][0]*offset,p[2]+normals[i][1]*offset,nearest(path,p).point[1]));return [p[0],y+.2,p[2]];});
 // The paving has a continuous, bounded grade even when the underlying game
 // runoff changes elevation abruptly. Side fill joins raised sections to land.
 for(let i=1;i<chosen.length;i++)chosen[i][1]=Math.max(chosen[i][1],chosen[i-1][1]-.16*dist(chosen[i],chosen[i-1]));
 for(let i=chosen.length-2;i>=0;i--)chosen[i][1]=Math.max(chosen[i][1],chosen[i+1][1]-.16*dist(chosen[i],chosen[i+1]));
 let tunnelRange=null;
 if(tunnel){
  const index=p=>nearest(chosen,[p[0],0,p[1]]).index,lo=index(tunnel.descent),a=index(tunnel.portalIn),z=index(tunnel.portalOut),hi=index(tunnel.ascent),ys=chosen[lo][1],ye=chosen[hi][1],arc=[0];
  for(let i=1;i<chosen.length;i++)arc[i]=arc[i-1]+dist(chosen[i-1],chosen[i]);
  const smooth=u=>u*u*(3-2*u);
  for(let i=lo;i<=hi;i++)chosen[i][1]=i<a?ys+(tunnel.floor-ys)*smooth((arc[i]-arc[lo])/(arc[a]-arc[lo])):i>z?tunnel.floor+(ye-tunnel.floor)*smooth((arc[i]-arc[z])/(arc[hi]-arc[z])):tunnel.floor;
  tunnelRange={lo,a,z,hi};
 }
 const b=new Builder('pitlane'),laneVertices=[],lineVertices=[],junctionLines=[],outerMergeLines=[],markingOpening=[],fillVertices=[];
 const edge=(i,offset,lift=0)=>{const p=chosen[i],n=normals[i];return [p[0]+n[0]*offset,p[1]+lift,p[2]+n[1]*offset];};
 const flush=(p,lift=0)=>{const q=p.slice(),near=road.closest(p[0],p[2]);if(near.distance<3&&(!tunnel||near.point[1]-p[1]<3)){const u=near.distance/3,s=u*u*(3-2*u);q[1]=near.point[1]+(q[1]-near.point[1])*s;}q[1]+=lift;return q;};
 if(id==='Montreal'){
  // Flush merges into existing asphalt. There is no rectangular raised cap.
  for(const [start,sign]of[[0,1],[chosen.length-1,-1]])for(let k=0;k<=12;k++){const i=start+sign*k,p=chosen[i],y=road.height(p[0],p[2]);if(y!==null)p[1]=y+.015+(p[1]-y-.015)*Math.min(1,k/12);}
 }
 let garage=null;
 if(id==='Montreal'){
  const structure=context.structures.find(s=>s.id==='pit-01'),polygon=structure.footprint.coordinates[0],edges=polygon.slice(1).map((p,i)=>[p[0]-polygon[i][0],p[1]-polygon[i][1]]).sort((a,b)=>Math.hypot(...b)-Math.hypot(...a));
  const width=Math.hypot(...edges[0]),axis=edges[0].map(v=>v/width);if(axis[1]<0)for(let i=0;i<2;i++)axis[i]*=-1;
  // The duplicate closing polygon point biases PCA. Use the actual long
  // facade edge so the working apron reaches the garage doors without a gap.
  garage={center:[structure.position[0],structure.position[2]],axis,width,depth:Math.hypot(...edges.at(-1)),floor:structure.position[1]+.04};
 }
 const researched=reference&&id!=='Montreal'?makeWorkingAprons(chosen,width,garages,road):{meshes:[],vertices:[]};b.meshes.push(...researched.meshes);
 const apron=researched.vertices,bayCenters=new Map();
 const garageEdge=i=>{const p=chosen[i],a=garage.axis,n=[-a[1],a[0]],u=(p[0]-garage.center[0])*a[0]+(p[2]-garage.center[1])*a[1],x=garage.center[0]+a[0]*u+n[0]*(garage.depth/2+.08),z=garage.center[1]+a[1]*u+n[1]*(garage.depth/2+.08);return {u,point:[x,garage.floor,z]};};
 function ribbon(vertices,i,a,c,lift=0){let points=[edge(i,a),edge(i,c),edge(i+1,c),edge(i+1,a)];if(lift)points=points.map(p=>flush(p,lift));const[p,q,r,s]=points;vertices.push(...p,...r,...q,...p,...s,...r);}
 for(let i=0;i<chosen.length-1;i++){
   ribbon(laneVertices,i,-width/2,width/2);
   ribbon(markingOpening,i,-width/2+.6,width/2-.6);
   if(tunnelRange&&i>=tunnelRange.lo&&i<tunnelRange.hi){
    for(const sign of [-1,1]){
     const a=edge(i,sign*(width/2+.25)),c=edge(i+1,sign*(width/2+.25)),top=p=>Math.max(p[1]+1.1,ground.height(p[0],p[2])??road.closest(p[0],p[2]).point?.[1]??p[1]+1.1);
     b.panel([a,c,[c[0],top(c),c[2]],[a[0],top(a),a[2]]],0xb6b7ae,'tunnel-retaining-wall');
    }
    if(i>=tunnelRange.a&&i<tunnelRange.z){
     const a=edge(i,-width/2-.6,tunnel.clearance),c=edge(i,width/2+.6,tunnel.clearance),d=edge(i+1,width/2+.6,tunnel.clearance),e=edge(i+1,-width/2-.6,tunnel.clearance);b.panel([a,c,d,e],0x8e938e,'tunnel-ceiling');
     if(i%4===0)b.beam([a[0],a[1]-.08,a[2]],[c[0],c[1]-.08,c[2]],.07,0xf9f0c9,'tunnel-lights');
    }
   }
   for(const sign of [-1,1]){const a=flush(edge(i,sign*width/2)),c=flush(edge(i+1,sign*width/2));if(road.distance(a[0],a[2])<.01&&road.distance(c[0],c[2])<.01)continue;const d=[c[0],Math.min(c[1],surfaceAt(c[0],c[2],c[1]-.2)),c[2]],e=[a[0],Math.min(a[1],surfaceAt(a[0],a[2],a[1]-.2)),a[2]];fillVertices.push(...a,...c,...d,...a,...d,...e);}
   const markings=!reference&&(i<chosen.length*.15||i>chosen.length*.85)?junctionLines:lineVertices;
   const shared=merge?.shared[i]||merge?.shared[i+1],outerSign=shared?Math.sign(shared.normal[0]*normals[i][0]+shared.normal[1]*normals[i][1]):0;
   for(const sign of [-1,1])ribbon(outerSign===sign?outerMergeLines:markings,i,sign*(width/2-.38),sign*(width/2-.2),.015);
   if(garage){
     const ga=garageEdge(i),gc=garageEdge(i+1);
     if(Math.abs(ga.u)<garage.width/2-1&&Math.abs(gc.u)<garage.width/2-1){
       const a=edge(i,-width/2),c=edge(i+1,-width/2);apron.push(...a,...ga.point,...gc.point,...a,...gc.point,...c);
       const bay=Math.floor((ga.u+garage.width/2)/(garage.width/10));
       const target=-garage.width/2+(bay+.5)*garage.width/10,score=Math.abs(ga.u-target);
       if(!bayCenters.has(bay)||score<bayCenters.get(bay).score)bayCenters.set(bay,{score,a,garage:ga.point});
     }
     if(chosen[i][2]>309&&chosen[i+1][2]<710){
       const a=edge(i,width/2+.65),c=edge(i+1,width/2+.65),dx=c[0]-a[0],dz=c[2]-a[2],len=Math.hypot(dx,dz),wall=new Builder('pitlane',[(a[0]+c[0])/2,(a[1]+c[1])/2+.6,(a[2]+c[2])/2],[dx/len,dz/len]);wall.box(0,0,0,len+.02,1.2,.4,0xbfc0b7,'separator');b.meshes.push(...wall.meshes);
     }
   }
 // Repeated pit stopping boxes on the garage side of the fast lane.
   if(id!=='Montreal'&&!reference&&i>chosen.length*.28&&i<chosen.length*.72&&i%12===0){const n=normals[i],p=chosen[i],a=[p[0]-n[0]*(width/2-.5),p[1]+.025,p[2]-n[1]*(width/2-.5)],c=[p[0]+n[0]*(width/2-.5),p[1]+.025,p[2]+n[1]*(width/2-.5)];const t=[n[1]*.12,-n[0]*.12];lineVertices.push(...a,...c,...[c[0]+t[0],c[1],c[2]+t[1]],...a,...[c[0]+t[0],c[1],c[2]+t[1]],...[a[0]+t[0],a[1],a[2]+t[1]]);}
 }
 if(garage)for(const {a,garage:front}of bayCenters.values()){
  const center=lerp(a,front,.43),axis=garage.axis,normal=[-axis[1],axis[0]],point=(u,v)=>[center[0]+axis[0]*u+normal[0]*v,center[1]+.025,center[2]+axis[1]*u+normal[1]*v];
  // Ten car stopping positions, oriented with pit traffic. Short corner
  // marks leave the working apron open instead of dividing it into parking bays.
  for(const u of [-3.2,3.2])for(const v of [-1.6,1.6]){b.beam(point(u,v),point(u-Math.sign(u)*1.15,v),.065,0xf3e7b7,'pit-box-markings');b.beam(point(u,v),point(u,v-Math.sign(v)*.7),.065,0xf3e7b7,'pit-box-markings');}
 }
 const junction=joinPitAsphalt(laneVertices,road,{verticalSeparation:tunnel?3:Infinity});
 const apronJoined=joinPitAsphalt(apron,road,{verticalSeparation:tunnel?3:Infinity});
 const triangles=vertices=>Array.from({length:vertices.length/9},(_,i)=>[0,1,2].map(k=>vertices.slice(i*9+k*3,i*9+k*3+3)));
 const paved=new Surface([...road.triangles,...triangles(junction.vertices),...triangles(apronJoined.vertices)]);
 // The outer side of an approach is the existing track edge. Only retain
 // new outer paint where the pit adds asphalt outside that edge.
 lineVertices.push(...joinPitAsphalt(outerMergeLines,road,{fitHeight:false,verticalSeparation:tunnel?3:Infinity}).vertices);
 if(reference){const paint=paintOnRoad(lineVertices,paved,.035,tunnel?3:Infinity);lineVertices.length=0;for(const value of paint)lineVertices.push(value);}
 for(const mesh of b.meshes.filter(m=>m.name==='pitlane/pit-box-markings')){
  const p=mesh.geometry.attributes.position,raw=[];const idx=mesh.geometry.index;for(let i=0;i<(idx?.count??p.count);i++){const k=idx?idx.getX(i):i;raw.push(p.getX(k),p.getY(k),p.getZ(k));}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(paintOnRoad(raw,paved,.04),3));geometry.computeVertexNormals();mesh.geometry.dispose();mesh.geometry=geometry;
 }
 const clippedLines=joinPitAsphalt(junctionLines,road).vertices;for(let i=1;i<clippedLines.length;i+=3)clippedLines[i]+=.012;lineVertices.push(...clippedLines);
 for(const [vertices,color,part]of[[junction.vertices,0x262e32,'asphalt'],[apronJoined.vertices,0x4a5052,'working-apron'],[fillVertices,0x77796e,'edge-fill'],[lineVertices,0xf5efda,'markings']]){if(!vertices.length)continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();b.add(g,color,part,true);if(part==='asphalt'){b.meshes.at(-1).materialFrom='road/asphalt';b.meshes.at(-1).extras={junction:{removedOverlapArea:junction.removedArea,vertices:junction.junctionVertices,maxGap:junction.maxJoinGap}};}}
 const apronFootprint=[];for(let i=0;i<apron.length;i+=9)apronFootprint.push([apron.slice(i,i+3),apron.slice(i+3,i+6),apron.slice(i+6,i+9)]);
 const footprint=[];for(const vertices of [laneVertices,apron])for(let i=0;i<vertices.length;i+=9)footprint.push([vertices.slice(i,i+3),vertices.slice(i+3,i+6),vertices.slice(i+6,i+9)]);
 const excavation=[];if(tunnelRange)for(let i=tunnelRange.lo;i<tunnelRange.hi;i++)ribbon(excavation,i,-width/2-.2,width/2+.2);
 return {meshes:b.meshes,points:chosen,width,footprint,apronFootprint,markingOpening:triangles(markingOpening),excavation,feature:{id:'pitlane',name:'Pit lane',position:chosen[Math.floor(chosen.length/2)],viewDistance:Math.max(180,Math.min(520,half*2)),meshPrefixes:['pitlane/asphalt','pitlane/markings'],status:'added',kind:'pitlane',method,sources,note:reference?facility.route.note:method==='mapped'?'Mapped Montreal pit route: entry before Turn 13, working apron beside the garages, and exit through the Senna S. Fitted vertically to the supplied terrain.':method==='mapped-adapted'?'Mapped pit route adapted to the model’s widened road and terrain; entry and exit are simplified.':'Authored pit corridor fitted to this model’s garages and widened road; not a surveyed pit-lane layout.'}};
}
