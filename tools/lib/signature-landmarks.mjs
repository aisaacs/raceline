import {readFileSync} from 'node:fs';
import * as T from '../../vendor/three.module.js';
import {Builder,rectangle,project} from './scene-additions.mjs';
import {facadeRectangle} from './pit-facilities.mjs';
import {joinPitAsphalt} from './pit-junctions.mjs';
const C={stone:0xb6a484,steel:0x99a6af,roof:0xe5e0cf,glass:0x385d72,red:0xb33737};
export function addSignatures(id,c,road,ground){
 const meshes=[],features=[];
 const add=(b,name,position,distance,source,note='Original stylised model at the mapped landmark location.')=>{
   meshes.push(...b.meshes);features.push({id:b.prefix,name,position,viewDistance:distance,meshPrefixes:[b.prefix+'/'],status:'added',kind:'landmark',sources:[source].filter(Boolean),note});
 };
 // Keep new structures on their mapped sites, reducing the footprint where the
 // game's enlarged road leaves less room than the real circuit has.
 function fit(center,axis,w,d){
   const normal=[-axis[1],axis[0]];
   for(let scale=1;scale>=.25;scale-=.05){let okay=true;for(let x=-w/2;x<=w/2+.01;x+=Math.max(2,w/24))for(let z=-d/2;z<=d/2+.01;z+=Math.max(2,d/8))if(road.distance(center[0]+(axis[0]*x+normal[0]*z)*scale,center[1]+(axis[1]*x+normal[1]*z)*scale)<2)okay=false;
     if(okay)return {w:w*scale,d:d*scale};}
   throw new Error(`${id}: landmark footprint intersects road`);
 }
 const a=c.addition;
 if(a){
  const rect=a.kind==='imola-tower'?facadeRectangle(a.footprint):rectangle(a.footprint),p=rect.center,axis=rect.axis,nearest=c.path.reduce((best,q)=>Math.hypot(q[0]-p[0],q[2]-p[1])<Math.hypot(best[0]-p[0],best[2]-p[1])?q:best,c.path[0]),y=ground.height(...p)??nearest[1];
  if(a.kind==='bull'){
   const b=new Builder('signature-bull',[p[0],y,p[1]]);const metal=0x868d91;
   b.box(0,.35,0,22,.7,9,0x74706a,'plinth');b.ellipsoid(0,10,0,7,3,2.8,metal);b.ellipsoid(-6,10.8,0,3,2.5,2.3,metal,'head');
   for(const x of [-4,4])for(const z of [-1.9,1.9])b.beam([x,9,z],[x+(x<0?-1:1),.7,z],.7,metal,'legs');
   for(const z of [-1,1]){b.beam([-7.5,12,z*1.8],[-9,14,z*3.8],.42,0xc4c9cb,'horns');b.beam([-9,14,z*3.8],[-8.5,15,z*4.2],.24,0xc4c9cb,'horns');}
   b.beam([6,11,0],[9,8,0],.35,metal,'tail');
   let last=null;for(let i=0;i<=24;i++){const angle=Math.PI*i/24,point=[Math.cos(angle)*13,Math.sin(angle)*17.2,.8];if(last)b.beam(last,point,.5,0x9caaa6,'arch');last=point;}
   add(b,'Steel bull and arch',[p[0],y+8,p[1]],75,'https://www.redbullring.com/en/history/');
  }else if(a.kind==='castle'){
   const originalCenter=[...p];let f;outer:for(let radius=0;radius<=36;radius+=4)for(let k=0;k<16;k++){const q=[originalCenter[0]+Math.cos(k*Math.PI/8)*radius,originalCenter[1]+Math.sin(k*Math.PI/8)*radius];try{f=fit(q,axis,34,12);p[0]=q[0];p[1]=q[1];break outer;}catch{}}if(!f)throw new Error('No clear Old City wall placement');const b=new Builder('signature-old-city',[p[0],y,p[1]],axis);
   b.box(0,5,0,f.w,10,f.d,C.stone);for(const x of [-f.w*.38,f.w*.38]){b.cylinder(x,6,0,f.d*.6,12,C.stone,'towers');for(let k=0;k<10;k++){const t=k/10*Math.PI*2;b.box(x+Math.cos(t)*f.d*.52,12.7,Math.sin(t)*f.d*.52,1.6,1.6,1.6,C.stone,'battlements');}}
   for(let x=-f.w/2;x<f.w/2;x+=3)b.box(x,10.7,0,1.5,1.4,f.d,C.stone,'battlements');
   add(b,'Old City walls and gate',[p[0],y+5,p[1]],100,a.source,'Stylised walls at the mapped Old City gate; the surrounding street layout follows the supplied model.');
  }else if(a.kind==='timing-tower'||a.kind==='imola-tower'){
   const f=fit(p,axis,Math.min(rect.width,23)*(a.kind==='imola-tower'?.83:1),Math.min(rect.depth,18)*(a.kind==='imola-tower'?.7:1)),b=new Builder('signature-timing-tower',[p[0],y,p[1]],axis),h=a.kind==='imola-tower'?27:34;
   b.box(0,h/2,0,f.w*.8,h,f.d*.8,0xd1d0c8);for(let k=1;k<=5;k++){const level=k*h/6;b.box(0,level,0,f.w,1.2,f.d,C.steel,'terraces');b.box(0,level+2,0,f.w*.81,2.5,f.d*.81,C.glass,'windows');}b.box(0,h+.5,0,f.w*1.05,1,f.d*1.05,0xf5f1dd,'roof');
   add(b,a.kind==='imola-tower'?'Imola timing tower':'Nürburgring timing tower',[p[0],y+h*.5,p[1]],125,a.source);
  }else if(a.kind==='palm-canopy'){
   const f=fit(p,axis,Math.min(570,rect.width*.88),Math.min(66,rect.depth*.48)),b=new Builder('signature-palm-canopy',[p[0],y,p[1]],axis);
   for(let x=-f.w/2+18;x<f.w/2;x+=36){b.cylinder(x,9,0,1.2,18,C.steel,'trunks');for(const sign of [-1,1]){for(let k=0;k<5;k++){const z=sign*(k+1)*f.d/12;b.box(x,k*.95+1,z,32,1.5,f.d/6,0x407779,'seating');}for(let petal=0;petal<6;petal++){const l=x-17+petal*34/6,r=l+34/6;b.panel([[x,20,0],[l,16.5,sign*f.d/2],[r,16.5,sign*f.d/2],[x+1.5,20,0]],petal%2?0xd9dccf:0xc6cec7,'palm-roof');b.beam([x,18,0],[(l+r)/2,16.5,sign*f.d/2],.22,C.steel,'ribs');}}}
   add(b,'Palm canopy grandstand',[p[0],y+10,p[1]],Math.max(260,f.w*1.3),a.source,'Stylised paired palm canopies, fitted inside the widened track corridor.');
  }else if(a.kind==='main-grandstand'){
   p[0]-=axis[1]*48;p[1]+=axis[0]*48;const f=fit(p,axis,rect.width*.82,rect.depth*.3),b=new Builder('signature-main-grandstand',[p[0],y,p[1]],axis);
   for(let k=0;k<10;k++)b.box(0,1+k*1.3,-f.d*.4+k*f.d*.075,f.w,1.6,f.d*.08,k%2?0xae3938:0xbd5445,'seating');
   for(let x=-f.w/2+12;x<f.w/2;x+=28)b.box(x,14,f.d*.35,1.6,28,1.6,C.steel,'columns');
   for(let x=-f.w/2;x<f.w/2;x+=26){const next=Math.min(x+25,f.w/2);b.panel([[x,25,-f.d/2],[next,25,-f.d/2],[next,30,0],[x,30,0]],0xd64e43,'lantern-roof');b.panel([[x,30,0],[next,30,0],[next,25,f.d/2],[x,25,f.d/2]],0xb99660,'lantern-roof');}
   add(b,'Main grandstand lantern roof',[p[0],y+13,p[1]],Math.max(300,f.w*1.3),a.source);
  }else if(a.kind==='hotel'){
   const b=new Builder('signature-yas-hotel');
   // Two separate hotel wings leave the track passage open at ground level.
   for(const [center,dir,w,d]of[[[-25,418],[1,-.15],150,42],[[130,376],[.12,1],104,28]]){
    const f=fit(center,dir,w,d),gy=ground.height(...center)??y;
    const wing=new Builder('signature-yas-hotel',[center[0],gy,center[1]],dir);
    wing.box(0,13,0,f.w*.83,26,f.d*.7,C.glass,'hotel-wings');
    for(let k=0;k<8;k++)wing.box(0,3+k*3.2,0,f.w*.84,.45,f.d*.72,0xb1bbc1,'floors');
    for(let i=0;i<=20;i++){const x=-f.w/2+i*f.w/20;for(let k=0;k<12;k++){const aa=Math.PI*k/12,bb=Math.PI*(k+1)/12;wing.beam([x,22+Math.sin(aa)*14,Math.cos(aa)*f.d/2],[x,22+Math.sin(bb)*14,Math.cos(bb)*f.d/2],.25,0xd7cbed,'gridshell');}}
    for(let k=0;k<=12;k++){const t=Math.PI*k/12;wing.beam([-f.w/2,22+Math.sin(t)*14,Math.cos(t)*f.d/2],[f.w/2,22+Math.sin(t)*14,Math.cos(t)*f.d/2],.25,0xe1daec,'gridshell');}
    b.meshes.push(...wing.meshes);
   }
   // A real, intentional elevated link; audited separately for vertical clearance.
   const link=new Builder('signature-yas-link',[70,Math.max(y,10)+26,404],[1,-.15]);link.box(0,0,0,82,5,12,0x7d718b,'bridge');b.meshes.push(...link.meshes);
   add(b,'Yas hotel and lattice roof',[25,y+18,402],450,a.source,'Stylised twin hotel wings and elevated connecting bridge; original lattice artwork.');
  }
 }
 if(id==='Shanghai'){
   for(const s of c.structures.filter(s=>/^Section (H|K)$/.test(s.name))){
    const polygon=s.footprint.coordinates[0],r=rectangle(polygon),f=fit(r.center,r.axis,Math.min(r.width*.85,85),Math.min(r.depth*.85,35));
    const b=new Builder(`signature-lotus-${s.name}`,[r.center[0],s.position[1],r.center[1]],r.axis);
    for(let x=-f.w*.35;x<=f.w*.35;x+=f.w*.35){b.cylinder(x,14,0,.7,28,C.steel,'columns');for(let k=0;k<8;k++){const a=k/8*Math.PI*2,aa=(k+1)/8*Math.PI*2;b.panel([[x,29,0],[x+Math.cos(a)*f.w*.18,24,Math.sin(a)*f.d*.5],[x+Math.cos(aa)*f.w*.18,24,Math.sin(aa)*f.d*.5]],0xe2e4d9,'lotus-roof');}}
    add(b,`Lotus canopy · ${s.name}`,[r.center[0],s.position[1]+20,r.center[1]],180,s.source);
   }
 }
 if(id==='Monza'){
   const ways=JSON.parse(readFileSync(new URL('../../authoring/raceway-extracts/Monza.json',import.meta.url))).elements.filter(w=>/^Sopraelevata/.test(w.tags?.name||'')||w.id===34404729);
   const all=ways.flatMap(w=>w.geometry.map(p=>project(c.geoFrame,p.lon,p.lat))),center=rectangle(all).center,b=new Builder('signature-historic-banking');let cameraPoint;
   const distance=(a,z)=>Math.hypot(a[0]-z[0],a[1]-z[1]);
   const pending=ways.map(w=>w.geometry.map(p=>project(c.geoFrame,p.lon,p.lat))),chains=[];
   // Assemble complete curves before sampling. Segment ends are not independent
   // elevated slabs: banking and height must stay continuous across map ways.
   while(pending.length){let chain=pending.shift(),changed=true;while(changed){changed=false;for(let i=0;i<pending.length;i++){let p=pending[i];if(distance(chain.at(-1),p[0])<.2)chain.push(...p.slice(1));else if(distance(chain.at(-1),p.at(-1))<.2)chain.push(...p.slice(0,-1).reverse());else if(distance(chain[0],p.at(-1))<.2)chain.unshift(...p.slice(0,-1));else if(distance(chain[0],p[0])<.2)chain.unshift(...p.slice(1).reverse());else continue;pending.splice(i,1);changed=true;break;}}chains.push(chain);}
   const bridgeSegments=ways.filter(w=>w.tags.bridge==='yes').flatMap(w=>w.geometry.slice(1).map((p,i)=>[project(c.geoFrame,w.geometry[i].lon,w.geometry[i].lat),project(c.geoFrame,p.lon,p.lat)]));
   const nearBridge=p=>bridgeSegments.some(([a,z])=>{const dx=z[0]-a[0],dz=z[1]-a[1],u=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return distance(p,[a[0]+u*dx,a[1]+u*dz])<22;});
   for(const pts of chains){
     const points=[];for(let i=1;i<pts.length;i++){const a=pts[i-1],z=pts[i],steps=Math.ceil(distance(z,a)/4);for(let j=0;j<steps;j++)points.push([a[0]+(z[0]-a[0])*j/steps,a[1]+(z[1]-a[1])*j/steps]);}points.push(pts.at(-1));
     const normals=points.map((p,i)=>{const a=points[Math.max(0,i-2)],z=points[Math.min(points.length-1,i+2)],len=distance(z,a)||1;let n=[-(z[1]-a[1])/len,(z[0]-a[0])/len];if(n[0]*(p[0]-center[0])+n[1]*(p[1]-center[1])<0)n=n.map(v=>-v);return n;});
     const levels=points.map((p,i)=>{let base=ground.height(...p)??0;if(nearBridge(p))for(let off=-8;off<=8;off+=2){const y=road.height(p[0]+normals[i][0]*off,p[1]+normals[i][1]*off);if(y!==null)base=Math.max(base,y+8.5);}return base+.15;});
     for(let i=1;i<points.length;i++)levels[i]=Math.max(levels[i],levels[i-1]-.12*distance(points[i],points[i-1]));
     for(let i=points.length-2;i>=0;i--)levels[i]=Math.max(levels[i],levels[i+1]-.12*distance(points[i],points[i+1]));
     let bank=points.map((p,i)=>{const a=points[Math.max(0,i-10)],z=points[Math.min(points.length-1,i+10)],u=[p[0]-a[0],p[1]-a[1]],v=[z[0]-p[0],z[1]-p[1]],angle=Math.abs(Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1])),curvature=angle/Math.max(1,(distance(p,a)+distance(z,p))/2);return Math.min(1,Math.max(0,(curvature-.0007)/.0026))*Math.min(1,i/30,(points.length-1-i)/30);});
     for(let pass=0;pass<12;pass++)bank=bank.map((v,i)=>i&&i<bank.length-1?(bank[i-1]+2*v+bank[i+1])/4:v);
     const edge=(i,side)=>[points[i][0]+normals[i][0]*side*6,levels[i]+(side+1)*3.7*bank[i],points[i][1]+normals[i][1]*side*6];
     for(let i=0;i<points.length-1;i++){
       const corners=[edge(i,-1),edge(i,1),edge(i+1,1),edge(i+1,-1)],bridge=nearBridge(points[i])||nearBridge(points[i+1]);
       if(bridge)b.panel(corners,0x96948a,'banked-concrete');
       else{const triangles=[...corners[0],...corners[1],...corners[2],...corners[0],...corners[2],...corners[3]],clipped=joinPitAsphalt(triangles,road).vertices;if(clipped.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(clipped,3));g.computeVertexNormals();b.add(g,0x96948a,'banked-concrete',true);}}
       const outer=edge(i,1),next=edge(i+1,1);
       if((bridge||road.distance(outer[0],outer[2])>2&&road.distance(next[0],next[2])>2)&&bank[i]>.15)b.beam(outer.map((v,k)=>v+(k===1?.8:0)),next.map((v,k)=>v+(k===1?.8:0)),.18,0xaaa99e,'outer-rail');
       // Close the embankment to the terrain; retain real bridge openings.
       for(const side of [-1,1]){const a=edge(i,side),z=edge(i+1,side);if(road.distance(a[0],a[2])>10&&road.distance(z[0],z[2])>10){const ga=[a[0],ground.height(a[0],a[2])??levels[i],a[2]],gz=[z[0],ground.height(z[0],z[2])??levels[i+1],z[2]];b.panel([a,z,gz,ga],0x787d6b,'embankment');}}
       if(!cameraPoint&&i>points.length/3)cameraPoint=edge(i,0);
     }
   }
   add(b,'Historic banked oval',cameraPoint,720,'https://www.monzanet.it/sopraelevata-monza/','Mapped historic north and south banking, with stylised banking and bridge clearance; not a surveyed structural reconstruction.');
 }
 return {meshes,features};
}
