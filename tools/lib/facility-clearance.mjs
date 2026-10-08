import{facadeRectangle}from'./pit-facilities.mjs';
import{DrivingCorridor}from'./driving-clearance.mjs';
import{sceneTriangles,Surface}from'./scene-additions.mjs';
// Check newly authored buildings against retained architecture, including the
// duplicated source buildings hidden inside merged urban tiles.
export function facilityClearance(g,facility,context){
 if(!facility.buildings.some(s=>s.add))return [];
 const ground=new Surface(sceneTriangles(g,n=>/^terrain(?!-skirt)/.test(n))),groups=new Map(),errors=[];
 g.scene.traverse(o=>{if(!o.isMesh)return;const n=g.parser.json.nodes[g.parser.associations.get(o)?.nodes]?.name||o.name;if(/^(pit-|hero-|stand-|building-map-|urban-map-tile-)/.test(n)&&!n.startsWith('pit-facility/'))groups.set(n,null);});
 for(const n of groups.keys())groups.set(n,sceneTriangles(g,name=>name===n));
 for(const [i,s]of facility.buildings.entries()){
  if(!s.add)continue;const st=context.structures.find(x=>x.id===s.structureId),r=facadeRectangle(s.polygon||st.footprint.coordinates[0],s.axis),floor=s.floor??st?.position[1]??ground.height(...r.center)??0;
  const a=[r.center[0]-r.axis[0]*(r.width/2-.2),floor,r.center[1]-r.axis[1]*(r.width/2-.2)],b=[r.center[0]+r.axis[0]*(r.width/2-.2),floor,r.center[1]+r.axis[1]*(r.width/2-.2)],box=new DrivingCorridor([a,b],r.depth-.4,{bottom:.4,height:(s.height||8)+2}),hits=new Set();
  for(const [n,triangles]of groups)if(triangles.some(t=>box.intersections(t).length))hits.add(n.split('/')[0]);
  if(hits.size)errors.push(`Pit facility ${i+1} overlaps retained architecture: ${[...hits].join(', ')}`);
 }
 return errors;
}
