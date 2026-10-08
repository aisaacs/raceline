import * as T from '../../vendor/three.module.js';
import {Builder,rectangle} from './scene-additions.mjs';
export const landmarkReplacements={Singapore:['hero-02'],Suzuka:['hero-01'],Baku:['hero-02']};
export function repairLandmarks(id,c,ground){
 const meshes=[],features=[];
 const add=(b,name,position,distance,sources,note)=>{meshes.push(...b.meshes);features.push({id:b.prefix,name,position,viewDistance:distance,meshPrefixes:[b.prefix+'/'],status:'added',kind:'landmark',sources,note});};
 if(id==='Singapore'||id==='Suzuka'){
  const singapore=id==='Singapore',l=c.landmarks.find(l=>l.kind==='wheel'),r=rectangle(c.structures.find(s=>s.id===l.id).footprint.coordinates[0]),p=l.position,y=ground.height(p[0],p[2])??p[1],b=new Builder('signature-observation-wheel',[p[0],y,p[2]],r.axis),radius=singapore?75:22.5,cy=singapore?87.5:26.25,count=singapore?28:40,depth=singapore?7:2.2,white=0xdbded8;
  b.box(0,.18,0,radius*.7,.36,depth*3,0x979d97,'boarding-platform');
  for(const side of [-1,1]){for(const x of [-1,1])b.beam([x*radius*.3,.3,side*depth],[0,cy,side*depth*.44],singapore?1:.45,white,'a-frame');b.beam([0,cy,-depth*.55],[0,cy,depth*.55],singapore?1.5:.65,white,'axle');}
  const ringPoint=(a,z)=>[Math.cos(a)*radius,cy+Math.sin(a)*radius,z];
  for(const z of [-depth*.35,depth*.35])for(let i=0;i<112;i++)b.beam(ringPoint(i/112*Math.PI*2,z),ringPoint((i+1)/112*Math.PI*2,z),singapore?.5:.22,white,'circular-rim');
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2,x=Math.cos(a)*radius,y=cy+Math.sin(a)*radius;for(const side of [-1,1])b.beam([0,cy,side*depth*.4],[x,y,side*depth*.35],singapore?.1:.06,0xa3b0ba,'spokes');
   if(singapore){b.box(x,y,0,4,2.5,7,0x46616c,'capsule-glazing');b.box(x,y-1.45,0,4.2,.4,7.1,white,'capsule-floor');b.box(x,y+2.1,0,4.2,.8,7.1,white,'capsule-roof');for(const side of [-1,1])b.box(x+side*1.8,y+.3,0,.18,3.1,7.15,white,'capsule-frames');}
   else{const colors=[0xd35440,0xe8ae37,0x508bb4,0x6f9a67];b.beam([x,y,0],[x,y-1.2,0],.1,white,'hangers');b.box(x,y-1.6,0,1.5,1.3,1.8,colors[Math.floor(i/5)%4],'gondolas');b.box(x,y-.75,0,1.8,.25,2,white,'gondola-roofs');}
  }
  add(b,singapore?'Singapore Flyer':'Suzuka Circuit Wheel',[p[0],y+cy,p[2]],singapore?340:125,[singapore?'https://www.singaporeflyer.com/en/fun-facts':'https://www.suzukacircuit.jp/eng/park/attraction/circuit-wheel/'],singapore?'Circular 150 m wheel, 165 m overall height and 28 level capsules, at the mapped site. Original simplified structure.':'Original circular wheel at its mapped site, approximately 50 m above local ground, with level hanging gondolas.');
 }
 if(id==='Baku'){
  const l=c.landmarks.find(l=>l.kind==='flames'),r=rectangle(c.structures.find(s=>s.id===l.id).footprint.coordinates[0]),p=l.position,y=p[1],b=new Builder('signature-flame-towers',[p[0],y,p[2]],r.axis);
  b.box(0,2,0,152,4,130,0x9e9d92,'shared-podium');
  for(const [cx,cz,h,lean]of[[-45,32,182,1],[48,25,165,-1],[0,-45,161,1]]){
   const rings=Array.from({length:25},(_,i)=>{const t=i/24,w=23*Math.pow(1-t,.38)+.25,d=14*Math.pow(1-t,.58)+.2,offset=lean*(28*t*t-5*Math.sin(t*Math.PI));return Array.from({length:16},(_,k)=>{const a=k/16*Math.PI*2;return[cx+offset+Math.cos(a)*w,4+t*(h-4),cz+Math.sin(a)*d];});});
   for(let j=0;j<24;j++)for(let k=0;k<16;k++){const a=rings[j][k],z=rings[j+1][k],v=rings[j+1][(k+1)%16],w=rings[j][(k+1)%16];b.panel([a,z,v,w],k%3===0?0x6593a2:0x406a7c,'curved-glass');if(k%2===0)b.beam(a,z,.14,0xb9c6c7,'vertical-mullions');}
   for(let j=1;j<24;j++)for(let k=0;k<16;k++)b.beam(rings[j][k],rings[j][(k+1)%16],.16,0xacb9ba,'floor-bands');
  }
  add(b,'Flame Towers',[p[0],y+90,p[2]],460,['https://www.hok.com/projects/view/baku-flame-towers/','https://www.skyscrapercenter.com/complex/618'], 'Three separate tapered, curving towers around a shared podium at the mapped landmark site. Published tower heights 182 / 165 / 161 m; stylised massing and approximate local terrain.');
 }
 return{meshes,features};
}
