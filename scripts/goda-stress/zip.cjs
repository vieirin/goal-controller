/**
 * A zip archive's files, read with Node's zlib: enough for SA-BSN's
 * `param.zip` (stored or deflated entries, no encryption, no zip64), so the
 * harness needs no `unzip` on PATH.
 */
const zlib = require('zlib');

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;

/** The archive's files, `{ name: Buffer }`, directories left out. */
const unzip = (archive) => {
  // the end-of-central-directory record: its last 22 bytes, plus a comment of up to 64 KB
  let end = archive.length - 22;
  while (end >= 0 && archive.readUInt32LE(end) !== END_OF_CENTRAL_DIRECTORY)
    end -= 1;
  if (end < 0) throw new Error('not a zip archive');
  const entries = archive.readUInt16LE(end + 10);
  let at = archive.readUInt32LE(end + 16);
  const files = {};
  for (let i = 0; i < entries; i += 1) {
    if (archive.readUInt32LE(at) !== CENTRAL_DIRECTORY_ENTRY)
      throw new Error(`bad central directory entry at ${at}`);
    const method = archive.readUInt16LE(at + 10);
    const compressedSize = archive.readUInt32LE(at + 20);
    const nameLength = archive.readUInt16LE(at + 28);
    const extraLength = archive.readUInt16LE(at + 30);
    const commentLength = archive.readUInt16LE(at + 32);
    const local = archive.readUInt32LE(at + 42);
    const name = archive.toString('utf8', at + 46, at + 46 + nameLength);
    at += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue;
    if (archive.readUInt32LE(local) !== LOCAL_HEADER)
      throw new Error(`${name}: bad local header`);
    const start =
      local +
      30 +
      archive.readUInt16LE(local + 26) +
      archive.readUInt16LE(local + 28);
    const data = archive.subarray(start, start + compressedSize);
    if (method === 0) files[name] = Buffer.from(data);
    else if (method === 8) files[name] = zlib.inflateRawSync(data);
    else throw new Error(`${name}: compression method ${method}`);
  }
  return files;
};

module.exports = { unzip };
