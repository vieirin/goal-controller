/**
 * What the Edge engines share besides their properties: the elements and their
 * line syntax, the constructs, the resource declaration, the editors' problems.
 * Each engine's own file adds its operators.
 */
import { assertionLanguage } from './assertion';
import type {
  ConstructDefinition,
  DeclarationDefinition,
  ElementDefinition,
  ProblemKind,
  Severity,
} from '../schema';
import { edgeProperties, edgePropertyLineOrder } from './edgeProperties';

/** The default fill of an intentional element (the istar-ts canvas, as piStar). */
export const DEFAULT_ELEMENT_FILL = '#CDFECD';

// `1`, `1.2`, `1X`, `X`, `1a` (RTRegex.g4's id)
const ID = '(?:[0-9]+\\.?[0-9]*X?|X|[0-9][a-z])';
const NAME = "[A-Za-z\\- ']";

const element = (
  prefix: string,
  fill: string,
  slots: ElementDefinition['slots'],
): ElementDefinition => ({
  prefix,
  idPattern: ID,
  line: '{id}: {name}',
  slots,
  nameCharset: NAME,
  fill,
});

export const edgeElements = {
  goal: element('G', DEFAULT_ELEMENT_FILL, ['notation']),
  task: element('T', DEFAULT_ELEMENT_FILL, ['notation']),
  // piStar's resource yellow: Edge resources are drawn with it unless they have a colour
  resource: element('R', '#FAF383', ['notation', 'declaration']),
};

/**
 * How a goal refines its children, in the inspector's order. The names are
 * goal-tree's `GoalExecutionDetail['type']` (lib's tests assert they match).
 */
export const CONSTRUCTS = {
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

/** `G1@3`: retries the goal on its left (tightest of all operators). */
export const RETRY = {
  symbol: '@',
  form: 'postfix',
  assoc: 'left',
  argument: { name: 'retries', value: { type: 'int', min: 1 }, default: '3' },
  label: 'Retry',
  help: 'retries the goal on its left up to N times (G1@3)',
  appliesTo: ['degradation'],
  action: 'Retry the first child up to {retries} times before falling back',
} as const;

const NUMBER = '-?\\d+';
const WORD = '[A-Za-z_]\\w*';

/** A resource's declaration: `{int 0..100 = 80}`, `{bool = false}`. */
const declaration: DeclarationDefinition = {
  delimiters: ['{', '}'],
  parts: [
    { key: 'type', pattern: WORD },
    {
      optional: [
        { literal: ' ' },
        { key: 'lowerBound', pattern: NUMBER },
        { literal: '..' },
        { key: 'upperBound', pattern: NUMBER },
      ],
    },
    {
      optional: [
        { literal: ' = ' },
        { key: 'initialValue', pattern: `${NUMBER}|${WORD}` },
      ],
    },
  ],
};

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
};

/** Everything an Edge definition has but its id, name, grammar, parser and operators. */
export const edgeFamily = {
  elements: edgeElements,
  defaultFill: DEFAULT_ELEMENT_FILL,
  properties: edgeProperties,
  propertyLine: { separator: ' ', keyPattern: '[A-Za-z]+' },
  propertyLineOrder: edgePropertyLineOrder,
  declaration,
  indent: '  ',
  problems,
  notInDiagram: 'Add this element in the diagram',
  languages: { assertion: assertionLanguage },
} as const;

export const edgeNotation = {
  delimiters: ['[', ']'],
  operand: { kinds: ['goal', 'task'], keywords: ['skip'] },
  constructs: CONSTRUCTS,
  defaultConstruct: { and: 'interleaved', or: 'alternative' },
} as const;
