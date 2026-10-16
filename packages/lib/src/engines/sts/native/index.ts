/**
 * STS-Tool's `.sts` as the `sts` dialect's native file (goal-controller
 * #163 item 4, #160 D-R9): read by ./read, written by ./write, compared in
 * EMF's canonical form. An `.exp` (a project export: gzip of a
 * Java-serialised list of files) isn't one, a native file being text:
 * ./project reads it to its files and its `.sts` (#160 D-R8).
 * Unverified against STS-Tool (#160 D-R2).
 */
import type { NativeFileDefinition } from '@goal-controller/dialect';
import { canonicalXml } from '@goal-controller/goal-language/formats';
import { readSts } from './read';
import { writeSts } from './write';

/**
 * What a `.sts` can't carry, as piStar paths: the display, the diagram's
 * extent (the reader computes it), and the positions of what is outside
 * actors (information is drawn in the information view, another layout:
 * the reader lays it out), and a seed's `source` (the figure it is drawn
 * from), which the file's header has no place for.
 */
export const STS_LOSSY = [
  'display',
  'diagram.width',
  'diagram.height',
  'orphans.*.x',
  'orphans.*.y',
  'diagram.customProperties.source',
];

/** A `.sts` as two are compared: EMF's indents, attributes in the tool's order, then by name. */
export const canonicalSts = (text: string): string =>
  canonicalXml(text, { order: ['xsi:type', 'id', 'name'] });

export const stsNativeFile: NativeFileDefinition = {
  label: 'STS-Tool',
  extensions: ['.sts'],
  format: 'xmi',
  read: (text, { modelName }) =>
    readSts(text, { modelName, fileName: `${modelName}.sts` }),
  write: (model) => writeSts(model),
  canonical: canonicalSts,
  lossy: STS_LOSSY,
};

export { readSts, type StsContext } from './read';
export { writeSts } from './write';
export {
  readSerializedProject,
  readStsProject,
  type StsProject,
} from './project';
