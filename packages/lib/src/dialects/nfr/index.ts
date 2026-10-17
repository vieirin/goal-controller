/**
 * The NFR Framework as DSM3-goals defines it (J. Pimentel,
 * https://www.cin.ufpe.br/~jhcp/dsm3goals/; istar-ts's `@istar-ts/dsm3-nfr`):
 * a modelling dialect of the `nfr` framework (no engine reads it yet). Its
 * kinds are the NFR root metamodel's, every node on the paper. DSM3 declares
 * no custom property but piStar's description; a contribution's and a
 * correlation's label is one of istar-ts's NFR_CONTRIBUTION_LABELS (`–` is
 * U+2013 EN DASH), changed on the link
 * (goal-controller#171, decisions in packages/dialect/docs/frameworks.md).
 *
 * In the Notation view softgoals are `S`, operationalizations `O` and claims
 * `C`; there is no bracket notation. And- and Or-refinements list the
 * children under the softgoal they refine.
 */
import {
  NFR_CONTRIBUTION_LABELS,
  NFR_FILL,
  type NfrElementKind,
} from '@istar-ts/dsm3-nfr/metamodel';
import {
  defineDialect,
  element,
  property,
  type ElementDefinition,
} from '@goal-controller/dialect';

/** DSM3 draws NFR's clouds on white (language_nfr_shapes.js), as istar-ts does. */
const FILL = NFR_FILL;

const DESCRIPTION = [
  property.text('Description', { help: 'what it is, in words' }),
];

export const nfr = defineDialect({
  id: 'nfr',
  name: 'NFR Framework',
  framework: 'nfr',
  // every NFR node kind, with its prefix
  elements: {
    'nfr.NFR': element('S', { fill: FILL }),
    'nfr.Operationalization': element('O', { fill: FILL }),
    'nfr.Claim': element('C', { fill: FILL }),
  } satisfies Record<NfrElementKind, ElementDefinition>,
  defaultFill: FILL,
  properties: {
    'nfr.NFR': DESCRIPTION,
    'nfr.Operationalization': DESCRIPTION,
    'nfr.Claim': DESCRIPTION,
  },
  propertyLineOrder: ['Description'],
  indent: '  ',
  refinements: {
    'nfr.AndRefinementLink': 'and',
    'nfr.OrRefinementLink': 'or',
  },
  linkLabels: {
    'nfr.ContributionLink': NFR_CONTRIBUTION_LABELS,
    'nfr.CorrelationLink': NFR_CONTRIBUTION_LABELS,
  },
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
