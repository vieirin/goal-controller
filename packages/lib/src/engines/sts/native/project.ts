/**
 * STS-Tool's project export, `.exp` (goal-controller#163, #160 D-R8,
 * D-R9): gzip of a Java-serialised `ArrayList` of the project's files
 * (`.project`, `Models/STS/<name>.sts`, `Images/*.png`, `Documents/*.pdf`),
 * as the format notes on #160 document it from the tutorial projects UniTN
 * publishes. Not a native file (a native file is text): the project's
 * `.sts` is, read by ./read.
 *
 * The stream is read by its tags, and no class is deserialised:
 *
 * - a file's name is a `TC_STRING` (0x74, a 2-byte length, its bytes);
 * - its content, the next byte array: `TC_ARRAY` (0x75) with a fresh
 *   class descriptor for `[B` (`TC_CLASSDESC` 0x72, the name, its
 *   serialVersionUID, flags, no fields, `TC_ENDBLOCKDATA` 0x78, no
 *   superclass `TC_NULL` 0x70), or a back-reference to it (`TC_REFERENCE`
 *   0x71 and a 4-byte handle); then a 4-byte length and the bytes.
 */

/** A project's files by path, and its `.sts`'s text. */
export type StsProject = {
  files: Readonly<Record<string, Uint8Array>>;
  /** the first `Models/**.sts`, as text; null when the project has none */
  sts: string | null;
};

const MAGIC = 0xaced;
const TC_STRING = 0x74;
const TC_ARRAY = 0x75;
const TC_CLASSDESC = 0x72;
const TC_REFERENCE = 0x71;
/** what a project file's name looks like */
const FILE_NAME =
  /^(?:Models|Images|Documents)\/.+\.(?:sts|png|jpg|gif|svg|pdf)$|^\.project$/;

const latin1 = new TextDecoder('latin1');
const utf8 = new TextDecoder('utf-8');

/** The bytes of `[B`'s fresh class descriptor, after TC_CLASSDESC and its name. */
const BYTE_ARRAY_CLASS = [0x00, 0x02, 0x5b, 0x42];

/**
 * A Java-serialised file list (an `.exp`, gunzipped) as the project's
 * files; an error when it isn't one, or a file's content runs past the
 * stream's end (a truncated export).
 */
export const readSerializedProject = (
  data: Uint8Array,
): StsProject | { error: string } => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length < 4 || view.getUint16(0) !== MAGIC)
    return { error: 'Not a Java serialisation stream: not an STS-Tool export' };
  const files: Record<string, Uint8Array> = {};
  const at = (i: number, bytes: readonly number[]) =>
    bytes.every((byte, k) => data[i + k] === byte);
  for (let i = 4; i < data.length - 3; i++) {
    if (data[i] !== TC_STRING) continue;
    const length = view.getUint16(i + 1);
    if (length < 5 || length > 300 || i + 3 + length > data.length) continue;
    const name = latin1.decode(data.subarray(i + 3, i + 3 + length));
    if (!FILE_NAME.test(name)) continue;
    // the next byte array: a fresh `[B` descriptor or a back-reference to it
    let p = i + 3 + length;
    let content = -1;
    for (; p < data.length - 1; p++) {
      if (data[p] !== TC_ARRAY) continue;
      if (data[p + 1] === TC_CLASSDESC && at(p + 2, BYTE_ARRAY_CLASS)) {
        // `[B`, its serialVersionUID (8), flags (1), field count (2),
        // TC_ENDBLOCKDATA, TC_NULL
        content = p + 2 + BYTE_ARRAY_CLASS.length + 8 + 1 + 2 + 2;
        break;
      }
      if (data[p + 1] === TC_REFERENCE) {
        content = p + 2 + 4;
        break;
      }
    }
    if (content < 0 || content + 4 > data.length)
      return { error: `${name}: its content is missing (a truncated export?)` };
    const size = view.getInt32(content);
    if (size < 0 || content + 4 + size > data.length)
      return {
        error: `${name}: ${size} bytes, past the stream's end (a truncated export?)`,
      };
    files[name] = data.subarray(content + 4, content + 4 + size);
    i = content + 4 + size - 1;
  }
  const sts = Object.keys(files).find(
    (path) => path.startsWith('Models/') && path.endsWith('.sts'),
  );
  return { files, sts: sts ? utf8.decode(files[sts]) : null };
};

/** An `.exp` (gzip of a serialised file list) as the project's files and its `.sts`. */
export const readStsProject = async (
  bytes: Uint8Array,
): Promise<StsProject | { error: string }> => {
  let data: Uint8Array;
  try {
    const stream = new Blob([new Uint8Array(bytes)])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    data = new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (error) {
    return {
      error: `Not a gzip stream: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  return readSerializedProject(data);
};
