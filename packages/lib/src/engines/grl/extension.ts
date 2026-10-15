/**
 * The kinds GRL has and iStar 2.0 doesn't (goal-controller#28 item 8): the
 * indicator, an intentional element whose value comes from a measure, and
 * the belief, a rationale drawn beside the elements it is about. A GRL
 * model carries them in its `"metamodel"` block, which istar-ts reads,
 * draws and writes back (the importer writes it).
 */
import {
  defineExtension,
  extensionKind,
  extensionLink,
  type ExtensionElementDefinition,
} from '@goal-controller/dialect';

/** jUCMNav's indicator: a box with a pointed bottom (its icon's outline). */
const INDICATOR_SHAPE = 'M 4 2 L 96 2 L 96 32 L 50 48 L 4 32 Z';
/** jUCMNav's belief: an ellipse with a second one inside. */
const BELIEF_SHAPE =
  'M 2 25 A 48 23 0 1 0 98 25 A 48 23 0 1 0 2 25 Z M 8 25 A 42 18 0 1 0 92 25 A 42 18 0 1 0 8 25 Z';

export const grlExtension = defineExtension({
  name: 'grl',
  label: 'GRL',
  elements: [
    extensionKind('grl.Indicator', {
      label: 'Indicator',
      // refined, contributing and contributed to as a task is
      behavesLike: 'istar.Task',
      size: { width: 100, height: 50 },
      shape: INDICATOR_SHAPE,
      textBox: { top: 0.08, right: 0.06, bottom: 0.3, left: 0.06 },
    }),
    extensionKind('grl.Belief', {
      label: 'Belief',
      category: 'node',
      size: { width: 100, height: 50 },
      shape: BELIEF_SHAPE,
      textBox: { top: 0.2, right: 0.15, bottom: 0.2, left: 0.15 },
    }),
  ],
  links: [
    extensionLink('grl.BeliefLink', {
      label: 'Belief',
      // from a belief to any element, across actors
      rules: {
        sources: ['grl.Belief'],
        targets: ['node'],
        sameActor: false,
        unique: 'kind',
      },
      line: { dash: 'dotted' },
    }),
  ],
  groupers: {},
  stereotypes: [],
  taggedValues: [],
  defaultTags: [],
});

/** The kinds' file block (istar-ts's `"metamodel"`), shapes included. */
export const grlMetamodelBlock = () => ({
  name: grlExtension.name,
  elements: (
    grlExtension.elements as readonly ExtensionElementDefinition[]
  ).map(({ kind, label, category, behavesLike, size, shape, textBox }) => ({
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
  })),
  // a dotted line with no marker, as jUCMNav draws a belief link
  links: grlExtension.links.map(({ kind, label, rules }) => ({
    kind,
    label,
    rules,
    line: { dash: '2 3', marker: false },
  })),
});
