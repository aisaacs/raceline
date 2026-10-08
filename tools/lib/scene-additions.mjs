// Append authored geometry to a compressed GLB. Existing buffers and accessors
// stay intact. The saved baseline makes rebuilds deterministic and idempotent.
import * as T from '../../vendor/three.module.js';
import { readGLB, writeGLB } from './glb.mjs';

export function restoreBase(glb) {
  const j = glb.json, base = j.asset.extras?.racelineAdditions;
  if (!base) return;
  for (const [key, count] of Object.entries(base.counts)) j[key].length = count;
  j.scenes[base.scene].nodes = base.roots;
  for (const [i, mesh] of base.meshOverrides || []) j.nodes[i].mesh = mesh;
  j.buffers[0].byteLength = base.bufferLength;
  glb.chunks[0].data = glb.chunks[0].data.subarray(0, base.binLength);
  delete j.asset.extras.racelineAdditions;
}

export function appendMeshes(path, meshes, replacements = []) {
  const glb = readGLB(path); restoreBase(glb);
  const j = glb.json, sceneIndex = j.scene || 0;
  const sourcePrimitives = new Map(j.nodes.filter(n => n.mesh !== undefined).map(n => [n.name, j.meshes[n.mesh].primitives[0]]));
  const counts = Object.fromEntries(['nodes','meshes','accessors','bufferViews','materials'].map(k => [k, (j[k] ||= []).length]));
  const base = { revision: 1, counts, scene: sceneIndex, roots: [...j.scenes[sceneIndex].nodes],
    bufferLength: j.buffers[0].byteLength, binLength: glb.chunks[0].data.length,
    meshOverrides: replacements.map(r => [r.node, j.nodes[r.node].mesh]) };
  let offset = base.binLength;
  const parts = [glb.chunks[0].data], materials = new Map();
  function attribute(array, type, count, componentType, bounds = false) {
    const data = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const pad = Buffer.alloc((4 - data.length % 4) % 4);
    const view = j.bufferViews.length;
    j.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length });
    parts.push(data,pad); offset += data.length + pad.length;
    const accessor = { bufferView: view, componentType, count, type };
    if (bounds) {
      accessor.min = [Infinity,Infinity,Infinity]; accessor.max = [-Infinity,-Infinity,-Infinity];
      for (let i=0;i<array.length;i++) { const k=i%3; accessor.min[k]=Math.min(accessor.min[k],array[i]);accessor.max[k]=Math.max(accessor.max[k],array[i]); }
    }
    j.accessors.push(accessor); return j.accessors.length - 1;
  }
  // Keep the original compressed vertex attributes and node transforms. Only
  // the index list changes when opening a gate through existing scenery.
  for (const replacement of replacements) {
    if (!replacement.indices.length) { delete j.nodes[replacement.node].mesh; continue; }
    const original = j.meshes[j.nodes[replacement.node].mesh];
    if (original.primitives.length !== 1) throw new Error('Expected a single primitive for scenery clipping');
    const primitive = { ...original.primitives[0], indices: attribute(new Uint32Array(replacement.indices), 'SCALAR', replacement.indices.length, 5125) };
    if (replacement.color !== undefined) {
      const material = structuredClone(j.materials[primitive.material]), c = new T.Color(replacement.color);
      material.pbrMetallicRoughness.baseColorFactor = [c.r,c.g,c.b,1];
      primitive.material = j.materials.length; j.materials.push(material);
    }
    j.nodes[replacement.node].mesh = j.meshes.length;
    j.meshes.push({ ...original, primitives: [primitive] });
  }
  for (const { name, geometry, color, doubleSided = false, extras, materialFrom } of meshes) {
    const key = `${color}/${doubleSided}`;
    if (!materials.has(key)) {
      materials.set(key,j.materials.length);
      const c = new T.Color(color);
      j.materials.push({name:`raceline-${color.toString(16)}`,pbrMetallicRoughness:{baseColorFactor:[c.r,c.g,c.b,1],metallicFactor:.08,roughnessFactor:.82},doubleSided});
    }
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal;
    const position = attribute(new Float32Array(p.array),'VEC3',p.count,5126,true);
    const normal = attribute(new Float32Array(n.array),'VEC3',n.count,5126);
    const mesh = j.meshes.length;
    const sourcePrimitive = materialFrom && sourcePrimitives.get(materialFrom);
    if (materialFrom && !sourcePrimitive) throw new Error(`Missing material source: ${materialFrom}`);
    // Match the road's exact linear colour, roughness and flat shading at joins.
    j.meshes.push({name,primitives:[{attributes:sourcePrimitive && !sourcePrimitive.attributes.NORMAL ? {POSITION:position} : {POSITION:position,NORMAL:normal},material:sourcePrimitive?.material ?? materials.get(key),mode:4}]});
    const node = { name, mesh }; if(extras)node.extras=extras;
    j.scenes[sceneIndex].nodes.push(j.nodes.length); j.nodes.push(node);
  }
  j.buffers[0].byteLength = offset;
  glb.chunks[0].data = Buffer.concat(parts);
  (j.asset.extras ||= {}).racelineAdditions = base;
  writeGLB(path, glb);
}

