/**
 * The kinds iStar-DT has and iStar 2.0 doesn't (ER 2024 §3; mx2dtx's
 * `iStarDT-V.xml` shape library): the effect a task may have, the condition
 * box, the domain predicate and the variable, and the links between them
 * (goal-controller#117 D1–D3). A model carries them in its `"metamodel"`
 * block, which istar-ts reads, draws and writes back (the importer writes
 * it).
 */
import {
  defineExtension,
  type ExtensionElementDefinition,
} from '@goal-controller/dialect';
import { ISTARDT_KINDS, ISTARDT_LINKS } from './vocabulary';

/** An effect: a small box with rounded corners. */
const EFFECT_SHAPE =
  'M 10 2 L 80 2 A 8 8 0 0 1 88 10 L 88 30 A 8 8 0 0 1 80 38 L 10 38 A 8 8 0 0 1 2 30 L 2 10 A 8 8 0 0 1 10 2 Z';
/** A condition box: a note, its top right corner folded. */
const CONDITION_SHAPE =
  'M 2 2 L 84 2 L 98 16 L 98 48 L 2 48 Z M 84 2 L 84 16 L 98 16';
/** A predicate: a hexagon. */
const PREDICATE_SHAPE = 'M 12 2 L 78 2 L 88 20 L 78 38 L 12 38 L 2 20 Z';
/** A variable: a hexagon with a bar across its top. */
const VARIABLE_SHAPE =
  'M 12 2 L 78 2 L 88 20 L 78 38 L 12 38 L 2 20 Z M 7 11 L 83 11';

export const istardtExtension = defineExtension({
  name: 'istardt',
  label: 'iStar-DT',
  elements: [
    {
      kind: ISTARDT_KINDS.effect,
      label: 'Effect',
      category: 'node',
      size: { width: 90, height: 40 },
      shape: EFFECT_SHAPE,
      textBox: { top: 0.1, right: 0.08, bottom: 0.1, left: 0.08 },
    },
    {
      kind: ISTARDT_KINDS.condition,
      label: 'Condition',
      category: 'node',
      size: { width: 100, height: 50 },
      shape: CONDITION_SHAPE,
      textBox: { top: 0.3, right: 0.1, bottom: 0.1, left: 0.06 },
    },
    {
      kind: ISTARDT_KINDS.predicate,
      label: 'Predicate',
      category: 'node',
      size: { width: 90, height: 40 },
      shape: PREDICATE_SHAPE,
      textBox: { top: 0.1, right: 0.14, bottom: 0.1, left: 0.14 },
    },
    {
      kind: ISTARDT_KINDS.variable,
      label: 'Variable',
      category: 'node',
      size: { width: 90, height: 40 },
      shape: VARIABLE_SHAPE,
      textBox: { top: 0.3, right: 0.14, bottom: 0.05, left: 0.14 },
    },
  ],
  links: [
    {
      kind: ISTARDT_LINKS.effect,
      label: 'Effect',
      // a task's effect group: one task per effect
      rules: {
        sources: ['istar.Task'],
        targets: [ISTARDT_KINDS.effect],
        unique: 'any',
      },
      line: { dash: 'continuous' },
    },
    {
      kind: ISTARDT_LINKS.precedence,
      label: 'pre',
      rules: {
        sources: ['istar.Goal', 'istar.Task', ISTARDT_KINDS.condition],
        targets: ['istar.Goal', 'istar.Task', ISTARDT_KINDS.effect],
        unique: 'kind',
      },
      line: { dash: 'dashed' },
    },
    {
      kind: ISTARDT_LINKS.negativePrecedence,
      label: 'npr',
      rules: {
        sources: ['istar.Goal', 'istar.Task', ISTARDT_KINDS.condition],
        targets: ['istar.Goal', 'istar.Task', ISTARDT_KINDS.effect],
        unique: 'kind',
      },
      line: { dash: 'dotted' },
    },
    {
      kind: ISTARDT_LINKS.utility,
      label: 'Utility',
      // an effect's weight on a quality: a contribution with a number
      rules: {
        sources: [ISTARDT_KINDS.effect],
        targets: ['istar.Quality'],
        unique: 'kind',
      },
      line: { dash: 'continuous' },
    },
  ],
  groupers: {},
  stereotypes: [],
  taggedValues: [],
  defaultTags: [],
});

const DASH = { continuous: undefined, dashed: '6 4', dotted: '2 3' } as const;

/** The kinds' file block (istar-ts's `"metamodel"`), shapes included. */
export const istardtMetamodelBlock = () => ({
  name: istardtExtension.name,
  elements: (
    istardtExtension.elements as readonly ExtensionElementDefinition[]
  ).map(({ kind, label, category, size, shape, textBox }) => ({
    kind,
    label,
    ...(category && { category }),
    ...(size && { size }),
    ...(shape &&
      size && {
        shape: { path: shape, viewBox: `0 0 ${size.width} ${size.height}` },
      }),
    ...(textBox && { textBox }),
  })),
  links: istardtExtension.links.map(({ kind, label, rules, line }) => {
    const dash = DASH[line.dash];
    return {
      kind,
      label,
      rules,
      // an effect link and a utility link have no arrowhead, as iStarDT-V
      line: {
        ...(dash && { dash }),
        ...((kind === ISTARDT_LINKS.effect ||
          kind === ISTARDT_LINKS.utility) && { marker: false }),
      },
    };
  }),
});
