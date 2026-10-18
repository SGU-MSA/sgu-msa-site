import { inflateRawSync } from "node:zlib";

/**
 * Test-only: reads a plain zip the way an unzip tool does, from its central
 * directory, and checks each entry's CRC, so a test can say "the zip opens
 * with its folders" (term export, review fixes P5) without a dependency.
 */
export type UnzippedEntry = { path: string; data: Buffer };

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

export function unzip(zip: Buffer): UnzippedEntry[] {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error("No end of central directory: not a zip.");
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const entries: UnzippedEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(at) !== 0x02014b50)
      throw new Error("Broken central directory.");
    const method = zip.readUInt16LE(at + 10);
    const crc = zip.readUInt32LE(at + 16);
    const stored = zip.readUInt32LE(at + 20);
    const size = zip.readUInt32LE(at + 24);
    const nameLength = zip.readUInt16LE(at + 28);
    const extra = zip.readUInt16LE(at + 30);
    const comment = zip.readUInt16LE(at + 32);
    const offset = zip.readUInt32LE(at + 42);
    const path = zip.subarray(at + 46, at + 46 + nameLength).toString("utf8");
    if (zip.readUInt32LE(offset) !== 0x04034b50)
      throw new Error(`Broken local header for ${path}.`);
    const start =
      offset +
      30 +
      zip.readUInt16LE(offset + 26) +
      zip.readUInt16LE(offset + 28);
    const raw = zip.subarray(start, start + stored);
    const data = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    if (data.length !== size || crc32(data) !== crc)
      throw new Error(`${path} is damaged.`);
    entries.push({ path, data });
    at += 46 + nameLength + extra + comment;
  }
  return entries;
}
