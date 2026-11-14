/**
 * An element line's head (goal-controller#518): after its indentation and
 * annotations, the word its kind is written with (`goal`, `behavioral_goal`,
 * `kindWord`) and the id after it, if any (`goal G1: …`, `behavioral_goal
 * 7857cb00: …`). Read here, before the grammar, as link and actor lines are
 * (moving it into goal.langium is goal-controller#526's).
 */
import {
  ACTOR_LINE_KEY,
  LINK_LINE_KEY,
  kindWordsOf,
  linkLinesOf,
  type AnyDialect,
} from '@goal-controller/dialect';
import type { Span } from './lines.js';

export type LineHead = {
  /** the word as written */
  word: string;
  wordSpan: Span;
  /** the kind it is the word of (null: no kind of the definition's) */
  kind: string | null;
  /** the id after it, before its colon (null: the line writes none) */
  id: string | null;
  idSpan: Span | null;
};

export type HeadDefinition = Pick<AnyDialect, 'elements'> &
  Partial<
    Pick<AnyDialect, 'propertyLineOrder' | 'links' | 'linkLines' | 'actors'>
  >;

/** An element line's head: indentation, annotations, a word, and maybe `id:`. */
const HEAD =
  /^([ \t]*(?:(?:<<[^>\n]*>>|\{[^}\n]*\})[ \t]*)*)([a-z][a-z0-9_]*)(?=[ \t]|$)(?:([ \t]+)([A-Za-z0-9_][A-Za-z0-9_.-]*)[ \t]*:)?/;

/**
 * The keys a line may start with that are no kind's word: its property
 * lines', and `link`, `actor` where it writes them.
 */
export const lineKeyWords = (definition: HeadDefinition): Set<string> =>
  new Set([
    ...(definition.propertyLineOrder ?? []),
    ...(linkLinesOf(definition) ? [LINK_LINE_KEY] : []),
    ...(definition.actors ? [ACTOR_LINE_KEY] : []),
  ]);

/**
 * A line's head, if it has one: its word is a kind's (`kindWordsOf`), or,
 * no kind's, it is followed by an id and a colon and is no key a line
 * starts with otherwise (an unknown word: `kind` null). A kind's word that
 * is also such a key (tropos4as's `failure`) starts an element line only
 * when an id and a colon follow it; otherwise the line is a property's.
 */
export const readHead = (
  definition: HeadDefinition,
  text: string,
): LineHead | null => {
  const m = HEAD.exec(text);
  if (!m) return null;
  const [, before, word, gap, id] = m as unknown as [
    string,
    string,
    string,
    string | undefined,
    string | undefined,
  ];
  const kind = kindWordsOf(definition)[word] ?? null;
  // a key a line starts with otherwise (a property's, `link`, `actor`): an
  // element line's word only when an id and a colon follow (`failure F1: …`)
  if (id === undefined && (kind === null || lineKeyWords(definition).has(word)))
    return null;
  if (kind === null && lineKeyWords(definition).has(word)) return null;
  const from = before.length;
  const wordSpan = { from, to: from + word.length };
  const idFrom = wordSpan.to + (gap?.length ?? 0);
  return {
    word,
    wordSpan,
    kind,
    id: id ?? null,
    idSpan: id === undefined ? null : { from: idFrom, to: idFrom + id.length },
  };
};

/**
 * Where a line's word may be written (its indentation and annotations
 * aside): the span of the word being typed at the line's head, its text
 * before `offset`. Null: the cursor is not at a line's head.
 */
export const headWordAt = (
  text: string,
  offset: number,
): { from: number; typed: string } | null => {
  const m =
    /^([ \t]*(?:(?:<<[^>\n]*>>|\{[^}\n]*\})[ \t]*)*)([a-z][a-z0-9_]*)?$/.exec(
      text.slice(0, offset),
    );
  if (!m) return null;
  return { from: m[1]!.length, typed: m[2] ?? '' };
};
