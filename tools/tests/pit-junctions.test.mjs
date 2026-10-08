import test from 'node:test';
import assert from 'node:assert/strict';
import {Surface} from '../lib/scene-additions.mjs';
import {joinPitAsphalt,paintOnRoad,subtractTriangle} from '../lib/pit-junctions.mjs';
const road=new Surface([[[0,2,0],[10,2,0],[10,2,10]],[[0,2,0],[10,2,10],[0,2,10]]]);
const paving=[-5,2.2,4,5,2.2,4,5,2.2,6,-5,2.2,4,5,2.2,6,-5,2.2,6];
test('junction subtracts overlapping asphalt and shares the original road height',()=>{
 const r=joinPitAsphalt(paving,road);
 assert.ok(Math.abs(r.removedArea-10)<1e-6);
 assert.ok(r.junctionVertices>0);assert.ok(r.maxJoinGap<1e-6);
 for(let i=0;i<r.vertices.length;i+=3){assert.ok(r.vertices[i]<=1e-7);if(Math.abs(r.vertices[i])<1e-7)assert.ok(Math.abs(r.vertices[i+1]-2)<1e-6);}
 const repeat=joinPitAsphalt(r.vertices,road);assert.ok(repeat.removedArea<1e-6);
});
test('no second asphalt layer is generated when a pit segment is already on the road',()=>{
 const r=joinPitAsphalt([1,2.2,1,8,2.2,1,8,2.2,8],road);
 assert.equal(r.vertices.length,0);assert.ok(r.removedArea>0);
});
test('cutting a kerb or runoff opening preserves the surrounding surface elevation',()=>{
 const r=joinPitAsphalt(paving,road,{fitHeight:false});
 for(let i=1;i<r.vertices.length;i+=3)assert.equal(r.vertices[i],2.2);
});
test('clipping does not mutate input geometry and emits upward-facing triangles',()=>{
 const copy=paving.slice(),r=joinPitAsphalt(paving,road);assert.deepEqual(paving,copy);
 for(let i=0;i<r.vertices.length;i+=9){const a=r.vertices.slice(i,i+3),b=r.vertices.slice(i+3,i+6),c=r.vertices.slice(i+6,i+9),normalY=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);assert.ok(normalY>=-1e-7);}
});
test('an underpass keeps its driving surface below a separate road deck',()=>{
 const below=[1,-4,1,8,-4,1,8,-4,8];
 const r=joinPitAsphalt(below,road,{verticalSeparation:3});
 assert.equal(r.removedArea,0);assert.equal(r.vertices.length,9);
 for(let i=1;i<r.vertices.length;i+=3)assert.equal(r.vertices[i],-4);
 const paint=paintOnRoad(below,road,.035,3);
 for(let i=1;i<paint.length;i+=3)assert.ok(Math.abs(paint[i]+3.965)<1e-8);
});
test('paint is split and fitted to both sides of an undulating road',()=>{
 const folded=new Surface([[[0,0,0],[5,2,0],[5,2,10]],[[0,0,0],[5,2,10],[0,0,10]],[[5,2,0],[10,0,0],[10,0,10]],[[5,2,0],[10,0,10],[5,2,10]]]);
 const paint=paintOnRoad([1,0,4,9,0,4,9,0,6,1,0,4,9,0,6,1,0,6],folded);
 assert.ok(paint.length>18);
 for(let i=0;i<paint.length;i+=3)assert.ok(Math.abs(paint[i+1]-folded.height(paint[i],paint[i+2])-.035)<1e-6);
});
test('collapsed exported road triangles cannot duplicate paving or paint',()=>{
 // Real Estoril coordinates: the old global shoelace calculation gave this
 // zero-area clip a sign and emitted the complete paving triangle twice.
 const clip=[[-4.812198395484149,15.998910484648087,307.4509135750458],[-14.699262199852397,15.998910484648087,303.1168582087474],[-14.699262199852397,15.998910484648087,303.1168582087474]];
 const tri=[[-23.48038101196289,16.1141357421875,299.2676086425781],[-23.590238571166992,16.1141357421875,299.5279541015625],[-22.293088912963867,16.1141357421875,300.49835205078125]];
 assert.deepEqual(subtractTriangle(tri,clip),[tri]);
 const degenerate=new Surface([clip]),result=joinPitAsphalt(tri.flat(),degenerate,{fitHeight:false});
 assert.equal(result.removedArea,0);assert.equal(result.vertices.length,9);
 assert.equal(paintOnRoad(tri.flat(),degenerate).length,9);
});
