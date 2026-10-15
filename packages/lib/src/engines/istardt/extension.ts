/**
 * The kinds iStar-DT has and iStar 2.0 doesn't (ER 2024 §3; mx2dtx's
 * `iStarDT-V.xml` shape library): the effect a task may have and the group
 * of a task's effects, the condition box, the domain predicate and the
 * variable, and the links between them
 * (goal-controller#117 D1–D3). A model carries them in its `"metamodel"`
 * block, which istar-ts reads, draws and writes back (the importer writes
 * it).
 */
import {
  defineExtension,
  type ExtensionElementDefinition,
} from '@goal-controller/dialect';
import { ISTARDT_KINDS, ISTARDT_LINKS } from './vocabulary';

/**
 * The shapes of iStarDT-V (mx2dtx's shape library, ER 2024's legend): an
 * effect and a condition are ellipses, an effect group a small hub with a
 * cross, a state variable a cloud in a box (a quality is iStar's cloud). A
 * predicate, which iStarDT-V draws as its effect, is a small rounded label.
 */
const ellipse = (w: number, h: number) =>
  `M 2 ${h / 2} A ${w / 2 - 2} ${h / 2 - 2} 0 1 0 ${w - 2} ${h / 2} A ${w / 2 - 2} ${h / 2 - 2} 0 1 0 2 ${h / 2} Z`;
/** An effect: an ellipse. */
const EFFECT_SHAPE = ellipse(90, 40);
/** An effect group: a hub, a cross in it. */
const EFFECT_GROUP_SHAPE =
  'M 2 10 A 8 8 0 1 0 18 10 A 8 8 0 1 0 2 10 Z M 10 2 L 10 18 M 2 10 L 18 10';
/** A condition (iStarDT-V's precondition): an ellipse. */
const CONDITION_SHAPE = ellipse(100, 44);
/** A predicate: a small label with rounded ends. */
const PREDICATE_SHAPE =
  'M 16 4 L 74 4 A 16 16 0 0 1 74 36 L 16 36 A 16 16 0 0 1 16 4 Z';
/** A cloud, iStar's quality outline, inside `[x, y, w, h]`. */
const cloud = (x: number, y: number, w: number, h: number) => {
  const p = (px: number, py: number) =>
    `${(x + px * w).toFixed(1)} ${(y + py * h).toFixed(1)}`;
  const r = (k: number) => (k * Math.min(w, h)).toFixed(1);
  return [
    `M ${p(0.2, 0.85)}`,
    `A ${r(0.2)} ${r(0.2)} 0 0 1 ${p(0.12, 0.45)}`,
    `A ${r(0.28)} ${r(0.28)} 0 0 1 ${p(0.42, 0.15)}`,
    `A ${r(0.28)} ${r(0.28)} 0 0 1 ${p(0.78, 0.2)}`,
    `A ${r(0.22)} ${r(0.22)} 0 0 1 ${p(0.9, 0.62)}`,
    `A ${r(0.2)} ${r(0.2)} 0 0 1 ${p(0.72, 0.9)}`,
    `A ${r(0.3)} ${r(0.3)} 0 0 1 ${p(0.2, 0.85)} Z`,
  ].join(' ');
};
/** A state variable: a cloud in a box. */
const VARIABLE_SHAPE = `M 2 2 L 98 2 L 98 58 L 2 58 Z ${cloud(10, 8, 80, 44)}`;

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
      textBox: { top: 0.15, right: 0.14, bottom: 0.15, left: 0.14 },
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
      size: { width: 100, height: 44 },
      shape: CONDITION_SHAPE,
      textBox: { top: 0.15, right: 0.14, bottom: 0.15, left: 0.14 },
    },
    {
      kind: ISTARDT_KINDS.predicate,
      label: 'Predicate',
      category: 'node',
      size: { width: 90, height: 40 },
      shape: PREDICATE_SHAPE,
      textBox: { top: 0.12, right: 0.12, bottom: 0.12, left: 0.12 },
    },
    {
      kind: ISTARDT_KINDS.variable,
      label: 'Variable',
      category: 'node',
      size: { width: 100, height: 60 },
      shape: VARIABLE_SHAPE,
      textBox: { top: 0.25, right: 0.2, bottom: 0.2, left: 0.2 },
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
      line: { dash: 'continuous' },
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
      line: { dash: 'dotted' },
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
      line: { dash: 'dashed' },
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
