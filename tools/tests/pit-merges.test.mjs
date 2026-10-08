import test from 'node:test';
import assert from 'node:assert/strict';
import{Surface}from'../lib/scene-additions.mjs';
import{adaptPitMerges,paintStripesAt}from'../lib/pit-merges.mjs';
const road=new Surface([[[0,0,-12],[200,0,-12],[200,0,12]],[[0,0,-12],[200,0,12],[0,0,12]]]);
test('mapped centreline connections become edge lanes without moving the separated pit',()=>{
 const path=Array.from({length:101},(_,i)=>[i*2,0,0]),points=Array.from({length:101},(_,i)=>[10+i*1.8,0,24*Math.sin(Math.PI*i/100)]),copy=structuredClone(points);
 const r=adaptPitMerges(points,path,road,6);
 assert.ok(Math.abs(r.points[0][2]-9)<.001);assert.ok(Math.abs(r.points.at(-1)[2]-9)<.001);
 assert.deepEqual(r.points[50],points[50]);assert.deepEqual(points,copy);
 for(let i=0;i<r.points.length;i++)if(road.height(points[i][0],points[i][2])!==null)assert.ok(r.points[i][2]>=8.99&&r.points[i][2]<=12.001);
});
test('paint audit distinguishes one merge divider from two stray pit edges',()=>{
 const stripe=z=>[[[-2,.035,z],[-2,.035,z+.18],[2,.035,z+.18]],[[-2,.035,z],[2,.035,z+.18],[2,.035,z]]];
 assert.equal(paintStripesAt([...stripe(-2.8),...stripe(2.8)],[0,0,0],[1,0,0],6).length,2);
 assert.equal(paintStripesAt(stripe(-2.8),[0,0,0],[1,0,0],6).length,1);
});
test('a map endpoint at the asphalt boundary still merges the whole lane',()=>{
 const path=Array.from({length:101},(_,i)=>[i*2,0,0]),points=Array.from({length:1001},(_,i)=>[10+i*.18,0,12+12*Math.sin(Math.PI*i/1000)]);
 const r=adaptPitMerges(points,path,road,6);
 assert.ok(Math.abs(r.points[0][2]-9)<.001);assert.ok(Math.abs(r.points.at(-1)[2]-9)<.001);
 assert.deepEqual(r.points[500],points[500]);
 assert.ok(r.shared[0]&&r.shared.at(-1));
 for(const [a,b]of[[r.points[0],r.points[1]],[r.points.at(-1),r.points.at(-2)]])assert.ok(Math.abs((b[2]-a[2])/(b[0]-a[0]))<.05,'merge should meet the road tangentially');
});
test('a widened main road may share part of the garage lane',()=>{
 const path=Array.from({length:101},(_,i)=>[i*2,0,0]),points=Array.from({length:101},(_,i)=>[10+i*1.8,0,14*Math.sin(Math.PI*i/100)]);
 const r=adaptPitMerges(points,path,road,6);
 assert.deepEqual(r.points[50],points[50]);
 assert.ok(Math.abs(r.points[0][2]-9)<.001);assert.ok(Math.abs(r.points.at(-1)[2]-9)<.001);
});
