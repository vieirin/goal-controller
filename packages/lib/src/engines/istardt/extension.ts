/**
 * The kinds iStar-DT has and iStar 2.0 doesn't (ER 2024 §3; mx2dtx's
 * `iStarDT-V.xml` shape library): the effect a task may have and the group
 * of a task's effects, the condition box, the domain predicate and the variable, and the links between them
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
/** An effect group: the hub its effects hang from. */
const EFFECT_GROUP_SHAPE = 'M 2 10 A 8 8 0 1 0 18 10 A 8 8 0 1 0 2 10 Z';
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
      kind: ISTARDT_KINDS.effectGroup,
      label: 'Effect group',
      category: 'node',
      size: { width: 20, height: 20 },
      shape: EFFECT_GROUP_SHAPE,
      textBox: { top: 0, right: 0, bottom: 0, left: 0 },
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
      label: 'eff',
      // a task to its effect group (one each)
      rules: {
        sources: ['istar.Task'],
        targets: [ISTARDT_KINDS.effectGroup],
        unique: 'any',
      },
      line: { dash: 'continuous' },
    },
    {
      kind: ISTARDT_LINKS.effectGroup,
      label: 'Effect group',
      // the group to each of its effects, labelled with its probability
      rules: {
        sources: [ISTARDT_KINDS.effectGroup],
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
      // a term of a quality's weighted sum: an effect's or a quality's weight
      rules: {
        sources: [ISTARDT_KINDS.effect, 'istar.Quality'],
        targets: ['istar.Quality'],
        unique: 'kind',
      },
      line: { dash: 'dotted' },
    },
    {
      kind: ISTARDT_LINKS.turnsTrue,
      label: 'turns true',
      rules: {
        sources: [ISTARDT_KINDS.effect],
        targets: [ISTARDT_KINDS.predicate],
        unique: 'any',
      },
      line: { dash: 'continuous' },
    },
    {
      kind: ISTARDT_LINKS.reads,
      label: 'reads',
      // what a formula names, to the quality or condition it is of
      rules: {
        sources: [
          'istar.Goal',
          'istar.Task',
          'istar.Quality',
          ISTARDT_KINDS.effect,
          ISTARDT_KINDS.condition,
          ISTARDT_KINDS.predicate,
          ISTARDT_KINDS.variable,
        ],
        targets: ['istar.Quality', ISTARDT_KINDS.condition],
        allowSelf: true,
        unique: 'kind',
      },
      line: { dash: 'continuous' },
    },
    {
      kind: ISTARDT_LINKS.readsPrevious,
      label: 'PRE',
      // the same, read as its previous value: the element itself, too
      rules: {
        sources: [
          'istar.Goal',
          'istar.Task',
          'istar.Quality',
          ISTARDT_KINDS.effect,
          ISTARDT_KINDS.condition,
          ISTARDT_KINDS.predicate,
          ISTARDT_KINDS.variable,
        ],
        targets: ['istar.Quality', ISTARDT_KINDS.condition],
        allowSelf: true,
        unique: 'kind',
      },
      line: { dash: 'dotted' },
    },
    {
      kind: ISTARDT_LINKS.turnsFalse,
      label: 'turns false',
      rules: {
        sources: [ISTARDT_KINDS.effect],
        targets: [ISTARDT_KINDS.predicate],
        unique: 'any',
      },
      line: { dash: 'dashed' },
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
      // an effect group's links have no arrowhead, as iStarDT-V draws them
      line: {
        ...(dash && { dash }),
        ...(kind === ISTARDT_LINKS.effectGroup && { marker: false }),
      },
    };
  }),
});
