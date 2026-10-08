/**
 * How a goal refines its children. Mirrors goal-tree's
 * `GoalExecutionDetail['type']` (goal-tree depends on this package, so the
 * union is declared here; goal-tree asserts both stay equal).
 */
export type RtConstruct =
  | 'sequence'
  | 'anyOrder'
  | 'interleaved'
  | 'alternative'
  | 'choice'
  | 'degradation'
  | 'decisionMaking';

export const CONSTRUCT_LABEL: Record<RtConstruct, string> = {
  sequence: 'Sequence',
  anyOrder: 'Any order',
  interleaved: 'Interleaved',
  alternative: 'Alternative',
  choice: 'Choice',
  degradation: 'Degradation',
  decisionMaking: 'Decision making',
};

export const CONSTRUCT_HELP: Record<RtConstruct, string> = {
  sequence: 'does every child, one after another',
  anyOrder: 'does every child, one at a time, in any order',
  interleaved: 'does every child, possibly at the same time',
  alternative: 'needs one child; picks again after each failed attempt',
  choice: 'needs one child; picks once and keeps it',
  degradation: 'retries the first child, then falls back to any child',
  decisionMaking: 'the controller decides which children to pursue',
};

export type RtOperator = ';' | '+' | '#' | '|' | '?' | '->';

/** The binary operators of the edgeV2 notation, in the inspector's order. */
export const RT_OPERATORS: ReadonlyArray<{
  op: RtOperator;
  construct: RtConstruct;
}> = [
  { op: ';', construct: 'sequence' },
  { op: '+', construct: 'anyOrder' },
  { op: '#', construct: 'interleaved' },
  { op: '|', construct: 'alternative' },
  { op: '?', construct: 'choice' },
  { op: '->', construct: 'degradation' },
];

export const RETRY_HELP = 'retries the goal on its left up to N times (G1@3)';

export type RtRelation = 'and' | 'or';

/**
 * The refinement links each construct needs: AND constructs pursue every child,
 * OR constructs one of them. The edgeV2 engine ignores a notation whose
 * construct contradicts its goal's links (it uses the links' default instead).
 */
export const CONSTRUCT_RELATION: Record<
  Exclude<RtConstruct, 'decisionMaking'>,
  RtRelation
> = {
  sequence: 'and',
  anyOrder: 'and',
  interleaved: 'and',
  alternative: 'or',
  choice: 'or',
  degradation: 'or',
};

/** Why a goal's notation contradicts its refinement links, if it does. */
export const relationMismatch = (
  construct: RtConstruct | null | undefined,
  relation: RtRelation | null | undefined,
): string | null => {
  if (!construct || construct === 'decisionMaking' || !relation) return null;
  const needs = CONSTRUCT_RELATION[construct];
  return needs === relation
    ? null
    : `${CONSTRUCT_LABEL[construct]} needs ${needs.toUpperCase()} refinement links, but this goal is refined with ${relation.toUpperCase()} links (the engine ignores the notation)`;
};
