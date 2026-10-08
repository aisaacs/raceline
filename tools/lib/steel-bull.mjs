// Original low-poly interpretation of the Spielberg Corten-steel sculpture.
// Reference: redbullring.com/en/history/ (17.2 m including its arch).
import * as T from '../../vendor/three.module.js';
import {Builder} from './scene-additions.mjs';
export function steelBull(origin,axis=[1,0]){
 const b=new Builder('signature-bull',origin,axis),rust=[0x79402b,0x945137,0xa55e3f,0x6e3828],steel=0x7c817e;
 // Perforated triangular plates, rather than a smooth closed animal skin.
 function plate(a,c,d,k){const mid=a.map((v,i)=>(v+c[i]+d[i])/3),inner=[a,c,d].map(p=>p.map((v,i)=>mid[i]+(v-mid[i])*.55));for(let i=0;i<3;i++)b.panel([[a,c,d][i],[a,c,d][(i+1)%3],inner[(i+1)%3],inner[i]],rust[k%rust.length],'corten-plates');}
 function shell(rings,part='body',perforated=true){const n=12,rows=rings.map(([x,y,z,ry,rz],j)=>Array.from({length:n},(_,i)=>{const t=i/n*Math.PI*2+(j%2)*.13;return[x,y+Math.cos(t)*ry,z+Math.sin(t)*rz];}));for(let j=0;j<rows.length-1;j++)for(let i=0;i<n;i++){const a=rows[j][i],c=rows[j+1][i],d=rows[j+1][(i+1)%n],e=rows[j][(i+1)%n];if(perforated){plate(a,c,d,i+j);plate(a,d,e,i+j+1);}else{b.panel([a,c,d],rust[(i+j)%4],part);b.panel([a,d,e],rust[(i+j+1)%4],part);}}}
 // High shoulder hump, narrower waist and muscular hindquarters.
 shell([[-5.9,10,0,.55,.55],[-5,10.7,0,1.05,1.1],[-4,11.1,0,1.5,1.5],[-3,11.1,0,2.15,1.95],[-2,10.9,0,2.5,2.2],[-1,10.5,0,2.3,2.1],[0,10,0,2,1.8],[1,9.6,0,1.75,1.55],[2,9.3,0,1.8,1.65],[3,8.9,0,2,1.8],[4,8.6,0,1.7,1.6],[4.8,8.4,0,.9,1.05]]);
 // Long sloping forehead, square tapered muzzle and hanging dewlap.
 shell([[-7.8,8.8,0,.55,.7],[-7.2,9.2,0,.85,.95],[-6.5,9.8,0,1.05,1.1],[-5.6,10.6,0,1.2,1.15]],'head',false);
 b.panel([[-6.4,8.8,-.6],[-5.3,7,-.65],[-4.6,7.7,-.9],[-3.8,9,-1.1]],rust[0],'dewlap');
 b.panel([[-6.4,8.8,.6],[-5.3,7,.65],[-4.6,7.7,.9],[-3.8,9,1.1]],rust[1],'dewlap');
 function limb(points,radii){for(let i=1;i<points.length;i++){const start=new T.Vector3(...points[i-1]),end=new T.Vector3(...points[i]),dir=end.clone().sub(start),g=new T.CylinderGeometry(radii[i],radii[i-1],dir.length(),5,1);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());b.add(g,rust[i%4],'angular-legs');}}
 for(const sign of [-1,1]){
  // Front legs folded back off the ground; rear legs brace the sculpture.
  limb([[-3.5,9,sign*1.4],[-3,6.6,sign*1.55],[-1.4,6,sign*1.5],[-1.9,7.2,sign*1.5]],[.85,.52,.32,.25]);
  limb([[3.2,8.8,sign*1.3],[3,5.7,sign*1.55],[4.7+(sign>0?.4:0),3.5,sign*1.7],[5.7+(sign>0?.5:0),.45,sign*1.9]],[1.15,.75,.42,.28]);
  b.box(5.5+(sign>0?.5:0),.32,sign*1.9,.95,.5,.7,0x47291f,'hooves');
  b.panel([[-5.7,10.7,sign*.8],[-5,11.5,sign*2],[-4.8,10.6,sign*1.8]],rust[0],'ears');
  // Horns sweep outward then forward, with sharp gold tips.
  const pts=[[-6.7,10.2,sign*.8],[-7.1,10.1,sign*1.9],[-7.9,10.5,sign*3],[-8.8,10.9,sign*3.5]],rs=[.33,.29,.18,.015];
  for(let i=1;i<pts.length;i++){const a=new T.Vector3(...pts[i-1]),z=new T.Vector3(...pts[i]),v=z.clone().sub(a),g=new T.CylinderGeometry(rs[i],rs[i-1],v.length(),7);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));g.translate(...a.add(z).multiplyScalar(.5).toArray());b.add(g,0xd8b635,'gold-horns');}
 }
 for(const [a,z]of[[[4.5,9,.2],[5.5,7,.3]],[[5.5,7,.3],[6.3,4,.4]],[[6.3,4,.4],[5.8,3.4,.5]]])b.beam(a,z,.13,rust[0],'tail');
 // Tall narrow arch crosses the bull transversely; rectangular plate sections.
 const arch=[];for(let i=0;i<=40;i++){const t=Math.PI*i/40;arch.push([.5+Math.cos(t)*2,Math.sin(t)*16.48+.1,Math.cos(t)*5.5]);}
 for(let i=1;i<arch.length;i++){const a=arch[i-1],z=arch[i];const g=new T.BoxGeometry(.75,new T.Vector3(...a).distanceTo(new T.Vector3(...z))+.04,1.05),v=new T.Vector3(...z).sub(new T.Vector3(...a));g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));g.translate(...a.map((v,k)=>(v+z[k])/2));b.add(g,steel,'steel-arch');}
 return b;
}
