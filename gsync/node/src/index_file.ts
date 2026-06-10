import { promises as fs } from "fs";
import * as path from "path";
import { asHash, FilePath, Hash } from "./types.js";
import { sha1Hex } from "./codec.js";

export interface IndexEntry {
  ctimeSec: number;
  ctimeNano: number;
  mtimeSec: number;
  mtimeNano: number;
  dev: number;
  ino: number;
  mode: number;
  uid: number;
  gid: number;
  fileSize: number;
  sha1: Hash; // 40-char hex string
  flags: number;
  path: string; // relative to working dir
}

export class Index {
  entries: Map<string, IndexEntry> = new Map();

  static async read(filePath: FilePath): Promise<Index> {
    const index = new Index();
    try {
      const buffer = await fs.readFile(filePath);
      if (buffer.length < 32) return index; // empty or invalid

      // Verify checksum (last 20 bytes is SHA-1)
      const dataToHash = buffer.subarray(0, buffer.length - 20);
      const expectedSha1 = buffer.subarray(buffer.length - 20).toString("hex");
      const actualSha1 = await sha1Hex(new Uint8Array(dataToHash));
      if (actualSha1 !== expectedSha1) {
        throw new Error("Index checksum mismatch");
      }

      const signature = buffer.subarray(0, 4).toString("utf8");
      if (signature !== "DIRC") {
        throw new Error("Invalid index signature: " + signature);
      }

      const version = buffer.readUInt32BE(4);
      if (version !== 2 && version !== 3 && version !== 4) {
        throw new Error("Unsupported index version: " + version);
      }

      const numEntries = buffer.readUInt32BE(8);
      let offset = 12;

      for (let i = 0; i < numEntries; i++) {
        if (offset + 62 > buffer.length) break;

        const entryStart = offset;
        const ctimeSec = buffer.readUInt32BE(offset);
        const ctimeNano = buffer.readUInt32BE(offset + 4);
        const mtimeSec = buffer.readUInt32BE(offset + 8);
        const mtimeNano = buffer.readUInt32BE(offset + 12);
        const dev = buffer.readUInt32BE(offset + 16);
        const ino = buffer.readUInt32BE(offset + 20);
        const mode = buffer.readUInt32BE(offset + 24);
        const uid = buffer.readUInt32BE(offset + 28);
        const gid = buffer.readUInt32BE(offset + 32);
        const fileSize = buffer.readUInt32BE(offset + 36);
        const sha1 = asHash(buffer.subarray(offset + 40, offset + 60).toString("hex"));
        const flags = buffer.readUInt16BE(offset + 60);

        offset += 62;

        // Extract path (null terminated)
        let pathEnd = buffer.indexOf(0, offset);
        if (pathEnd === -1) {
          throw new Error("Index entry path not null-terminated");
        }
        const entryPath = buffer.subarray(offset, pathEnd).toString("utf8");
        offset = pathEnd + 1; // skip null byte

        // Align to 8 bytes relative to entryStart
        const lengthSoFar = offset - entryStart;
        const padding = (8 - (lengthSoFar % 8)) % 8;
        offset += padding;

        index.entries.set(entryPath, {
          ctimeSec,
          ctimeNano,
          mtimeSec,
          mtimeNano,
          dev,
          ino,
          mode,
          uid,
          gid,
          fileSize,
          sha1,
          flags,
          path: entryPath
        });
      }
    } catch (e: any) {
      if (e.code !== "ENOENT") {
        console.warn("Failed to read index:", e);
      }
    }
    return index;
  }

  async write(filePath: FilePath): Promise<void> {
    const buffers: Buffer[] = [];
    
    // Header
    const header = Buffer.alloc(12);
    header.write("DIRC", 0, "utf8");
    header.writeUInt32BE(2, 4); // version 2
    header.writeUInt32BE(this.entries.size, 8);
    buffers.push(header);

    // Sort entries by path (Git sorts paths byte-by-byte)
    const sortedEntries = Array.from(this.entries.values()).sort((a, b) => {
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    });

    for (const entry of sortedEntries) {
      const entryBuf = Buffer.alloc(62);
      entryBuf.writeUInt32BE(entry.ctimeSec >>> 0, 0);
      entryBuf.writeUInt32BE(entry.ctimeNano >>> 0, 4);
      entryBuf.writeUInt32BE(entry.mtimeSec >>> 0, 8);
      entryBuf.writeUInt32BE(entry.mtimeNano >>> 0, 12);
      entryBuf.writeUInt32BE(entry.dev >>> 0, 16);
      entryBuf.writeUInt32BE(entry.ino >>> 0, 20);
      entryBuf.writeUInt32BE(entry.mode >>> 0, 24);
      entryBuf.writeUInt32BE(entry.uid >>> 0, 28);
      entryBuf.writeUInt32BE(entry.gid >>> 0, 32);
      entryBuf.writeUInt32BE(entry.fileSize >>> 0, 36);
      Buffer.from(entry.sha1, "hex").copy(entryBuf, 40);
      entryBuf.writeUInt16BE(entry.flags, 60);
      buffers.push(entryBuf);

      const pathBuf = Buffer.from(entry.path, "utf8");
      buffers.push(pathBuf);
      
      const nullByte = Buffer.from([0]);
      buffers.push(nullByte);

      const entryLengthSoFar = 62 + pathBuf.length + 1;
      const paddingLength = (8 - (entryLengthSoFar % 8)) % 8;
      if (paddingLength > 0) {
        buffers.push(Buffer.alloc(paddingLength));
      }
    }

    const dataToHash = Buffer.concat(buffers);
    const checksumHex = await sha1Hex(new Uint8Array(dataToHash));
    const checksumBuf = Buffer.from(checksumHex, "hex");

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.concat([dataToHash, checksumBuf]));
  }
}