export class Builder {
  constructor(prefix,origin=[0,0,0],axis=[1,0]) {
    this.prefix=prefix;this.origin=new T.Vector3(...origin);this.angle=-Math.atan2(axis[1],axis[0]);this.meshes=[];
  }
  add(g,color,part='body',doubleSided=false) {
    g.rotateY(this.angle).translate(...this.origin.toArray());
    this.meshes.push({name:`${this.prefix}/${part}`,geometry:g,color,doubleSided});
  }
  box(x,y,z,w,h,d,color,part='body') { this.add(new T.BoxGeometry(w,h,d).translate(x,y,z),color,part); }
  ellipsoid(x,y,z,w,h,d,color,part='shell') { this.add(new T.SphereGeometry(1,24,12).scale(w,h,d).translate(x,y,z),color,part); }
  cylinder(x,y,z,r,h,color,part='structure',rTop=r) { this.add(new T.CylinderGeometry(rTop,r,h,16).translate(x,y,z),color,part); }
  beam(a,b,r,color,part='structure') {
    const start=new T.Vector3(...a),end=new T.Vector3(...b),dir=end.clone().sub(start);
    const g=new T.CylinderGeometry(r,r,dir.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());this.add(g,color,part);
  }
  panel(vertices,color,part='roof') {
    const positions=[];for(let i=1;i<vertices.length-1;i++)positions.push(...vertices[0],...vertices[i],...vertices[i+1]);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();this.add(g,color,part,true);
  }
}

export function combineMeshes(meshes) {
  const groups=new Map();
  for(const mesh of meshes){const key=`${mesh.name}:${mesh.color}:${mesh.doubleSided}`;if(!groups.has(key))groups.set(key,{...mesh,parts:[]});groups.get(key).parts.push(mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry);}
  return [...groups.values()].map(({parts,...mesh})=>{
    const count=parts.reduce((s,g)=>s+g.attributes.position.count,0);const p=new Float32Array(count*3),n=new Float32Array(count*3);let offset=0;
    for(const g of parts){if(!g.attributes.normal)g.computeVertexNormals();p.set(g.attributes.position.array,offset);n.set(g.attributes.normal.array,offset);offset+=g.attributes.position.array.length;}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(p,3));geometry.setAttribute('normal',new T.BufferAttribute(n,3));return {...mesh,geometry};
  });
}

export function sceneTriangles(gltf, test) {
  const triangles=[],v=new T.Vector3();
  gltf.scene.traverse(o=>{if(!o.isMesh)return;const name=gltf.parser.json.nodes[gltf.parser.associations.get(o)?.nodes]?.name||o.name;if(!test(name))return;
    const attr=o.geometry.attributes.position,idx=o.geometry.index,points=[];
    for(let i=0;i<attr.count;i++){v.fromBufferAttribute(attr,i).applyMatrix4(o.matrixWorld);points.push(v.toArray());}
    for(let i=0;i<(idx?.count??attr.count);i+=3)triangles.push([0,1,2].map(k=>points[idx?idx.getX(i+k):i+k]));
  });return triangles;
}
export function triangleHeight(tri,x,z) {
  const [a,b,c]=tri,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-10)return null;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
  return u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6?u*a[1]+v*b[1]+(1-u-v)*c[1]:null;
}
export class Surface {
  constructor(triangles) {
    this.triangles=triangles;this.grid=new Map();
    for(const t of triangles){const x=Math.floor(Math.min(...t.map(p=>p[0]))/40),X=Math.floor(Math.max(...t.map(p=>p[0]))/40),z=Math.floor(Math.min(...t.map(p=>p[2]))/40),Z=Math.floor(Math.max(...t.map(p=>p[2]))/40);
      for(let i=x;i<=X;i++)for(let j=z;j<=Z;j++){const key=`${i},${j}`;if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key).push(t);}
    }
  }
  height(x,z) { let best=null;for(const t of this.grid.get(`${Math.floor(x/40)},${Math.floor(z/40)}`)||[]){const y=triangleHeight(t,x,z);if(y!==null)best=best===null?y:Math.max(best,y);}return best; }
  closest(x,z) {
    const height=this.height(x,z);if(height!==null)return {distance:0,point:[x,height,z]};
    let best=Infinity,point=null;const nearby=new Set(),ix=Math.floor(x/40),iz=Math.floor(z/40);
    for(let i=ix-2;i<=ix+2;i++)for(let j=iz-2;j<=iz+2;j++)for(const t of this.grid.get(`${i},${j}`)||[])nearby.add(t);
    for(const t of nearby)for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],dx=b[0]-a[0],dz=b[2]-a[2],den=dx*dx+dz*dz;if(!den)continue;const u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/den)),d=Math.hypot(x-a[0]-u*dx,z-a[2]-u*dz);if(d<best){best=d;point=a.map((v,k)=>v+(b[k]-v)*u);}}
    return {distance:best,point};
  }
  distance(x,z) { return this.closest(x,z).distance; }
}

export function project(frame, lon, lat) {
  return [frame[2]+(lon-frame[0])*frame[4],frame[3]-(lat-frame[1])*111320];
}
export function rectangle(points) {
  const c=[0,0];for(const p of points){c[0]+=p[0]/points.length;c[1]+=p[1]/points.length;}
  let xx=0,zz=0,xz=0;for(const p of points){const x=p[0]-c[0],z=p[1]-c[1];xx+=x*x;zz+=z*z;xz+=x*z;}
  const a=.5*Math.atan2(2*xz,xx-zz),axis=[Math.cos(a),Math.sin(a)],normal=[-axis[1],axis[0]];
  const local=points.map(p=>[(p[0]-c[0])*axis[0]+(p[1]-c[1])*axis[1],(p[0]-c[0])*normal[0]+(p[1]-c[1])*normal[1]]);
  const lo=[0,1].map(k=>Math.min(...local.map(p=>p[k]))),hi=[0,1].map(k=>Math.max(...local.map(p=>p[k])));
  return {center:[c[0]+axis[0]*(lo[0]+hi[0])/2+normal[0]*(lo[1]+hi[1])/2,c[1]+axis[1]*(lo[0]+hi[0])/2+normal[1]*(lo[1]+hi[1])/2],axis,width:hi[0]-lo[0],depth:hi[1]-lo[1]};
}
