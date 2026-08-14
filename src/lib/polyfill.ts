import { Buffer as BrowserBuffer } from "buffer";

function writeBigUInt64LE(this: Uint8Array, value: bigint | number, offset = 0) {
  const view = new DataView(this.buffer, this.byteOffset, this.byteLength);
  view.setBigUint64(offset, BigInt(value), true);
  return offset + 8;
}

function readBigUInt64LE(this: Uint8Array, offset = 0) {
  const view = new DataView(this.buffer, this.byteOffset, this.byteLength);
  return view.getBigUint64(offset, true);
}

function patch(proto: object) {
  const p = proto as {
    writeBigUInt64LE?: unknown;
    readBigUInt64LE?: unknown;
    writeBigUint64LE?: unknown;
    readBigUint64LE?: unknown;
  };
  if (typeof p.writeBigUInt64LE !== "function") p.writeBigUInt64LE = writeBigUInt64LE;
  if (typeof p.writeBigUint64LE !== "function") p.writeBigUint64LE = writeBigUInt64LE;
  if (typeof p.readBigUInt64LE !== "function") p.readBigUInt64LE = readBigUInt64LE;
  if (typeof p.readBigUint64LE !== "function") p.readBigUint64LE = readBigUInt64LE;
}

if (typeof window !== "undefined") {
  patch(Uint8Array.prototype);
  patch(BrowserBuffer.prototype);
  (globalThis as unknown as { Buffer: typeof BrowserBuffer }).Buffer = BrowserBuffer;
}
