import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{project}from'../lib/scene-additions.mjs';
const context=JSON.parse(readFileSync(new URL('../../authoring/scene-context.json',import.meta.url))).circuits.Montreal;
const routes=JSON.parse(readFileSync(new URL('../../authoring/pitlanes.json',import.meta.url))).circuits;
const way=JSON.parse(readFileSync(new URL('../../authoring/raceway-extracts/Montreal.json',import.meta.url))).elements.find(e=>e.id===413000959);
test('Montreal joins the mapped entry before the chicane and exit at the Senna S',()=>{
 const r=routes.Montreal;assert.equal(r.method,'mapped');
 for(const [actual,geo]of[[r.points[0],way.geometry[0]],[r.points.at(-1),way.geometry.at(-1)]]){const p=project(context.geoFrame,geo.lon,geo.lat);assert.ok(Math.hypot(p[0]-actual[0],p[1]-actual[2])<.01);}
 assert.ok(r.points.at(-1)[2]>950,'Must not merge back onto the start/finish straight');
});
test('all shipped pit routes have finite geometry and a bounded grade',()=>{assert.equal(Object.keys(routes).length,40);for(const[id,r]of Object.entries(routes)){assert.ok(r.points.length>20,id);for(let i=0;i<r.points.length;i++){const p=r.points[i];assert.ok(p.every(Number.isFinite),id);if(i){const q=r.points[i-1],distance=Math.hypot(p[0]-q[0],p[2]-q[2]);assert.ok(Math.abs(p[1]-q[1])/distance<.3,id);}}}});

test('junction blending keeps the mapped endpoint and meets the track tangent',async()=>{
 const{blendPitEndpoint}=await import('../lib/pitlanes.mjs');const path=Array.from({length:41},(_,i)=>[i-20,0,0]),points=Array.from({length:21},(_,i)=>[i,0,i*.45]);
 const result=blendPitEndpoint(points,path,15);assert.deepEqual(result[0],points[0]);assert.deepEqual(result.at(-1),points.at(-1));assert.ok(Math.abs((result[1][2]-result[0][2])/(result[1][0]-result[0][0]))<.1);assert.equal(points[1][2],.45);
});
