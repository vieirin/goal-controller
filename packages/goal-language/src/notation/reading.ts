/**
 * What a notation says in a dialect: which constructs it writes and with
 * which operands, the standalone constructs, each modifier's arguments, and
 * the operators the dialect does not enable. Only the parse tree and the
 * dialect's `notation` are read; what an engine makes of it is the engine's.
 */
import type { WithNotation } from '@goal-controller/dialect';
import { rtText, type RtTree } from '../parse.js';

type Form = 'infix' | 'prefix' | 'postfix' | 'standalone' | 'call';

/**
 * Whether a dialect enables an operator: a standalone symbol as standalone,
 * any other by its symbol (a postfix one, to a modifier). The validator
 * reports the ones it does not.
 */
export const isEnabled = (
  { notation }: WithNotation,
  symbol: string,
  form: Form,
): boolean => {
  if (form === 'standalone') return symbol in (notation.standalone ?? {});
  const meaning = notation.operators[symbol];
  if (meaning === undefined) return false;
  return form === 'postfix'
    ? meaning in (notation.modifiers ?? {})
    : meaning in notation.constructs;
};

/**
 * An operand's element ids (and `skip`, and standalone symbols): through
 * operators and modifiers; a group's (`[...]`) and a call's
 * (`FALLBACK(...)`) are their own, not their parent's.
 */
export const operandIds = (tree: RtTree | null): string[] => {
  switch (tree?.kind) {
    case 'ref':
      return [tree.id];
    case 'skip':
      return ['skip'];
    case 'standalone':
      return [tree.symbol];
    case 'postfix':
    case 'prefix':
      return operandIds(tree.expr);
    case 'binary':
      return [...operandIds(tree.left), ...operandIds(tree.right)];
    default:
      return [];
  }
};

/** A call's operands' ids, its arguments in order (`FALLBACK(G2,G3)`: G2, G3). */
export const callOperands = (
  tree: Extract<RtTree, { kind: 'call' }>,
): string[] => tree.args.flatMap(operandIds);

export type NotationReading = {
  /** each construct's ids, from its last (outermost) operator, empty or not */
  constructs: Map<string, string[]>;
  /** the standalone constructs written */
  standalone: Set<string>;
  /** each modifier's arguments, by the modified operand's text */
  modifiers: Map<string, Record<string, number>>;
  /** the operators written that the dialect does not enable */
  disabled: string[];
};

/** A notation's tree read in a dialect, innermost operator first. */
export const readNotation = (
  dialect: WithNotation,
  tree: RtTree | null,
): NotationReading => {
  const { operators, standalone = {} } = dialect.notation;
  const reading: NotationReading = {
    constructs: new Map(),
    standalone: new Set(),
    modifiers: new Map(),
    disabled: [],
  };
  const enabled = (symbol: string, form: Form) => {
    const yes = isEnabled(dialect, symbol, form);
    if (!yes) reading.disabled.push(symbol);
    return yes;
  };
  const visit = (node: RtTree | null): void => {
    switch (node?.kind) {
      case 'group':
        return visit(node.expr);
      case 'binary':
      case 'prefix':
        if (node.kind === 'binary') {
          visit(node.left);
          visit(node.right);
        } else visit(node.expr);
        if (enabled(node.operator, node.kind === 'binary' ? 'infix' : 'prefix'))
          reading.constructs.set(
            operators[node.operator]!,
            operandIds(node).filter(Boolean),
          );
        return;
      case 'call':
        for (const arg of node.args) visit(arg);
        if (enabled(node.name, 'call'))
          reading.constructs.set(
            operators[node.name]!,
            callOperands(node).filter(Boolean),
          );
        return;
      case 'postfix': {
        visit(node.expr);
        if (!enabled(node.operator, 'postfix')) return;
        const modifier = operators[node.operator]!;
        reading.modifiers.set(modifier, {
          ...reading.modifiers.get(modifier),
          [rtText(node.expr)]: parseInt(node.argument),
        });
        return;
      }
      case 'standalone':
        if (enabled(node.symbol, 'standalone'))
          reading.standalone.add(standalone[node.symbol]!);
        return;
      default:
        return;
    }
  };
  visit(tree);
  return reading;
};
