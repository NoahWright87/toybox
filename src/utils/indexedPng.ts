/**
 * Minimal indexed-color (PNG color type 3) encoder — the format Canvas's
 * own toDataURL/toBlob cannot produce (browsers only ever emit truecolor
 * PNGs). Pairs with paletteQuantize.ts's QuantizedImage: a palette of
 * <=256 colors gets written once into a PLTE chunk, and every pixel is
 * stored as a small integer index instead of 3-4 full color bytes — the
 * same size win Photoshop's "Indexed Color" mode gets you.
 *
 * DEFLATE compression uses the browser's built-in CompressionStream
 * ("deflate" mode produces a zlib-wrapped stream, exactly what a PNG IDAT
 * chunk requires) instead of a hand-rolled DEFLATE implementation.
 */
import type { QuantizedImage, RGBA } from "./paletteQuantize";

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function uint32BE(value: number): Uint8Array {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

// Standard CRC-32 (zlib/PNG polynomial), table-based.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const textEncoder = new TextEncoder();

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = textEncoder.encode(type);
  const crc = crc32(concatBytes([typeBytes, data]));
  return concatBytes([uint32BE(data.length), typeBytes, data, uint32BE(crc)]);
}

/** Smallest PNG bit depth (1/2/4/8) that can index every palette entry. */
function bitDepthFor(paletteSize: number): number {
  if (paletteSize <= 2) return 1;
  if (paletteSize <= 4) return 2;
  if (paletteSize <= 16) return 4;
  return 8;
}

function makeIHDR(width: number, height: number, bitDepth: number): Uint8Array {
  return concatBytes([uint32BE(width), uint32BE(height), new Uint8Array([bitDepth, 3 /* color type: indexed */, 0, 0, 0])]);
}

function makePLTE(palette: RGBA[]): Uint8Array {
  const bytes = new Uint8Array(palette.length * 3);
  palette.forEach((c, i) => {
    bytes[i * 3] = c.r;
    bytes[i * 3 + 1] = c.g;
    bytes[i * 3 + 2] = c.b;
  });
  return bytes;
}

/** Per-palette-entry alpha. Omitted entirely when every entry is fully opaque (the common case for non-transparent art). */
function makeTRNS(palette: RGBA[]): Uint8Array | null {
  let lastNonOpaque = -1;
  palette.forEach((c, i) => {
    if (c.a !== 255) lastNonOpaque = i;
  });
  if (lastNonOpaque === -1) return null;
  const bytes = new Uint8Array(lastNonOpaque + 1);
  for (let i = 0; i < bytes.length; i++) bytes[i] = palette[i].a;
  return bytes;
}

/** Packs one filter byte (always 0/"None" — indexed data doesn't benefit from PNG's predictive filters) plus bit-packed indices per scanline. */
function packScanlines(indices: Uint8Array, width: number, height: number, bitDepth: number): Uint8Array {
  const rowBytes = Math.ceil((width * bitDepth) / 8);
  const raw = new Uint8Array((rowBytes + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter type: None
    if (bitDepth === 8) {
      raw.set(indices.subarray(y * width, y * width + width), offset);
      offset += width;
      continue;
    }
    const pixelsPerByte = 8 / bitDepth;
    for (let bytePos = 0; bytePos < rowBytes; bytePos++) {
      let byte = 0;
      for (let p = 0; p < pixelsPerByte; p++) {
        const x = bytePos * pixelsPerByte + p;
        const value = x < width ? indices[y * width + x] : 0;
        // PNG packs sub-byte pixels MSB-first: the first pixel of the byte occupies the highest bits.
        byte |= (value & ((1 << bitDepth) - 1)) << (8 - bitDepth * (p + 1));
      }
      raw[offset++] = byte;
    }
  }
  return raw;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream("deflate"); // zlib-wrapped — exactly what PNG's IDAT expects
  const writer = stream.writable.getWriter();
  void writer.write(data as Uint8Array<ArrayBuffer>);
  void writer.close();

  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return concatBytes(chunks);
}

/** Encodes a QuantizedImage as a complete indexed-color PNG byte stream. */
export async function encodeIndexedPng(image: QuantizedImage): Promise<Uint8Array> {
  const { width, height, palette, indices } = image;
  const bitDepth = bitDepthFor(palette.length);
  const raw = packScanlines(indices, width, height, bitDepth);
  const compressed = await deflate(raw);

  const trnsData = makeTRNS(palette);
  return concatBytes([
    PNG_SIGNATURE,
    makeChunk("IHDR", makeIHDR(width, height, bitDepth)),
    makeChunk("PLTE", makePLTE(palette)),
    ...(trnsData ? [makeChunk("tRNS", trnsData)] : []),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", new Uint8Array(0)),
  ]);
}

/** Base64 data-URL encoding, chunked to avoid call-stack limits on `String.fromCharCode(...bytes)` for larger buffers. */
export function pngBytesToDataUrl(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}
