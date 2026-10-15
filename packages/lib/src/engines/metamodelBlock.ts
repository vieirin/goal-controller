/**
 * An extension's kinds as a model file declares them: istar-ts's
 * `"metamodel"` block, shapes included, which istar-ts reads, draws and
 * writes back (the engines whose models declare their kinds: GRL, iStar-DT,
 * Tropos4AS).
 */
import type {
  ExtensionDefinition,
  ExtensionElementDefinition,
  ExtensionLinkDefinition,
} from '@goal-controller/dialect';

/** How a link is drawn in the block: its dash (SVG's) and whether it has a marker. */
export type MetamodelLine = { dash?: string; marker?: false };

/** The SVG dash of each of the definition's dashes. */
export const DASH = {
  continuous: undefined,
  dashed: '6 4',
  dotted: '2 3',
} as const;

/** The block, each link drawn as `line` says. */
export const metamodelBlock = (
  extension: ExtensionDefinition,
  line: (link: ExtensionLinkDefinition) => MetamodelLine,
) => ({
  name: extension.name,
  elements: (extension.elements as readonly ExtensionElementDefinition[]).map(
    ({ kind, label, category, behavesLike, size, shape, textBox }) => ({
      kind,
      label,
      ...(category && { category }),
      ...(behavesLike && { behavesLike }),
      ...(size && { size }),
      ...(shape &&
        size && {
          shape: { path: shape, viewBox: `0 0 ${size.width} ${size.height}` },
        }),
      ...(textBox && { textBox }),
    }),
  ),
  links: extension.links.map((link) => ({
    kind: link.kind,
    label: link.label,
    rules: link.rules,
    line: line(link),
  })),
});
