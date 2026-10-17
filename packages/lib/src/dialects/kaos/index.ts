/**
 * KAOS goal models as DSM3-goals defines them (J. Pimentel,
 * https://www.cin.ufpe.br/~jhcp/dsm3goals/; istar-ts's `@istar-ts/dsm3-kaos`):
 * a modelling dialect of the `kaos` framework (no engine reads it yet). Its
 * kinds are the KAOS root metamodel's, every node on the paper (KAOS has no
 * actors). Goals carry DSM3's eight properties, a refinement its three (on
 * its hub, where DSM3 saves them) and a conflict its boundary condition, as
 * istar-ts's schemas declare them; all are free text, as DSM3 has them
 * (goal-controller#171, decisions in packages/dialect/docs/frameworks.md).
 *
 * In the Notation view goals are `G`, agents `A` and domain properties `DP`;
 * there is no bracket notation (a KAOS goal's name keeps its brackets,
 * `Achieve [Manual Backup]`). A refinement, drawn as a hub joining several
 * sub-goals, is an AND: the sub-goals are listed under the goal they refine.
 */
import {
  KAOS_REFINEMENT_HUB,
  behavioralGoalProperties,
  conflictProperties,
  refinementProperties,
  type KaosConflictProperties,
  type KaosDeclaredElementKind,
  type KaosGoalProperties,
  type KaosRefinementProperties,
} from '@istar-ts/dsm3-kaos/metamodel';
import {
  defineDialect,
  element,
  links,
  property,
  type ElementDefinition,
  type PropertyDefinition,
} from '@goal-controller/dialect';

/** DSM3's fill for every KAOS node (`rgb(205,205,205)`, language_kaos_shapes.js). */
const FILL = '#CDCDCD';

/**
 * A schema's keys, in its order, each a free-text property with its help:
 * a key the schema gains and this dialect doesn't explain doesn't compile.
 */
const textProperties = <S extends object>(
  shape: S,
  help: { readonly [K in keyof S]: string },
): PropertyDefinition[] =>
  (Object.keys(shape) as (keyof S & string)[]).map((key) =>
    property.text(key, { help: help[key] }),
  );

/** what piStar gives every element (DSM3 too): a description */
const DESCRIPTION = property.text('Description', {
  help: 'what it is, in words',
});

/**
 * DSM3's eight goal properties (language_kaos_metamodel.js), in its order.
 * Neither DSM3 nor the KAOS literature fixes a vocabulary for any of them
 * (van Lamsweerde's goal attributes are free annotations), so none is an enum.
 */
const GOAL = [
  ...textProperties<KaosGoalProperties>(behavioralGoalProperties.shape, {
    Type: 'its type: a behavioural goal’s pattern (Achieve, Maintain, Avoid, …), or softgoal',
    Category:
      'its category (functional, or a quality: safety, security, performance, …)',
    Source: 'where it comes from: a document, a stakeholder',
    Priority: 'how much it matters, against the others',
    Issue: 'what is still open about it',
    FormalSpec:
      'its formal specification (KAOS writes it in real-time temporal logic)',
    FitCriterion: 'how to tell it is satisfied: a measurable criterion',
    Stability: 'how likely it is to change',
  }),
  DESCRIPTION,
];

/** a refinement's, on its hub (no line: the inspector edits them) */
const REFINEMENT = textProperties<KaosRefinementProperties>(
  refinementProperties.shape,
  {
    SysRef: 'the system (version) the refinement is for',
    Status: 'where the refinement stands',
    Tactic: 'the refinement tactic it applies (by cases, by milestones, …)',
  },
);

const CONFLICT = textProperties<KaosConflictProperties>(
  conflictProperties.shape,
  {
    BoundaryCondition:
      'the condition under which the two can’t both be satisfied',
  },
);

/** Every KAOS node kind, with its prefix: goals G, agents A, domain properties DP. */
const ELEMENTS = {
  'kaos.BehavioralGoal': element('G', { fill: FILL }),
  'kaos.Softgoal': element('G', { fill: FILL }),
  'kaos.Agent': element('A', { fill: FILL }),
  'kaos.EnvironmentAgent': element('A', { fill: FILL }),
  'kaos.DomainProperty': element('DP', { fill: FILL }),
} as const satisfies Record<KaosDeclaredElementKind, ElementDefinition>;

export const kaos = defineDialect({
  id: 'kaos',
  name: 'KAOS',
  framework: 'kaos',
  elements: ELEMENTS,
  defaultFill: FILL,
  properties: {
    'kaos.BehavioralGoal': GOAL,
    'kaos.Softgoal': GOAL,
    'kaos.Agent': [DESCRIPTION],
    'kaos.EnvironmentAgent': [DESCRIPTION],
    'kaos.DomainProperty': [DESCRIPTION],
    [KAOS_REFINEMENT_HUB]: REFINEMENT,
  },
  propertyLineOrder: GOAL.map((p) => p.key),
  indent: '  ',
  refinements: { 'kaos.RefinementLink': 'and' },
  links: links({ 'kaos.Conflict': CONFLICT }),
  model: { actors: 'many', treesPerActor: 'many' },
  problems: {
    notAChild: { severity: 'error', message: 'Not a child of this element' },
    missingFromNotation: {
      severity: 'warning',
      message: 'Missing from the refinement',
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
