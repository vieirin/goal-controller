/**
 * TAOM4E's `.tropos` as Tropos4AS's native file (goal-controller#143,
 * #144 item 3): read by ./read, written by ./write, compared in a
 * canonical form, its schema the committed `TAOM4E-MM.ecore`.
 * Unverified against TAOM4E: no tool can re-read what it writes (#134).
 */
import type { NativeFileDefinition } from '@goal-controller/dialect';
import {
  readXml,
  writeXmlTree,
  type XmlElement,
  type XmlTree,
} from '@goal-controller/goal-language/formats';
import { readTaom4e } from './read';
import { EXTENSION, REFERENCE_FEATURES } from './vocabulary';
import { writeTaom4e } from './write';

/**
 * What a `.tropos` can't carry, as piStar paths: the display (colours;
 * the sizes it has are its diagram's, but a list of them isn't the
 * model's display) and the diagram's extent (the reader computes it from
 * the positions). What TAOM4E has no class for is kept in goal-controller's
 * extension, so it isn't lossy (./write).
 */
export const TAOM4E_LOSSY = ['display', 'diagram.width', 'diagram.height'];

const byName = (a: readonly [string, string], b: readonly [string, string]) =>
  a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;

/**
 * A `.tropos` as two are compared: what TAOM4E reads of it only (no
 * comments, no goal-controller extension), its `xmi:id`s renumbered in the
 * file's order (`_1`, `_2`, …) and every reference with them, attributes
 * by name, EMF's indents. The text as it was when it isn't XML.
 */
export const canonicalTaom4e = (text: string): string => {
  const { root, problems } = readXml(text);
  if (!root || problems.length) return text;
  const ids = new Map<string, string>();
  const number = (element: XmlElement) => {
    if (element.name === EXTENSION) return;
    const id = element.attributes['xmi:id'];
    if (id !== undefined && !ids.has(id)) ids.set(id, `_${ids.size + 1}`);
    element.children.forEach(number);
  };
  number(root);
  const renamed = (name: string, value: string) =>
    name === 'xmi:id'
      ? (ids.get(value) ?? value)
      : REFERENCE_FEATURES.has(name)
        ? value
            .split(/\s+/)
            .filter(Boolean)
            .map((id) => ids.get(id) ?? id)
            .join(' ')
        : value;
  const tree = (element: XmlElement): XmlTree => ({
    name: element.name,
    attributes: Object.entries(element.attributes)
      .map(([name, value]) => [name, renamed(name, value)] as const)
      .sort(byName),
    children: element.children
      .filter((child) => child.name !== EXTENSION)
      .map(tree),
    ...(element.text && { text: element.text }),
  });
  return writeXmlTree(tree(root));
};

export const taom4eNativeFile: NativeFileDefinition = {
  label: 'TAOM4E',
  extensions: ['.tropos'],
  format: 'xmi',
  schema: { kind: 'ecore', path: 'taom4e/reference/TAOM4E-MM.ecore' },
  read: (text, { modelName }) =>
    readTaom4e(text, { modelName, fileName: `${modelName}.tropos` }),
  write: (model) => writeTaom4e(model),
  canonical: canonicalTaom4e,
  lossy: TAOM4E_LOSSY,
};
