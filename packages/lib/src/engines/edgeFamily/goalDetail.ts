/**
 * How the Edge engines read a goal's text: the goal language reads it (its
 * id, name and notation), and the engine's definition says what each
 * operator in it is. Which one construct the goal has is decided as
 * RTRegex.g4's listeners decided it, and PRISM depends on that:
 *
 * - a construct is read when its operator's node is left, innermost first:
 *   the last one written of each construct (the outermost) is the one kept,
 *   empty or not;
 * - an operand's ids are its ids, through operators and retries; a group
 *   (`[...]`) has none;
 * - when several constructs are written, the first of the engine's cascade
 *   that has ids wins (a standalone construct: when it is written at all);
 * - a construct a modifier applies to (degradation, for retries) carries the
 *   modifiers written: `retryMap`, by the retried operand's text.
 */
import type { WithNotation } from '@goal-controller/dialect';
import type {
  GoalDetail,
  GoalExecutionDetail,
} from '@goal-controller/goal-tree';
import {
  rtText,
  type ElementLineData,
  type RtTree,
} from '@goal-controller/goal-language';

/** The field a construct's ids go in (degradation's is `degradationList`). */
const listOf = (construct: string) =>
  construct === 'degradation' ? 'degradationList' : construct;

/** An operand's ids, as RTRegex.g4's `extractGoalIds` collected them. */
const idsOf = (tree: RtTree | null): string[] => {
  switch (tree?.kind) {
    case 'ref':
      return [tree.id];
    case 'skip':
      return ['skip'];
    case 'standalone':
      return [tree.symbol];
    case 'postfix':
    case 'prefix':
      return idsOf(tree.expr);
    case 'binary':
      return [...idsOf(tree.left), ...idsOf(tree.right)];
    default:
      // a group: its brackets are not operands
      return [];
  }
};

/** What a notation says, as the listener collected it. */
export const readConstructs = (
  { notation }: WithNotation,
  tree: RtTree | null,
): {
  /** each construct's last (outermost) ids */
  last: Map<string, string[]>;
  /** the standalone constructs written */
  standalone: Set<string>;
  /** each modifier's arguments, by the modified operand's text */
  modified: Map<string, Record<string, number>>;
  /** the operators written that the definition does not enable */
  disabled: string[];
} => {
  const { operators, standalone = {}, constructs, modifiers = {} } = notation;
  const last = new Map<string, string[]>();
  const written = new Set<string>();
  const modified = new Map<string, Record<string, number>>();
  const disabled: string[] = [];
  const visit = (node: RtTree | null): void => {
    switch (node?.kind) {
      case 'group':
        return visit(node.expr);
      case 'binary':
      case 'prefix': {
        if (node.kind === 'binary') {
          visit(node.left);
          visit(node.right);
        } else visit(node.expr);
        const meaning = operators[node.operator];
        if (meaning === undefined) disabled.push(node.operator);
        else if (meaning in constructs)
          last.set(meaning, idsOf(node).filter(Boolean));
        return;
      }
      case 'postfix': {
        visit(node.expr);
        const meaning = operators[node.operator];
        if (meaning === undefined || !(meaning in modifiers)) {
          disabled.push(node.operator);
          return;
        }
        modified.set(meaning, {
          ...modified.get(meaning),
          [rtText(node.expr)]: parseInt(node.argument),
        });
        return;
      }
      case 'standalone': {
        const construct = standalone[node.symbol];
        if (construct === undefined) disabled.push(node.symbol);
        else written.add(construct);
        return;
      }
      default:
        return;
    }
  };
  visit(tree);
  return { last, standalone: written, modified, disabled };
};

/**
 * An Edge engine's reading of an element line: `cascade` is the engine's
 * constructs by which wins.
 */
export const edgeGoalDetail = (
  definition: WithNotation,
  cascade: readonly string[],
  line: ElementLineData | null,
): GoalDetail => {
  const said = readConstructs(definition, line?.notation ?? null);
  const modifiers = Object.entries(definition.notation.modifiers ?? {});
  let executionDetail: GoalExecutionDetail | null = null;
  for (const construct of cascade) {
    const ids = said.last.get(construct);
    if (said.standalone.has(construct))
      executionDetail = { type: construct } as GoalExecutionDetail;
    else if (ids?.length) {
      const carried = Object.assign(
        {},
        ...modifiers
          .filter(([, modifier]) => modifier.appliesTo.includes(construct))
          .map(([name]) => said.modified.get(name) ?? {}),
      );
      executionDetail = {
        type: construct,
        [listOf(construct)]: ids,
        // RTRegex.g4's retries were its one modifier: `retryMap`
        ...(Object.keys(carried).length ? { retryMap: carried } : {}),
      } as GoalExecutionDetail;
    }
    if (executionDetail) break;
  }
  return {
    id: line?.id ?? '',
    goalName: (line?.name ?? '').trim(),
    executionDetail,
  };
};

/** Which construct wins when several are written: EdgeV2's (RTRegex.g4's listener). */
export const EDGE_V2_CASCADE = [
  'degradation',
  'sequence',
  'anyOrder',
  'alternative',
  'interleaved',
  'choice',
] as const;

/** Edge's (v1: no any order; a choice is a standalone `+`). */
export const EDGE_CASCADE = [
  'degradation',
  'sequence',
  'alternative',
  'interleaved',
  'choice',
] as const;
