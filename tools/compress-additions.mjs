import{readFileSync}from'node:fs';
import{compressAdditions}from'./lib/compress-additions.mjs';
const ids=process.argv.slice(2),all=JSON.parse(readFileSync('circuits/index.json')).circuits.map(c=>c.id);
for(const id of ids.length?ids:all){if(!all.includes(id))throw Error(`Unknown circuit ${id}`);compressAdditions(`scenes/${id}.glb`);console.log(`${id}: authored geometry packed without quantisation`);}
