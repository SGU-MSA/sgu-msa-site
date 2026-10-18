import "server-only";
import * as zlib from "node:zlib";
import { TIMEZONE } from "../community/schema";

/**
 * A zip file written while it downloads (term export, review fixes P5): one
 * entry at a time, so only one photo or PDF is ever held in memory and the
 * response starts at once. Vercel's 4.5 MB response limit does not apply to
 * a streamed response; its time limit does (`maxDuration` on the route).
 * Plain zip (no Zip64): up to 65,535 entries and 4 GB, far above the free
 * plan's 1 GB of stored files. Opens in Windows, macOS and phones.
 */
export type ZipEntry = {
  /** The path inside the zip, folders separated by "/". */
  path: string;
  data: Uint8Array;
  /** Shown as the file's date when unzipped (Grenada time). */
  modified: Date;
  /** Deflate it (spreadsheets); photos and PDFs are stored as they are. */
  compress?: boolean;
};

/** The most a plain zip's sizes and offsets can count (no Zip64). */
const ZIP_LIMIT = 0xffffffff;
const ENTRY_LIMIT = 0xffff;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** Node's own CRC-32 (Node 20.15 and 22.2 on), much faster on big photos. */
const nativeCrc32 = (zlib as { crc32?: (data: Uint8Array) => number }).crc32;

/** The CRC-32 every zip entry carries. */
export function crc32(data: Uint8Array): number {
  if (nativeCrc32) return nativeCrc32(data) >>> 0;
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const grenadaParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** The MS-DOS date and time a zip entry stores (two-second steps, from 1980). */
function dosTime(when: Date): { time: number; date: number } {
  const parts = grenadaParts.formatToParts(when);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const year = Math.min(2107, Math.max(1980, part("year")));
  return {
    time: (part("hour") << 11) | (part("minute") << 5) | (part("second") >> 1),
    date: ((year - 1980) << 9) | (part("month") << 5) | part("day"),
  };
}

const utf8 = new TextEncoder();
/** Bit 11: the names are UTF-8 (accents and Arabic in titles). */
const UTF8_NAMES = 0x0800;

type Written = {
  name: Uint8Array;
  method: number;
  time: number;
  date: number;
  crc: number;
  stored: number;
  size: number;
  offset: number;
};

function localHeader(entry: Written): Uint8Array {
  const header = new DataView(new ArrayBuffer(30));
  header.setUint32(0, 0x04034b50, true);
  header.setUint16(4, 20, true);
  header.setUint16(6, UTF8_NAMES, true);
  header.setUint16(8, entry.method, true);
  header.setUint16(10, entry.time, true);
  header.setUint16(12, entry.date, true);
  header.setUint32(14, entry.crc, true);
  header.setUint32(18, entry.stored, true);
  header.setUint32(22, entry.size, true);
  header.setUint16(26, entry.name.length, true);
  header.setUint16(28, 0, true);
  return join([new Uint8Array(header.buffer), entry.name]);
}

function centralHeader(entry: Written): Uint8Array {
  const header = new DataView(new ArrayBuffer(46));
  header.setUint32(0, 0x02014b50, true);
  header.setUint16(4, 20, true);
  header.setUint16(6, 20, true);
  header.setUint16(8, UTF8_NAMES, true);
  header.setUint16(10, entry.method, true);
  header.setUint16(12, entry.time, true);
  header.setUint16(14, entry.date, true);
  header.setUint32(16, entry.crc, true);
  header.setUint32(20, entry.stored, true);
  header.setUint32(24, entry.size, true);
  header.setUint16(28, entry.name.length, true);
  // Extra field, comment, disk, internal and external attributes: none.
  header.setUint32(42, entry.offset, true);
  return join([new Uint8Array(header.buffer), entry.name]);
}

function endRecord(count: number, size: number, offset: number): Uint8Array {
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, count, true);
  end.setUint16(10, count, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Uint8Array(end.buffer);
}

function join(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * The zip of `entries`, written as they come. An entry that fails to load
 * (the iterator throws) errors the stream, so the browser reports a failed
 * download instead of saving a zip that looks complete.
 */
export function zipStream(
  entries: AsyncIterable<ZipEntry>,
): ReadableStream<Uint8Array> {
  const iterator = entries[Symbol.asyncIterator]();
  const written: Written[] = [];
  const names = new Set<string>();
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await iterator.next();
      if (next.done) {
        const directory = join(written.map(centralHeader));
        controller.enqueue(
          join([
            directory,
            endRecord(written.length, directory.length, offset),
          ]),
        );
        controller.close();
        return;
      }
      const entry = next.value;
      if (names.has(entry.path))
        throw new Error(`Two zip entries are named ${entry.path}.`);
      names.add(entry.path);
      const data = entry.compress
        ? new Uint8Array(zlib.deflateRawSync(entry.data))
        : entry.data;
      const record: Written = {
        name: utf8.encode(entry.path),
        method: entry.compress ? 8 : 0,
        ...dosTime(entry.modified),
        crc: crc32(entry.data),
        stored: data.length,
        size: entry.data.length,
        offset,
      };
      const header = localHeader(record);
      if (
        written.length + 1 >= ENTRY_LIMIT ||
        offset + header.length + data.length >= ZIP_LIMIT
      )
        throw new Error("The zip would be larger than a plain zip can hold.");
      written.push(record);
      offset += header.length + data.length;
      controller.enqueue(header);
      controller.enqueue(data);
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}
