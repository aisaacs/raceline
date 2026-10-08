// GLB container I/O. Rewrites JSON without touching compressed geometry bytes.
import { readFileSync, writeFileSync } from 'node:fs';
export function readGLB(path) {
  const data = readFileSync(path);
  if (data.readUInt32LE(0) !== 0x46546c67 || data.readUInt32LE(4) !== 2 || data.readUInt32LE(8) !== data.length) throw new Error(`Invalid GLB: ${path}`);
  const chunks = [];
  for (let offset = 12; offset < data.length;) {
    const length = data.readUInt32LE(offset), type = data.readUInt32LE(offset + 4);
    if (offset + 8 + length > data.length) throw new Error(`Truncated GLB: ${path}`);
    chunks.push({ type, data: data.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  if (chunks[0]?.type !== 0x4e4f534a) throw new Error(`Missing GLB JSON: ${path}`);
  return { json: JSON.parse(chunks[0].data.toString()), chunks: chunks.slice(1) };
}
export function writeGLB(path, { json, chunks }) {
  const text = Buffer.from(JSON.stringify(json));
  const padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 0x20);
  text.copy(padded);
  const parts = [{ type: 0x4e4f534a, data: padded }, ...chunks];
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + parts.reduce((sum, c) => sum + c.data.length + 8, 0), 8);
  const buffers = [header];
  for (const c of parts) {
    const h = Buffer.alloc(8); h.writeUInt32LE(c.data.length, 0); h.writeUInt32LE(c.type, 4);
    buffers.push(h, c.data);
  }
  writeFileSync(path, Buffer.concat(buffers));
}
