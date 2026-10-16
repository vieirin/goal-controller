/**
 * STS-Tool's project export, `.exp` (goal-controller#163, #160 D-R8): a
 * hand-built export, from the format documented on #160 (gzip of a
 * Java-serialised file list), read to its files and its `.sts`; a file
 * whose `[B` descriptor is fresh and one that back-references it; and a
 * truncated stream, an error rather than a partial project.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { gzipSync } from 'zlib';
import { describe, it } from 'mocha';
import { readSerializedProject, readStsProject } from '../../../src';

const sts = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'tax-toy.sts'),
  'utf8',
);

const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u32 = (n: number) => [
  (n >>> 24) & 0xff,
  (n >>> 16) & 0xff,
  (n >>> 8) & 0xff,
  n & 0xff,
];
/** TC_STRING: its 2-byte length and bytes */
const string = (text: string) => [
  0x74,
  ...u16(text.length),
  ...Buffer.from(text, 'latin1'),
];
/** TC_ARRAY of a fresh `[B` descriptor: its uid, flags, no fields, TC_ENDBLOCKDATA, TC_NULL */
const freshBytes = (content: Buffer) => [
  0x75,
  0x72,
  ...u16(2),
  ...Buffer.from('[B'),
  0xac,
  0xf3,
  0x17,
  0xf8,
  0x06,
  0x08,
  0x54,
  0xe0,
  0x02,
  ...u16(0),
  0x78,
  0x70,
  ...u32(content.length),
  ...content,
];
/** TC_ARRAY back-referencing the descriptor (TC_REFERENCE, a handle) */
const sharedBytes = (content: Buffer) => [
  0x75,
  0x71,
  ...u32(0x007e0005),
  ...u32(content.length),
  ...content,
];

/** A serialised list of two files: `.project` (fresh `[B`) and the model (back-referenced). */
const serialised = () =>
  Buffer.from([
    0xac,
    0xed,
    0x00,
    0x05,
    ...string('.project'),
    ...freshBytes(Buffer.from('<projectDescription/>')),
    ...string('Models/STS/tax-toy.sts'),
    ...sharedBytes(Buffer.from(sts, 'utf8')),
  ]);

describe('STS-ml: .exp, STS-Tool’s project export', () => {
  it('reads a project’s files, a fresh [B descriptor and a back-referenced one', async () => {
    const project = await readStsProject(
      new Uint8Array(gzipSync(serialised())),
    );
    assert.ok(!('error' in project), JSON.stringify(project));
    assert.deepStrictEqual(Object.keys(project.files), [
      '.project',
      'Models/STS/tax-toy.sts',
    ]);
    assert.strictEqual(
      Buffer.from(project.files['.project']!).toString(),
      '<projectDescription/>',
    );
    assert.strictEqual(project.sts, sts);
  });

  it('is an error, not a partial project, when the stream is truncated', () => {
    const whole = serialised();
    const result = readSerializedProject(
      new Uint8Array(whole.subarray(0, whole.length - 100)),
    );
    assert.deepStrictEqual(Object.keys(result), ['error']);
    assert.match(
      (result as { error: string }).error,
      /Models\/STS\/tax-toy\.sts: .*truncated/,
    );
  });

  it('is an error when it isn’t gzip, or isn’t a serialisation stream', async () => {
    assert.match(
      (
        (await readStsProject(new Uint8Array(serialised()))) as {
          error: string;
        }
      ).error,
      /Not a gzip stream/,
    );
    assert.match(
      (
        (await readStsProject(
          new Uint8Array(gzipSync(Buffer.from('<xml/>'))),
        )) as {
          error: string;
        }
      ).error,
      /Not a Java serialisation stream/,
    );
  });
});
