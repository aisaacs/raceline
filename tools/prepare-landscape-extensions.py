"""Freeze compact terrain extensions. Requires Shapely 2.1+ for authoring only.
Usage: node tools/export-landscape-inputs.mjs /tmp/landscape-inputs
       python tools/prepare-landscape-extensions.py /tmp/landscape-inputs
The ordinary scene builder consumes the frozen JSON with no Python dependency.
"""
import json, sys
from pathlib import Path
from shapely import MultiPoint, Polygon, union_all, constrained_delaunay_triangles
folder=Path(sys.argv[1]); water=json.load(open('authoring/landmark-water.json')); selected=set(sys.argv[2:]); output=Path('authoring/landscape-extensions.json'); result=json.loads(output.read_text())['circuits'] if selected and output.exists() else {}
def triangles(shape):
    return [[[round(x,5),round(y,5)] for x,y in list(t.exterior.coords)[:3]] for t in constrained_delaunay_triangles(shape).geoms if t.area>1e-6]
for file in folder.glob('*.json'):
    if selected and file.stem not in selected: continue
    d=json.load(open(file)); old=MultiPoint([(p[0],p[2]) for t in d['base'] for p in t]).convex_hull
    if not d['points']: continue
    new=union_all([old,MultiPoint(d['points']).convex_hull.buffer(20,join_style=2)]).convex_hull
    extra=new.difference(old)
    if extra.area<1: continue
    mapped=union_all([Polygon(r) for w in water.get(file.stem,[]) for r in w['rings']])
    land=extra.difference(mapped); wet=extra.intersection(mapped)
    if file.stem=='Singapore':
        # The old water stops just inside the cutout. Fill that narrow seam
        # from the actual surface boundaries rather than the convex hull.
        dry=union_all([Polygon([(p[0],p[2]) for p in t]) for t in d['base'] if Polygon([(p[0],p[2]) for p in t]).area>1e-8])
        oldwet=union_all([Polygon([(p[0],p[2]) for p in t]) for t in d['water'] if Polygon([(p[0],p[2]) for p in t]).area>1e-8])
        wet=new.intersection(mapped).difference(union_all([dry,oldwet]))
    result[file.stem]={'land':triangles(land),'water':triangles(wet),'outline':[[round(x,5),round(y,5)] for x,y in list(new.exterior.coords)[:-1]]}
    print(file.stem,len(result[file.stem]['land']),len(result[file.stem]['water']))
Path('authoring/landscape-extensions.json').write_text(json.dumps({'notice':'Original terrain cutouts expanded to contain mapped architecture. Singapore water outline © OpenStreetMap contributors, ODbL 1.0; see landmark-water.json.','circuits':result},separators=(',',':'))+'\n')
