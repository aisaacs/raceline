import test from 'node:test';
import assert from 'node:assert/strict';
import {DrivingCorridor} from '../lib/driving-clearance.mjs';
test('driving clearance detects a vertical fence crossing the lane',()=>{
 const c=new DrivingCorridor([[0,0,0],[10,1,0]],5);
 assert.deepEqual(c.intersections([[5,0,-8],[5,4,-8],[5,4,8]]),[0]);
});
test('a wall outside the lane and an overhead bridge leave the corridor clear',()=>{
 const c=new DrivingCorridor([[0,0,0],[10,1,0]],5);
 assert.deepEqual(c.intersections([[0,0,3],[10,0,3],[10,3,3]]),[]);
 assert.deepEqual(c.intersections([[0,6,-8],[10,6,-8],[10,6,8]]),[]);
});
