// Subtract the existing asphalt footprint instead of layering a tapered strip
// over it. The remaining paving shares the road's exact edge elevation.
const cross=(a,b,p)=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);
// Compute around a local origin. Global-coordinate shoelace sums can give
// a nonzero sign to a collapsed triangle after catastrophic cancellation.
const area=p=>p.length<3?0:p.slice(1,-1).reduce((s,a,i)=>s+cross(p[0],a,p[i+2]),0)/2;
function halfPlane(polygon,a,b,side){
 const out=[];
 for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=cross(a,b,p)*side,dq=cross(a,b,q)*side;
  if(dp>=-1e-9)out.push(p);
  if((dp>1e-9&&dq< -1e-9)||(dp< -1e-9&&dq>1e-9)){
   const u=dp/(dp-dq);out.push(p.map((v,k)=>v+(q[k]-v)*u));
  }
 }
 return out;
}
export function subtractTriangle(polygon,triangle){
 const clipArea=area(triangle);if(Math.abs(clipArea)<1e-8)return [polygon];
 const sign=Math.sign(clipArea);
 let inside=polygon;const outside=[];
 for(let i=0;i<3&&inside.length>=3;i++){
  const a=triangle[i],b=triangle[(i+1)%3],part=halfPlane(inside,a,b,-sign);
  if(part.length>=3&&Math.abs(area(part))>1e-7)outside.push(part);
  inside=halfPlane(inside,a,b,sign);
 }
 return outside;
}
export function joinPitAsphalt(vertices,road,{fitHeight=true,verticalSeparation=Infinity}={}){
 const out=[];let removedArea=0,maxJoinGap=0,junctionVertices=0;
 for(let i=0;i<vertices.length;i+=9){
  const tri=[vertices.slice(i,i+3),vertices.slice(i+3,i+6),vertices.slice(i+6,i+9)],nearby=new Set();
  const X=tri.map(p=>p[0]),Z=tri.map(p=>p[2]);
  for(let x=Math.floor(Math.min(...X)/40);x<=Math.floor(Math.max(...X)/40);x++)for(let z=Math.floor(Math.min(...Z)/40);z<=Math.floor(Math.max(...Z)/40);z++)for(const t of road.grid.get(`${x},${z}`)||[])nearby.add(t);
  const localRoad=Number.isFinite(verticalSeparation)?new road.constructor([...nearby].filter(t=>Math.min(...t.map(p=>p[1]))-Math.max(...tri.map(p=>p[1]))<verticalSeparation)):road;
  if(localRoad!==road){nearby.clear();for(const t of localRoad.triangles)nearby.add(t);}
  let polygons=[tri];
  for(const t of nearby){polygons=polygons.flatMap(p=>subtractTriangle(p,t));if(!polygons.length)break;}
  removedArea+=Math.abs(area(tri))-polygons.reduce((s,p)=>s+Math.abs(area(p)),0);
  for(const original of polygons){
   const polygon=original.map(p=>p.slice());
   for(const p of fitHeight?polygon:[]){
    const nearest=localRoad.closest(p[0],p[2]);
    if(fitHeight&&nearest.distance<3){const u=nearest.distance/3,s=u*u*(3-2*u);p[1]=nearest.point[1]+(p[1]-nearest.point[1])*s;}
    if(nearest.distance<1e-4){junctionVertices++;maxJoinGap=Math.max(maxJoinGap,Math.abs(p[1]-nearest.point[1]));}
   }
   if(area(polygon)>0)polygon.reverse(); // Up-facing, as with the original road.
   for(let k=1;k<polygon.length-1;k++)out.push(...polygon[0],...polygon[k],...polygon[k+1]);
  }
 }
 return {vertices:out,removedArea,maxJoinGap,junctionVertices};
}
// Split paint at every road triangle boundary before lifting it. A long quad
// interpolated across the road's varying grades can otherwise disappear into it.
export function paintOnRoad(vertices,road,lift=.035,verticalSeparation=Infinity){
 const out=[];
 const emit=p=>{if(area(p)>0)p.reverse();for(let k=1;k<p.length-1;k++)out.push(...p[0],...p[k],...p[k+1]);};
 for(let i=0;i<vertices.length;i+=9){
  const tri=[vertices.slice(i,i+3),vertices.slice(i+3,i+6),vertices.slice(i+6,i+9)],nearby=new Set(),xs=tri.map(p=>p[0]),zs=tri.map(p=>p[2]);
  for(let x=Math.floor(Math.min(...xs)/40);x<=Math.floor(Math.max(...xs)/40);x++)for(let z=Math.floor(Math.min(...zs)/40);z<=Math.floor(Math.max(...zs)/40);z++)for(const t of road.grid.get(`${x},${z}`)||[])nearby.add(t);
  let remaining=[tri];
  for(const t of nearby){if(Math.min(...t.map(p=>p[1]))-Math.max(...tri.map(p=>p[1]))>=verticalSeparation)continue;const clipArea=area(t);if(Math.abs(clipArea)<1e-8)continue;const sign=Math.sign(clipArea);const next=[];
   for(const p of remaining){let inside=p;for(let k=0;k<3&&inside.length>=3;k++)inside=halfPlane(inside,t[k],t[(k+1)%3],sign);
    if(inside.length>=3&&Math.abs(area(inside))>1e-8){const [a,b,c]=t,den=cross(a,b,c);emit(inside.map(p=>{const v=cross(a,p,c)/den,w=cross(a,b,p)/den;return [p[0],a[1]+v*(b[1]-a[1])+w*(c[1]-a[1])+lift,p[2]];}));}
    next.push(...subtractTriangle(p,t));
   }remaining=next;if(!remaining.length)break;
  }
  for(const p of remaining)emit(p.map(q=>[q[0],q[1]+lift,q[2]]));
 }
 return out;
}
