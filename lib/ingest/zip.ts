import { inflateSync } from "fflate";

/** One file inside a zip archive, as listed by its central directory. */
export interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflate. */
  method: number;
  compressedSize: number;
  size: number;
  /** Offset of the entry's local file header. */
  offset: number;
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/**
 * Reads a zip's central directory. Returns null for archives this reader
 * doesn't handle (ZIP64, encryption, odd layouts) so callers can fall back.
 */
export function listZip(bytes: Uint8Array): ZipEntry[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  if (count === 0xffff || cursor === 0xffffffff) return null; // ZIP64

  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let k = 0; k < count; k++) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== CENTRAL) return null;
    const flags = view.getUint16(cursor + 8, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const entry: ZipEntry = {
      method: view.getUint16(cursor + 10, true),
      compressedSize: view.getUint32(cursor + 20, true),
      size: view.getUint32(cursor + 24, true),
      offset: view.getUint32(cursor + 42, true),
      name: decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)),
    };
    if (flags & 1) return null; // encrypted
    if (entry.compressedSize === 0xffffffff || entry.size === 0xffffffff || entry.offset === 0xffffffff) return null;
    entries.push(entry);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Decompresses one entry, using the browser's native inflater when it's available. */
export async function readZipEntry(bytes: Uint8Array<ArrayBuffer>, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(entry.offset, true) !== LOCAL) throw new Error(`Corrupt zip entry: ${entry.name}`);
  const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data.slice();
  if (entry.method !== 8) throw new Error(`Unsupported compression in ${entry.name}`);
  if (typeof DecompressionStream === "undefined") return inflateSync(data);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
