/**
 * GRL, the Goal-oriented Requirement Language of URN (ITU-T Z.151), as
 * jUCMNav (JUCMNAV/jUCMNavPlus) models and evaluates it: iStar's four
 * intentional elements (a softgoal is a quality, a resource jUCMNav's
 * `Ressource`), with the indicator and the belief as GRL's own kinds (the
 * `grl` extension); the importance of elements and actors; GRL's seven
 * contribution types and their quantitative weight on contribution links;
 * and the strategies a model is evaluated under, as a project resource.
 * GRL has no notation: a decomposition is its refinement links (a Xor one is
 * an element property, #105 D6), and its ids are jUCMNav's, without
 * prefixes.
 */
import {
  defineDialect,
  type PropertyDefinition,
} from '@goal-controller/dialect';
import type { GrlCheckName } from './checks';
import {
  GRL_CONTRIBUTIONS,
  GRL_DECOMPOSITIONS,
  GRL_IMPORTANCES,
} from './vocabulary';

type GrlProperty = PropertyDefinition<GrlCheckName>;

/** the istar-ts canvas's fill, as piStar */
const DEFAULT_FILL = '#CDFECD';

const options = (values: readonly string[]) =>
  values.map((value) => ({ value, label: value }));

const IMPORTANCE = [
  {
    key: 'importance',
    value: { type: 'enum', options: options(GRL_IMPORTANCES) },
    help: 'how much it matters to its actor, in words (the qualitative evaluation weighs it)',
  },
  {
    key: 'importanceQuantitative',
    value: { type: 'int', min: 0, max: 100 },
    help: 'how much it matters to its actor, 0..100 (the quantitative evaluation weighs it; 0 leaves it out)',
  },
] as const satisfies readonly GrlProperty[];

/** what GRL would declare on its elements (#105: not declarable yet) */
export const elementProperties = [
  ...IMPORTANCE,
  {
    key: 'decompositionType',
    value: { type: 'enum', options: options(GRL_DECOMPOSITIONS) },
    help: 'how its children decompose it, when its refinement links can’t say: Xor (one of them), drawn as Or',
  },
] as const satisfies readonly GrlProperty[];

export const grl = defineDialect({
  id: 'grl',
  name: 'GRL',
  elements: {
    goal: { fill: DEFAULT_FILL },
    task: { fill: DEFAULT_FILL },
    resource: { fill: DEFAULT_FILL },
    quality: { fill: DEFAULT_FILL },
  },
  defaultFill: DEFAULT_FILL,
  // an element's importance and decomposition type are read from its
  // custom properties (the importer writes them; the evaluation reads them)
  // but not declared: a dialect without ids writes no property lines, and an
  // element line holds annotations and declarations only (#105: a framework
  // gap, `elementProperties` below is what GRL would declare)
  properties: { goal: [], task: [], resource: [], quality: [] },
  // no ids, so no property lines: the inspector edits them
  propertyLineOrder: [],
  indent: '  ',
  links: {
    'istar.ContributionLink': [
      {
        key: 'contribution',
        value: { type: 'enum', options: options(GRL_CONTRIBUTIONS) },
        help: 'GRL’s contribution type (its iStar value is the link’s make, help, hurt or break)',
        check: 'grl.link.contribution',
      },
      {
        key: 'quantitativeContribution',
        value: { type: 'int', min: -100, max: 100 },
        help: 'its weight, −100..100: the quantitative evaluation adds weight × source / 100 (25 when it has none, as jUCMNav)',
        check: 'grl.link.quantitativeContribution',
      },
      {
        key: 'correlation',
        value: { type: 'bool' },
        help: 'a side effect rather than an intended contribution (drawn dotted in jUCMNav; evaluated the same)',
      },
    ],
  },
  actors: IMPORTANCE,
  projectResources: {
    strategies: {
      label: 'Strategies',
      format: 'json',
      many: true,
      role: 'strategies',
      path: 'strategies/',
      accept: ['.json'],
      help: 'one file per strategies group: each strategy’s initial values, which the evaluation propagates',
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
