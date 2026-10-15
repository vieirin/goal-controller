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
  actors,
  defineDialect,
  element,
  links,
  notation,
  property,
} from '@goal-controller/dialect';
import { importJucm } from '../../importers/jucm';
import type { GrlCheckName } from './checks';
import { grlExtension } from './extension';
import { canonicalJucm, JUCM_LOSSY, writeJucm } from './jucm';
import {
  GRL_CONTRIBUTIONS,
  GRL_DECOMPOSITIONS,
  GRL_IMPORTANCES,
} from './vocabulary';

/** Its properties, their `check` one of GRL's checks (a misspelt one doesn't compile). */
const { bool, enum: choice, int } = property.for<GrlCheckName>();

/** the istar-ts canvas's fill, as piStar */
const DEFAULT_FILL = '#CDFECD';

const IMPORTANCE = [
  choice('importance', GRL_IMPORTANCES, {
    help: 'how much it matters to its actor, in words (the qualitative evaluation weighs it)',
  }),
  int('importanceQuantitative', {
    min: 0,
    max: 100,
    help: 'how much it matters to its actor, 0..100 (the quantitative evaluation weighs it; 0 leaves it out)',
  }),
];

/** what GRL would declare on its elements (#105: not declarable yet) */
export const elementProperties = [
  ...IMPORTANCE,
  choice('decompositionType', GRL_DECOMPOSITIONS, {
    help: 'how its children decompose it, when its refinement links can’t say: Xor (one of them), drawn as Or',
  }),
];

/** a contribution's type and weight: what the evaluations read */
const CONTRIBUTION = [
  choice('contribution', GRL_CONTRIBUTIONS, {
    help: 'GRL’s contribution type (its iStar value is the link’s make, help, hurt or break)',
    check: 'grl.link.contribution',
  }),
  int('quantitativeContribution', {
    min: -100,
    max: 100,
    help: 'its weight, −100..100: the quantitative evaluation adds weight × source / 100 (25 when it has none, as jUCMNav)',
    check: 'grl.link.quantitativeContribution',
  }),
  bool('correlation', {
    help: 'a side effect rather than an intended contribution (drawn dotted in jUCMNav; evaluated the same)',
  }),
];

export const grl = defineDialect({
  id: 'grl',
  name: 'GRL',
  elements: {
    goal: element({ fill: DEFAULT_FILL }),
    task: element({ fill: DEFAULT_FILL }),
    resource: element({ fill: DEFAULT_FILL }),
    quality: element({ fill: DEFAULT_FILL }),
  },
  defaultFill: DEFAULT_FILL,
  // GRL writes no `[…]`: the notation names no operator, and a decomposition
  // is its refinement links' (an And or an Or; a Xor is read as an Or)
  notation: notation({
    operand: { kinds: ['goal', 'task'] },
    operators: {},
    constructs: {
      and: {
        label: 'And',
        help: 'satisfied by all its children',
        relation: 'and',
      },
      or: {
        label: 'Or',
        help: 'satisfied by any of its children',
        relation: 'or',
      },
    },
    defaultConstruct: { and: 'and', or: 'or' },
  }),
  // its indicator and belief (./extension): an indicator's properties are
  // declared on its kind (goal-controller#132); GRL lists none of its kinds
  extension: grlExtension,
  // an element's importance and decomposition type are read from its
  // custom properties (the importer writes them; the evaluation reads them)
  // but not declared (#105; `elementProperties` above is what GRL would
  // declare). A dialect without ids may write property lines since #138;
  // GRL hasn't moved them there, so its documents stay as they are. An
  // indicator's importance is declared: GRL lists no indicator, so it has no
  // line, and the inspector edits it.
  properties: {
    goal: [],
    task: [],
    resource: [],
    quality: [],
    'grl.Indicator': IMPORTANCE,
  },
  propertyLineOrder: [],
  indent: '  ',
  // a contribution's type and weight are what the evaluations read: written
  // as link lines under its source, the target named by its text
  linkLines: true,
  links: links({ 'istar.ContributionLink': CONTRIBUTION }),
  actors: actors(IMPORTANCE),
  // its analyses evaluate every actor and every tree (goal-controller#125)
  model: { actors: 'many', treesPerActor: 'many' },
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
  // jUCMNav's own file, read and written (goal-controller#144): the model
  // and its strategies, evaluated by jUCMNav as by the analyses
  nativeFiles: {
    jucm: {
      label: 'jUCMNav',
      extensions: ['.jucm'],
      format: 'xmi',
      schema: { kind: 'ecore', path: 'schema/grl.ecore' },
      read: (text) => importJucm(text),
      write: (model, context) => writeJucm(model, context),
      canonical: canonicalJucm,
      lossy: JUCM_LOSSY,
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
