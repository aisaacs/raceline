"""Freeze public OSM raceway/pit-lane geometry for authored scene additions."""
import json,urllib.request,urllib.parse,concurrent.futures
from pathlib import Path
root=Path(__file__).resolve().parents[1]
rows=json.loads((root/'circuits/index.json').read_text())['circuits']
cache=root/'authoring/raceway-extracts';cache.mkdir(exist_ok=True)
def fetch(c):
 path=cache/(c['id']+'.json')
 if path.exists():return json.loads(path.read_text())
 at=c['centre'];loc=f'around:2200,{at["lat"]},{at["lon"]}'
 query='[out:json][timeout:30];('+f'way({loc})["highway"="raceway"]["name"~"[Pp]it|Boxengasse|Boksz|Boks|Pitstraat"];way({loc})["service"="pit_lane"];way({loc})["raceway"~"pit"];'+');out geom;'
 for host in ['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter']:
  try:
   req=urllib.request.Request(host,data=urllib.parse.urlencode({'data':query}).encode(),headers={'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Raceline-scene-authoring/1.0'})
   with urllib.request.urlopen(req,timeout=50) as r:data=json.load(r)
   if data.get('remark'):raise RuntimeError(data['remark'])
   data['racelineSource']={'query':query,'endpoint':host,'attribution':'© OpenStreetMap contributors, ODbL 1.0'}
   path.write_text(json.dumps(data,separators=(',',':'))+'\n');print(c['id'],len(data['elements']),flush=True);return data
  except Exception as e:last=e
 print(c['id']+': unavailable: '+str(last),flush=True);return None
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(fetch,rows))
print('Saved',sum(r is not None for r in results),'circuit extracts',flush=True)
