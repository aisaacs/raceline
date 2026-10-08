import {readFileSync} from 'node:fs';
import {Builder,project} from './scene-additions.mjs';
const references=JSON.parse(readFileSync(new URL('../../authoring/pit-facilities.json',import.meta.url))).circuits;
export const pitFacility=id=>references[id];
// Fix the direction from the surveyed facade, without duplicate-vertex PCA bias.
export function facadeRectangle(polygon,axis){
 const p=polygon.slice();if(p.length>1&&Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<.001)p.pop();
 if(!axis){const edges=p.map((v,i)=>[p[(i+1)%p.length][0]-v[0],p[(i+1)%p.length][1]-v[1]]);axis=edges.sort((a,b)=>Math.hypot(...b)-Math.hypot(...a))[0];}
 const len=Math.hypot(...axis);axis=axis.map(v=>v/len);const n=[-axis[1],axis[0]],us=p.map(q=>q[0]*axis[0]+q[1]*axis[1]),vs=p.map(q=>q[0]*n[0]+q[1]*n[1]),u=(Math.min(...us)+Math.max(...us))/2,v=(Math.min(...vs)+Math.max(...vs))/2;
 return {center:[axis[0]*u+n[0]*v,axis[1]*u+n[1]*v],axis,width:Math.max(...us)-Math.min(...us),depth:Math.max(...vs)-Math.min(...vs)};
}
export function buildPitFacilities(id,c,ground,roadSurface){
 const f=pitFacility(id),meshes=[],features=[],garages=[];if(!f)return {meshes,features,garages};
 for(const spec of f.buildings||[]){
  const s=spec.structureId?c.structures.find(s=>s.id===spec.structureId):null;
  const polygon=spec.polygon||s?.footprint?.coordinates[0];if(!polygon)throw Error(`${id}: missing pit footprint ${spec.structureId}`);
  const rect=facadeRectangle(polygon,spec.axis),p=rect.center,floor=spec.floor??s?.position[1]??(spec.detached?Math.max(...polygon.map(q=>ground.height(...q)??0)):Math.max(ground.height(...p)??0,roadSurface?.closest(...p)?.point?.[1]??0));
  if(spec.role!=='grandstand')garages.push({...rect,floor:floor+.04,detached:!!spec.detached});if(!spec.add)continue;
  const road=(referenceRoute(id,c)||c.path).reduce((a,b)=>Math.hypot(a[0]-p[0],a[2]-p[1])<Math.hypot(b[0]-p[0],b[2]-p[1])?a:b),normal=[-rect.axis[1],rect.axis[0]],face=Math.sign((road[0]-p[0])*normal[0]+(road[2]-p[1])*normal[1])||1;
  const b=new Builder('pit-facility',[p[0],floor,p[1]],rect.axis),w=rect.width,d=rect.depth,height=spec.height||8,doorH=3.6;
  const corners=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]];
  for(let i=0;i<4;i++){const a=corners[i],z=corners[(i+1)%4],steps=Math.ceil(Math.hypot(z[0]-a[0],z[1]-a[1])/12),at=u=>[a[0]+(z[0]-a[0])*u,a[1]+(z[1]-a[1])*u],bottom=q=>Math.min(0,(ground.height(p[0]+rect.axis[0]*q[0]+normal[0]*q[1],p[1]+rect.axis[1]*q[0]+normal[1]*q[1])??floor)-floor);for(let k=0;k<steps;k++){const q=at(k/steps),r=at((k+1)/steps);b.panel([[q[0],0,q[1]],[r[0],0,r[1]],[r[0],bottom(r),r[1]],[q[0],bottom(q),q[1]]],0x999e99,'foundation');}}
  if(spec.role==='grandstand'){
   for(let row=0;row<16;row++)b.box(0,.5+row*.5,face*(d/2-row*d/16),w,.45,d/16,0xa8b5bb,'grandstand-seating');
   for(let x=-w/2+5;x<w/2;x+=16)b.box(x,6,-face*d*.25,.35,12,.35,0x586a72,'grandstand-posts');
   b.box(0,12.2,0,w+2,.35,d+2,0xb7c6cc,'grandstand-roof');meshes.push(...b.meshes);continue;
  }
  b.box(0,height/2,0,w,height,d,0xe0dfd4,'garage-block');
  const bays=Math.max(3,Math.round(w/6.4));for(let i=0;i<bays;i++){
   const x=-w/2+(i+.5)*w/bays;b.box(x,doorH/2+.08,face*(d/2+.04),w/bays-.45,doorH,.1,0x263c43,'garage-doors');
   for(let y=.65;y<doorH;y+=.65)b.box(x,y,face*(d/2+.1),w/bays-.55,.045,.04,0x708389,'door-slats');
  }
  b.box(0,5.8,face*(d/2+.09),w-.6,2,.14,0x416473,'hospitality-glass');b.box(0,4.3,face*(d/2+.6),w+.5,.3,1.5,0xd8dddf,'balcony');
  if(spec.style==='melbourne'){
   // Six independent low barrel-roofed pavilions, as photographed in 2022–25.
   for(let i=0;i<12;i++){const z=-d/2+i*d/12,z2=-d/2+(i+1)*d/12,y=height+Math.sin(i/12*Math.PI)*1.65,y2=height+Math.sin((i+1)/12*Math.PI)*1.65;b.panel([[-w/2,y,z],[w/2,y,z],[w/2,y2,z2],[-w/2,y2,z2]],i%3===0?0xe1e5e6:0x5d8baa,'curved-roof');}
   b.box(-w*.38,height-.1,-face*d*.25,4,3.8,d*.48,0xe2e1d8,'utility-tower');
  }else if(spec.style==='sakhir'){
   b.box(0,height+.15,0,w,.3,d,0xc9b088,'roof');
   const count=Math.round(w/22),span=w/count;
   for(let i=0;i<count;i++){
    const x=-w/2+(i+.5)*span,peak=[x,height+5,-d*.12];
    const corners=[[x-span/2,height+.6,-d/2],[x+span/2,height+.6,-d/2],[x+span/2,height+.6,d/2],[x-span/2,height+.6,d/2]];
    for(let j=0;j<4;j++)b.panel([corners[j],corners[(j+1)%4],peak],0xe9e6dd,'tensile-canopy');
    b.box(x,height+4,-d*.12,.15,4,.15,0xd8dddd,'canopy-mast');
   }
  }else if(spec.style==='jeddah'){
   b.box(0,height+.2,0,w+1,.4,d+1,0xdfe3dc,'roof');
   for(const y of [8.7,12.1]){
    b.box(0,y,face*(d/2+.08),w-1,2.6,.16,0x355a61,'upper-glass');
    b.box(0,y-1.5,face*(d/2+.9),w+.4,.3,2,0xe2e6df,'terraces');
   }
   for(let x=-w/2+10;x<w/2;x+=28){
    b.box(x,height+1.8,-face*7,16,3,12,0xbac8c5,'roof-pavilion');
    for(let u=-10;u<=10;u+=1.2)b.box(x+u,height+3.5,face*6,.25,.25,15,0x263a3c,'roof-pergola');
   }
  }else if(spec.style==='ims'){
   b.box(0,height+.2,0,w,.4,d,0xd5d4c9,'roof');
   for(let row=0;row<5;row++)b.box(0,height+.5+row*.4,-face*(row*1.1-2),w-8,.25,.8,0x788c92,'roof-seating');
  }else if(spec.style==='jacarepagua'){
   b.box(0,height+.2,0,w+2,.4,d+2,0x3972a7,'blue-roof');
   b.box(-w/2+8,height+4,0,11,8,12,0x326ca0,'control-tower');
   b.box(-w/2+8,height+5,face*6.1,10,2.7,.2,0x294951,'tower-glass');
   b.box(-w/2+8,height+8.2,0,13,.5,14,0xabc0cb,'tower-roof');
  }else b.box(0,height+.2,0,w+1,.4,d+1,0xe5e5df,'roof');
  meshes.push(...b.meshes);
 }
 if(garages.length){const p=garages[Math.floor(garages.length/2)];features.push({id:'pit-building',name:f.buildingName||'Pit garages and hospitality',position:[p.center[0],p.floor+4,p.center[1]],viewDistance:Math.max(200,garages.reduce((sum,g)=>sum+g.width,0)*1.2),meshPrefixes:[...new Set(f.buildings.map(s=>s.add?'pit-facility/':s.structureId+'/'))],status:meshes.length?'added':'retained',kind:'landmark',sources:f.references.map(r=>r.url),note:f.buildingNote||'Stylised pit complex at mapped footprints, with a working apron facing the selected pit lane.'});}
 for(const open of f.openPitBoxes||[])garages.push({...open,open:true});
 return {meshes,features,garages};
}
export function referenceRoute(id,c){
 const f=pitFacility(id);if(!f?.route)return null;
 const r=f.route;if(r.points)return r.points.map(p=>[p[0],0,p[1]]);
 const file=JSON.parse(readFileSync(new URL(`../../authoring/raceway-extracts/${id}.json`,import.meta.url)));let chain=[];
 for(const id of r.wayIds){const w=file.elements.find(e=>e.id===Math.abs(id));if(!w)throw Error(`Missing selected pit way ${id}`);let pts=w.geometry.map(p=>project(c.geoFrame,p.lon,p.lat)).map(p=>[p[0],0,p[1]]);if(id<0)pts.reverse();if(chain.length&&Math.hypot(chain.at(-1)[0]-pts[0][0],chain.at(-1)[2]-pts[0][2])>3)throw Error(`Disconnected selected pit way ${id}`);chain.push(...(chain.length?pts.slice(1):pts));}
 return [...(r.entry||[]).map(p=>[p[0],0,p[1]]),...chain,...(r.exit||[]).map(p=>[p[0],0,p[1]])];
}
export function makeWorkingAprons(points,width,garages,road){
 const b=new Builder('pitlane'),triangles=[],walls=new Map();
 points=points.map(p=>{const y=road.height(p[0],p[2]);return [p[0],y!==null&&y-p[1]<3?y:p[1],p[2]];});
 for(const garage of garages){
  if(garage.detached)continue;
  const {center,axis,depth}=garage,n=[-axis[1],axis[0]];
  const near=points.reduce((a,p)=>Math.hypot(a[0]-center[0],a[2]-center[1])<Math.hypot(p[0]-center[0],p[2]-center[1])?a:p),face=Math.sign((near[0]-center[0])*n[0]+(near[2]-center[1])*n[1])||1;
  const edge=p=>{const u=(p[0]-center[0])*axis[0]+(p[2]-center[1])*axis[1],facade=[center[0]+axis[0]*u+n[0]*face*(depth/2+.05),garage.open?p[1]:garage.floor,center[1]+axis[1]*u+n[1]*face*(depth/2+.05)],lane=[p[0]-n[0]*face*width/2,p[1],p[2]-n[1]*face*width/2];return {u,facade,lane};};
  const bays=new Map();
  for(let i=0;i<points.length-1;i++){
   const a=edge(points[i]),z=edge(points[i+1]);if(Math.abs(a.u)>garage.width/2||Math.abs(z.u)>garage.width/2)continue;
   const gap=Math.hypot(a.lane[0]-a.facade[0],a.lane[2]-a.facade[2]);if(gap>45||gap<.4)continue;
   triangles.push(...a.lane,...a.facade,...z.facade,...a.lane,...z.facade,...z.lane);
   if(garage.open){const dx=z.facade[0]-a.facade[0],dz=z.facade[2]-a.facade[2],len=Math.hypot(dx,dz),wall=new Builder('pitlane',[(a.facade[0]+z.facade[0])/2,(a.facade[1]+z.facade[1])/2+.45,(a.facade[2]+z.facade[2])/2],[dx/len,dz/len]);wall.box(0,0,0,len,.9,.3,0xadb7bb,'crew-wall');b.meshes.push(...wall.meshes);}
   const wa=[points[i][0]+n[0]*face*(width/2+.65),points[i][1]+.6,points[i][2]+n[1]*face*(width/2+.65)],wz=[points[i+1][0]+n[0]*face*(width/2+.65),points[i+1][1]+.6,points[i+1][2]+n[1]*face*(width/2+.65)];
   walls.set(i,{n:n.map(v=>v*face)});
   const bay=Math.floor((a.u+garage.width/2)/24),score=Math.abs((a.u+garage.width/2)%24-12);if(!bays.has(bay)||bays.get(bay).score>score)bays.set(bay,{...a,score});
  }
  for(const {lane,facade} of bays.values()){
   const p=lane.map((v,k)=>v+(facade[k]-v)*.45),point=(u,v)=>[p[0]+axis[0]*u+n[0]*v,p[1]+.03,p[2]+axis[1]*u+n[1]*v];
   for(const u of [-3.2,3.2])for(const v of [-1.6,1.6]){b.beam(point(u,v),point(u-Math.sign(u)*1.1,v),.06,0xf2e4ac,'pit-box-markings');b.beam(point(u,v),point(u,v-Math.sign(v)*.7),.06,0xf2e4ac,'pit-box-markings');}
  }
 }
 if(walls.size){const start=Math.min(...walls.keys()),end=Math.max(...walls.keys());for(let i=start;i<=end;i++){
   const side=walls.get(i)||walls.get([...walls.keys()].reduce((a,k)=>Math.abs(k-i)<Math.abs(a-i)?k:a,start));
   const offset=k=>{const p=points[k],a=points[Math.max(0,k-1)],z=points[Math.min(points.length-1,k+1)],len=Math.hypot(z[0]-a[0],z[2]-a[2]),n=[-(z[2]-a[2])/len,(z[0]-a[0])/len],sign=Math.sign(n[0]*side.n[0]+n[1]*side.n[1]);return[p[0]+n[0]*sign*(width/2+.65),p[1],p[2]+n[1]*sign*(width/2+.65)];};
   const a=offset(i),z=offset(i+1),dx=z[0]-a[0],dz=z[2]-a[2],len=Math.hypot(dx,dz),wall=new Builder('pitlane',[(a[0]+z[0])/2,(a[1]+z[1])/2+.6,(a[2]+z[2])/2],[dx/len,dz/len]);wall.box(0,0,0,len+.02,1.2,.4,0xbfc0b7,'separator');b.meshes.push(...wall.meshes);
  }}
 return {meshes:b.meshes,vertices:triangles};
}
