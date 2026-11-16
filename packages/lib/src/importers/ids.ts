/**
 * The piStar ids an importer gives what it reads (goal-controller#518,
 * #390): UUIDs, as any model's, so a notation line that writes no id shows
 * the first 8 characters of one (`goal 7857cb00: …`). They are name-based
 * (RFC 9562's version 5: SHA-1 of a name in a namespace), the name the
 * tool's and the element's own identifier, so reading a file twice gives
 * the same model, whatever the model is called (a native file read back
 * under another model name keeps its ids). The tool's identifier stays in
 * the model where its writer needs it (`.kaos`'s, ./kaos/read.ts'
 * `KAOS_ID_KEY`).
 */

/** UUIDs' first characters, which a notation line shows for an id it doesn't write. */
const SHOWN = 8;

/** goal-controller's namespace for imported ids (a version 4 UUID, fixed). */
const NAMESPACE = '0f1e5c7a-5b0d-4c39-9d5e-2a6b8c4f3e71';

const bytesOfUuid = (uuid: string) =>
  Uint8Array.from(uuid.replace(/-/g, '').match(/../g)!, (h) => parseInt(h, 16));

/** SHA-1 (FIPS 180-4) of some bytes: in the browser too, and synchronous. */
const sha1 = (message: Uint8Array): Uint8Array => {
  const length = message.length;
  const padded = new Uint8Array((((length + 8) >> 6) + 1) << 6);
  padded.set(message);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(length / 0x20000000));
  view.setUint32(padded.length - 4, (length << 3) >>> 0);
  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Uint32Array(80);
  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  for (let block = 0; block < padded.length; block += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(block + i * 4);
    for (let i = 16; i < 80; i++)
      w[i] = rotl(w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!, 1);
    let [a, b, c, d, e] = h as [number, number, number, number, number];
    for (let i = 0; i < 80; i++) {
      const [f, k] =
        i < 20
          ? [(b & c) | (~b & d), 0x5a827999]
          : i < 40
            ? [b ^ c ^ d, 0x6ed9eba1]
            : i < 60
              ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc]
              : [b ^ c ^ d, 0xca62c1d6];
      const t = (rotl(a, 5) + f + e + k + w[i]!) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30) >>> 0;
      b = a;
      a = t;
    }
    h[0] = (h[0]! + a) >>> 0;
    h[1] = (h[1]! + b) >>> 0;
    h[2] = (h[2]! + c) >>> 0;
    h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0;
  }
  const digest = new Uint8Array(20);
  const out = new DataView(digest.buffer);
  h.forEach((word, i) => out.setUint32(i * 4, word));
  return digest;
};

/** A name's version 5 UUID in a namespace (RFC 9562 §5.5). */
export const nameUuid = (name: string, namespace = NAMESPACE): string => {
  const text = new TextEncoder().encode(name);
  const ns = bytesOfUuid(namespace);
  const message = new Uint8Array(ns.length + text.length);
  message.set(ns);
  message.set(text, ns.length);
  const bytes = sha1(message).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Whether a text is a UUID (any version), as piStar ids are. */
export const isUuid = (text: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);

/**
 * The ids of one read of a tool's file: each of what it reads (`what`:
 * `element`, `link`, …) by its identifier there, the same id for the same,
 * and no two whose first 8 characters are the same (the later one's name
 * takes a counter, the same on every read of the same file).
 */
export const importedIds = (tool: string) => {
  const ids = new Map<string, string>();
  const shown = new Set<string>();
  return (what: string, identifier: string): string => {
    const name = [tool, what, identifier].join('\u0000');
    const known = ids.get(name);
    if (known !== undefined) return known;
    let id = nameUuid(name);
    for (let n = 2; shown.has(id.slice(0, SHOWN)); n++)
      id = nameUuid(`${name}\u0000${n}`);
    shown.add(id.slice(0, SHOWN));
    ids.set(name, id);
    return id;
  };
};
