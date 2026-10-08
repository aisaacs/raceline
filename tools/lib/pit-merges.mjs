// OSM links connect road centrelines. A rendered pit approach occupies an
// edge lane instead; painting the link as a road creates two stray centre lines.
export function projectToPath(path,p){
 let best=null;
 for(let i=0;i<path.length;i++){
  const a=path[i],b=path[(i+1)%path.length],dx=b[0]-a[0],dz=b[2]-a[2],den=dx*dx+dz*dz;if(!den)continue;
  const u=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/den)),x=a[0]+u*dx,z=a[2]+u*dz,d=Math.hypot(p[0]-x,p[2]-z);
  if(best&&d>=best.distance)continue;
  const before=path[(i-1+path.length)%path.length],after=path[(i+2)%path.length];
  const tx=(b[0]-before[0])*(1-u)+(after[0]-a[0])*u,tz=(b[2]-before[2])*(1-u)+(after[2]-a[2])*u,len=Math.hypot(tx,tz);
  best={point:[x,a[1]+u*(b[1]-a[1]),z],normal:[-tz/len,tx/len],distance:d};
 }
 return best;
}

export function adaptPitMerges(points,path,road,width){
 const result=points.map(p=>p.slice()),shared=points.map(()=>null),distances=points.map(p=>road.distance(p[0],p[2]));
 // On very wide source roads (Sakhir), the garage lane remains partly on
 // the original asphalt. Use its most separated section as the fixed anchor.
 const maximumSeparation=Math.max(...distances),separation=maximumSeparation>width/2+.5?width/2+.5:maximumSeparation*.8,outside=distances.map(d=>d>separation);
 const first=outside.indexOf(true),last=outside.lastIndexOf(true);
 if(first<0)throw new Error('Pit lane has no separate paved section');
 for(const [start,end,anchor]of [[0,first,first],[last+1,points.length,last]]){
  const frame=projectToPath(path,points[anchor]),q=points[anchor],side=Math.sign((q[0]-frame.point[0])*frame.normal[0]+(q[2]-frame.point[2])*frame.normal[1])||1;
  const terminal=start===0?0:points.length-1,arc=new Map([[terminal,0]]),step=start===0?1:-1;let distance=0;
  for(let i=terminal+step;i!==anchor+step;i+=step){distance+=Math.hypot(points[i][0]-points[i-step][0],points[i][2]-points[i-step][2]);arc.set(i,distance);}
  const blendLength=Math.min(45,distance);
  for(let i=start;i<end;i++){
   const p=points[i],f=projectToPath(path,p),normal=f.normal.map(v=>v*side),at=d=>[f.point[0]+normal[0]*d,f.point[2]+normal[1]*d];
   let lo=0,hi=2;while(hi<80&&road.height(...at(hi))!==null)hi+=2;
   if(hi>=80)throw new Error('Cannot locate the pit-side track edge');
   for(let k=0;k<22;k++){const m=(lo+hi)/2;if(road.height(...at(m))===null)hi=m;else lo=m;}
   const half=(lo+hi)/2,offset=(p[0]-f.point[0])*normal[0]+(p[2]-f.point[2])*normal[1],u=Math.max(0,Math.min(1,offset/half));
   // Parallel at the mapped road-centre endpoint; matches the unchanged
   // mapped branch position AND derivative at the edge of the main asphalt.
   const base=offset>half?offset:half-width/2+width/2*Math.pow(u,half/(width/2));
   const v=Math.min(1,(arc.get(i)||0)/blendLength),s=v*v*(3-2*v);
   // Some map links terminate at the asphalt edge rather than its centre.
   // Finish the entire lane inside the road, then ease to the mapped branch.
   const adapted=(half-width/2)*(1-s)+base*s;
   // Keep the mapped longitudinal position. At a polyline corner, replacing
   // the whole point with its projection can stall then jump along the lane.
   result[i]=[p[0]+normal[0]*(adapted-offset),p[1],p[2]+normal[1]*(adapted-offset)];
   shared[i]={normal,edge:[...at(half)],halfWidth:half};
  }
 }
 return {points:result,shared};
}

// Count separate longitudinal paint stripes crossing a small section of lane.
// This catches duplicate pit edges on shared asphalt independently of paving
// continuity and collision checks.
export function paintStripesAt(triangles,point,tangent,width){
 const len=Math.hypot(tangent[0],tangent[2]),tx=tangent[0]/len,tz=tangent[2]/len,spans=[];
 for(const tri of triangles){
  if(Math.min(...tri.map(p=>p[1]))>point[1]+1||Math.max(...tri.map(p=>p[1]))<point[1]-1)continue;
  const local=tri.map(p=>{const x=p[0]-point[0],z=p[2]-point[2];return[x*tx+z*tz,-x*tz+z*tx];}),hits=[];
  for(let k=0;k<3;k++){const a=local[k],b=local[(k+1)%3];if(a[0]*b[0]>0||Math.abs(b[0]-a[0])<1e-10)continue;const u=-a[0]/(b[0]-a[0]);hits.push(a[1]+u*(b[1]-a[1]));}
  if(hits.length>=2){const lo=Math.max(-width/2-.1,Math.min(...hits)),hi=Math.min(width/2+.1,Math.max(...hits));if(hi>lo)spans.push([lo,hi]);}
 }
 spans.sort((a,b)=>a[0]-b[0]);const merged=[];
 for(const span of spans){const last=merged.at(-1);if(last&&span[0]<last[1]+.003)last[1]=Math.max(last[1],span[1]);else merged.push(span.slice());}
 return merged.filter(([a,b])=>b-a>.07);
}
