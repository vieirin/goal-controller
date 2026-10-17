/**
 * What a notation says in a dialect: which constructs it writes and with
 * which operands, the standalone constructs, each modifier's arguments, and
 * the operators the dialect does not enable. Only the parse tree and the
 * dialect's `notation` are read; what an engine makes of it is the engine's.
 * A notation's members do this (`notation.reading(dialect)`,
 * `operandIds()`, `refs()`, goal-controller#188); these are their functions.
 */
import type { RtTree } from '../parse.js';
import { notationIds, notationOperandIds } from '../members.js';

export {
  callOperands,
  isEnabled,
  readNotation,
  type NotationReading,
} from '../members.js';

/** @deprecated a notation's `operandIds()` (goal-controller#188) */
export const operandIds = (tree: RtTree | null): string[] =>
  notationOperandIds(tree);

/** @deprecated a notation's `refs()` (goal-controller#188) */
export const notationRefs = (tree: RtTree | null): string[] =>
  notationIds(tree);
