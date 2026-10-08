import {Box3,Vector3,Triangle} from '../../vendor/three.module.js';
export const drivingObstacles=/^(barrier|fence|catch-fence|street-walls|monaco-retaining|tyre-|trees|foliage|floodlights|brake-boards|scenery|pit-|hero-|stand-|building-map-|urban-map-tile-|signature-|champions-wall|interlagos-wall|bridge-structure|monaco-tunnel|pitlane\/(separator|crew-wall|tunnel-retaining-wall|junction-(barrier|fence|catch|street|stand|scenery|brake|floodlight|monaco)))/;
// Test an actual three-dimensional swept driving corridor. This also detects
// vertical fences, whose projected triangle area is zero in a top-down audit.
export class DrivingCorridor {
 constructor(points,width,{bottom=.18,height=2.8}={}){
  this.grid=new Map();this.segments=[];
  for(let i=0;i<points.length-1;i++){
   const a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);if(len<.001)continue;
   const segment={a,b,len,tx:dx/len,tz:dz/len,box:new Box3(new Vector3(0,bottom,-width/2),new Vector3(len,height,width/2)),index:i};this.segments.push(segment);
   for(let x=Math.floor((Math.min(a[0],b[0])-width)/40);x<=Math.floor((Math.max(a[0],b[0])+width)/40);x++)for(let z=Math.floor((Math.min(a[2],b[2])-width)/40);z<=Math.floor((Math.max(a[2],b[2])+width)/40);z++){
    const key=`${x},${z}`;if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key).push(segment);
   }
  }
 }
 intersections(triangle){
  const candidates=new Set(),hits=[];
  for(let x=Math.floor(Math.min(...triangle.map(p=>p[0]))/40);x<=Math.floor(Math.max(...triangle.map(p=>p[0]))/40);x++)for(let z=Math.floor(Math.min(...triangle.map(p=>p[2]))/40);z<=Math.floor(Math.max(...triangle.map(p=>p[2]))/40);z++)for(const s of this.grid.get(`${x},${z}`)||[])candidates.add(s);
  for(const s of candidates){
   const local=triangle.map(p=>{const x=p[0]-s.a[0],z=p[2]-s.a[2],u=x*s.tx+z*s.tz,y=s.a[1]+(s.b[1]-s.a[1])*u/s.len;return new Vector3(u,p[1]-y,-x*s.tz+z*s.tx);});
   if(s.box.intersectsTriangle(new Triangle(...local)))hits.push(s.index);
  }
  return hits;
 }
}
