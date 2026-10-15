/**
 * Contextual goal models (Ali, Dalpiaz, Giorgini; DISI Trento, 2008–2014;
 * REJ 2010, IST 2013): Tropos models (iStar 2.0's goals, tasks, softgoals
 * as qualities, resources; AND/OR refinement, means-end as a task's OR
 * refinement, contribution, dependency) whose variation points carry
 * contexts (REJ 2010 Table 1, goal-controller#151, #153):
 *
 * 1. a root goal's `activation`;
 * 2–5. a `context` on an OR refinement (means-end too), a dependency (the
 *    depender's link) and an AND refinement (the child is needed iff it
 *    holds);
 * 6. a `context` on a contribution, when its label applies, and an
 *    `opposite`, when the opposite label does (#151 D10: iStar 2.0 allows
 *    one contribution link per pair).
 *
 * A context is an element, `C4: …`, with a formula over statements and
 * facts (context analysis, §3.4); a variation point's context is an
 * assertion over contexts (`C7 & !C8`). Tasks have development costs, and Fig. 13's cost relations are
 * links between tasks (#151 D11). Situations and logical relations are
 * project resources: nothing of them is in the model (#151 D2).
 *
 * - Ids (#151 D9): goals `G1`, tasks `T1`, contexts `C1`, statements
 *   `ST1`, facts `F1`, the papers' labels; softgoals `SG1` in their text
 *   only (iStar's quality takes the catalog's prefixes, so it has no line).
 * - No notation: a decomposition is its refinement links.
 */
import {
  defineDialect,
  element,
  links,
  property,
} from '@goal-controller/dialect';
import type { CgmCheckName } from './checks';
import { cgmExtension } from './extension';
import { CGM_KEYS, CGM_KINDS, CGM_LINKS } from './vocabulary';

const { assertion, int, text } = property.for<CgmCheckName>();

/** the istar-ts canvas's fill, as piStar */
const DEFAULT_FILL = '#CDFECD';

/** a variation point's context: a formula over the model's contexts */
const CONTEXT = { resolves: [CGM_KINDS.context] } as const;
/** context analysis's formulas: over statements and facts */
const WORLD_PREDICATES = {
  resolves: [CGM_KINDS.statement, CGM_KINDS.fact],
} as const;

const linkContext = (help: string) =>
  assertion(CGM_KEYS.context, { ...CONTEXT, help });

