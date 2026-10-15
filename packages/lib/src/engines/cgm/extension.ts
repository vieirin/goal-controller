/**
 * The kinds contextual goal models have and iStar 2.0 doesn't
 * (goal-controller#151 D2, D11): context analysis's contexts, statements
 * and facts (REJ 2010 Fig. 4 draws statements as shadowed rectangles and
 * facts as parallelograms), and Fig. 13's cost relations between tasks. A
 * model carries them in its `"metamodel"` block, which istar-ts reads,
 * draws and writes back.
 */
import {
  defineExtension,
  extensionKind,
  extensionLink,
} from '@goal-controller/dialect';
import { DASH, metamodelBlock } from '../metamodelBlock';
import { CGM_KINDS, CGM_LINKS } from './vocabulary';

/** A context: the figures' label box, small and square-cornered. */
const CONTEXT_SHAPE = 'M 2 2 L 78 2 L 78 34 L 2 34 Z';
/** A statement: a rectangle with its shadow (Fig. 4). */
const STATEMENT_SHAPE =
  'M 2 2 L 92 2 L 92 38 L 2 38 Z M 92 8 L 98 8 L 98 44 L 8 44 L 8 38';
/** A fact: a parallelogram (Fig. 4). */
const FACT_SHAPE = 'M 14 2 L 98 2 L 86 38 L 2 38 Z';

/** the tasks a cost relation joins, across actors (Fig. 13's T4–T9) */
const COST_RULES = {
  sources: ['istar.Task'],
  targets: ['istar.Task'],
  unique: 'kind',
  sameActor: false,
} as const;

export const cgmExtension = defineExtension({
  name: 'cgm',
  label: 'Contextual goal models',
  elements: [
    extensionKind(CGM_KINDS.context, {
      label: 'Context',
      category: 'node',
      size: { width: 80, height: 36 },
      shape: CONTEXT_SHAPE,
      textBox: { top: 0.1, right: 0.06, bottom: 0.1, left: 0.06 },
    }),
    extensionKind(CGM_KINDS.statement, {
      label: 'Statement',
      category: 'node',
      size: { width: 100, height: 46 },
      shape: STATEMENT_SHAPE,
      textBox: { top: 0.08, right: 0.12, bottom: 0.2, left: 0.06 },
    }),
    extensionKind(CGM_KINDS.fact, {
      label: 'Fact',
      category: 'node',
      size: { width: 100, height: 40 },
      shape: FACT_SHAPE,
      textBox: { top: 0.1, right: 0.16, bottom: 0.1, left: 0.16 },
    }),
  ],
  links: [
    extensionLink(CGM_LINKS.includes, {
      label: 'includes',
      rules: COST_RULES,
      line: { dash: 'dotted' },
    }),
    extensionLink(CGM_LINKS.intersects, {
      label: 'intersects',
      rules: COST_RULES,
      line: { dash: 'dotted' },
    }),
  ],
  groupers: {},
  stereotypes: [],
  taggedValues: [],
  defaultTags: [],
});

/** The kinds' file block (istar-ts's `"metamodel"`), shapes included. */
export const cgmMetamodelBlock = () =>
  metamodelBlock(cgmExtension, ({ line }) => {
    const dash = line && DASH[line.dash];
    return { ...(dash && { dash }) };
  });
