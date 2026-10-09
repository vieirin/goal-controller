/**
 * What the Edge engines share besides their properties: the elements and their
 * line syntax, the constructs, the resource declaration, the editors' problems.
 * Each engine's own file adds its operators.
 */
import type {
  ConstructDefinition,
  ElementDefinition,
  ModifierDefinition,
  ProblemKind,
  Severity,
} from '@goal-controller/dialect';
import { edgeProperties, edgePropertyLineOrder } from './properties';

/** The default fill of an intentional element (the istar-ts canvas, as piStar). */
export const DEFAULT_ELEMENT_FILL = '#CDFECD';

const element = (prefix: 'G' | 'T' | 'R', fill: string): ElementDefinition => ({
  prefix,
  fill,
});

export const edgeElements = {
  goal: element('G', DEFAULT_ELEMENT_FILL),
  task: element('T', DEFAULT_ELEMENT_FILL),
  // piStar's resource yellow: Edge resources are drawn with it unless they have a colour
  // `R1: Battery {int 0..100 = 80}`: its type, bounds and initial value
  resource: { ...element('R', '#FAF383'), declares: true },
};

/**
 * How a goal refines its children, in the inspector's order. Their names are
 * what a goal's execution detail can say (`ExecutionDetailOf<typeof edgeV2>`'s
 * `type`): a misspelt one doesn't compile.
 */
export const RT_CONSTRUCTS = {
  sequence: {
    label: 'Sequence',
    help: 'does every child, one after another',
    relation: 'and',
  },
  anyOrder: {
    label: 'Any order',
    help: 'does every child, one at a time, in any order',
    relation: 'and',
  },
  interleaved: {
    label: 'Interleaved',
    help: 'does every child, possibly at the same time',
    relation: 'and',
  },
  alternative: {
    label: 'Alternative',
    help: 'needs one child; picks again after each failed attempt',
    relation: 'or',
  },
  choice: {
    label: 'Choice',
    help: 'needs one child; picks once and keeps it',
    relation: 'or',
  },
  degradation: {
    label: 'Degradation',
    help: 'retries the first child, then falls back to any child',
    relation: 'or',
  },
  decisionMaking: {
    label: 'Decision making',
    help: 'the controller decides which children to pursue',
  },
} as const satisfies Record<string, ConstructDefinition>;

/** `G1@3`: retries the goal on its left (`@`, the tightest of all operators). */
export const RETRY = {
  argument: { name: 'retries', value: { type: 'int', min: 1 }, default: '3' },
  label: 'Retry',
  help: 'retries the goal on its left up to N times (G1@3)',
  appliesTo: ['degradation'],
  action: 'Retry the first child up to {retries} times before falling back',
} as const satisfies ModifierDefinition;

/**
 * How serious each notation/structure mismatch is, for every editor (Notation
 * view, inspector, Problems). The engine generates in each case, but it drops
 * what it cannot use: a notation naming a non-child or contradicting the links
 * is not what the model says (error); an unlisted child is appended (warning).
 */
const problems: Record<ProblemKind, { severity: Severity; message: string }> = {
  notAChild: { severity: 'error', message: 'Not a child of this goal' },
  relationMismatch: {
    severity: 'error',
    message:
      '{construct} needs {needs} refinement links, but this goal is refined with {relation} links (the engine ignores the notation)',
  },
  missingFromNotation: {
    severity: 'warning',
    message: 'Missing from the notation',
  },
  notInDiagram: {
    severity: 'error',
    message: 'Add this element in the diagram',
  },
};

/** Everything an Edge definition has but its id, name and operators. */
export const edgeFamily = {
  elements: edgeElements,
  defaultFill: DEFAULT_ELEMENT_FILL,
  properties: edgeProperties,
  propertyLineOrder: edgePropertyLineOrder,
  indent: '  ',
  problems,
} as const;

export const edgeNotation = {
  operand: { kinds: ['goal', 'task'], skip: true },
  modifiers: { retry: RETRY },
  constructs: RT_CONSTRUCTS,
  defaultConstruct: { and: 'interleaved', or: 'alternative' },
} as const;