export const cgm = defineDialect({
  id: 'cgm',
  name: 'Contextual goal model',
  // contexts, statements and facts; the cost relations (./extension)
  extension: cgmExtension,
  elements: {
    goal: element('G', { fill: DEFAULT_FILL }),
    task: element('T', { fill: DEFAULT_FILL }),
    // the figures' grey label box; Fig. 4's statement and fact
    [CGM_KINDS.context]: element('C', { fill: '#E6E6E6' }),
    [CGM_KINDS.statement]: element('ST', { fill: '#D9D9D9' }),
    [CGM_KINDS.fact]: element('F', { fill: '#FFFFFF' }),
  },
  defaultFill: DEFAULT_FILL,
  notation: {
    operand: { kinds: ['goal', 'task'] },
    operators: {},
    constructs: {
      and: {
        label: 'And',
        help: 'every child, each one needed only where its context holds (REJ 2010 Table 1)',
        relation: 'and',
      },
      or: {
        label: 'Or',
        help: 'one child, adoptable where its context holds (REJ 2010 Table 1)',
        relation: 'or',
      },
    },
    defaultConstruct: { and: 'and', or: 'or' },
    // the papers' names are free text (`[v] gets info via his/her PDA`)
    names: 'text',
  },
  properties: {
    goal: [
      assertion(CGM_KEYS.activation, {
        ...CONTEXT,
        help: 'the context it is activated in: root goals only (REJ 2010 Table 1, root goal activation)',
        check: 'cgm.goal.activation',
      }),
    ],
    task: [
      int(CGM_KEYS.cost, {
        min: 0,
        help: 'what developing it costs (REJ 2010 §5.3, Fig. 13); what it shares with other tasks is their cost relations',
      }),
    ],
    resource: [],
    quality: [],
    [CGM_KINDS.context]: [
      assertion(CGM_KEYS.formula, {
        ...WORLD_PREDICATES,
        help: 'what it is, over statements and facts (REJ 2010 §3.4, Code 1); none: a context of its own, given by a situation',
        check: 'cgm.context.monitorable',
      }),
      text('description', {
        help: 'the paper’s sentence for it (REJ 2010 §3.3, IST 2013 Table 2)',
      }),
    ],
    [CGM_KINDS.statement]: [
      assertion(CGM_KEYS.supportedBy, {
        ...WORLD_PREDICATES,
        required: 'always',
        help: 'the formula of statements and facts that supports it (Def. 5): monitorable only if it reaches facts (Def. 6)',
        check: 'cgm.statement.supported',
      }),
    ],
    [CGM_KINDS.fact]: [
      text('technology', {
        help: 'how the actor verifies it (IST 2013 Table 2’s technology)',
      }),
    ],
  },
  propertyLineOrder: [
    CGM_KEYS.activation,
    CGM_KEYS.cost,
    CGM_KEYS.formula,
    'description',
    CGM_KEYS.supportedBy,
    'technology',
  ],
  indent: '  ',
  // the variation points' contexts, on links: written as link lines under
  // the source (`link G2 {context = C5}`)
  links: links({
    'istar.AndRefinementLink': [
      linkContext(
        'when the parent needs this child (REJ 2010 Table 1, AND-decomposition): otherwise it is dropped',
      ),
    ],
    'istar.OrRefinementLink': [
      linkContext(
        'when this alternative, or this means to its goal, is adoptable (REJ 2010 Table 1, OR-decomposition and means-end)',
      ),
    ],
    'istar.DependencyLink': [
      linkContext(
        'on the depender’s link: when the actor may delegate to the dependee (REJ 2010 Table 1, actor dependency)',
      ),
    ],
    'istar.ContributionLink': [
      linkContext(
        'when its label applies (REJ 2010 Table 1: contributes positively iff Ci); none, always',
      ),
      assertion(CGM_KEYS.opposite, {
        ...CONTEXT,
        help: 'when the opposite label applies (make↔break, help↔hurt; Table 1: negatively iff Cj, #151 D10)',
        check: 'cgm.contribution.opposite',
      }),
    ],
    [CGM_LINKS.includes]: [],
    [CGM_LINKS.intersects]: [
      int(CGM_KEYS.amount, {
        min: 1,
        required: 'always',
        help: 'the cost the two tasks share (Fig. 13’s Intersect(T3, T4, 40)): developing both costs that much less',
      }),
    ],
  }),
  // a root per actor, the dependee's tree followed (REJ 2010 Fig. 2)
  model: { actors: 'many', treesPerActor: 'many' },
  projectResources: {
    situations: {
      label: 'Situations',
      format: 'json',
      many: true,
      role: 'scenarios',
      path: 'situations/',
      accept: ['.json'],
      help: 'one file per situation: the contexts that hold (or the facts), and the softgoals’ priorities (REJ 2010 §4, Code 3)',
    },
    relations: {
      label: 'Logical relations',
      format: 'json',
      many: true,
      path: 'relations/',
      accept: ['.json'],
      help: 'the analyst’s logical relations between contexts, statements and facts: absolute, and per operational environment (REJ 2010 §5.1)',
    },
  },
  problems: {
    notAChild: { severity: 'error', message: 'Not a child of this element' },
    missingFromNotation: {
      severity: 'warning',
      message: 'Missing from the decomposition',
    },
    relationMismatch: {
      severity: 'error',
      message:
        '{construct} needs {needs} refinement links, but this element is refined with {relation} links',
    },
    notInDiagram: {
      severity: 'error',
      message: 'Add this element in the diagram',
    },
  },
});
