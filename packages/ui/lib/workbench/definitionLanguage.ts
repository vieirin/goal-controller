/**
 * Highlighting from an engine definition: the Notation view's document and
 * the value types property fields are written in. Every token is the goal
 * language's (@goal-controller/goal-language reads each line); the definition
 * only says which value type a property line's value has.
 */
import { StreamLanguage, type StreamParser } from '@codemirror/language';
import type { AnyDialect, ValueConfig } from '@goal-controller/dialect';
import {
  highlightLine,
  highlightValue,
  type Highlight,
} from '@goal-controller/goal-language';

type LineState = { highlights: Highlight[] };

/** A stream parser over each line's highlights, read once per line. */
const highlighted = (
  name: string,
  read: (line: string) => Highlight[],
): StreamParser<LineState> => ({
  name,
  startState: () => ({ highlights: [] }),
  token(stream, state) {
    if (stream.sol()) state.highlights = read(stream.string);
    const at = stream.pos;
    const found = state.highlights.find((h) => h.from <= at && at < h.to);
    if (found) {
      stream.pos = found.to;
      return found.style;
    }
    // up to the next highlighted part, unstyled
    const next = state.highlights.find((h) => h.from > at);
    stream.pos = next ? next.from : stream.string.length;
    return null;
  },
});

/** The Notation view's document tokens, line by line. */
export const documentParser = (
  definition: AnyDialect,
): StreamParser<LineState> =>
  highlighted(definition.id, (line) => highlightLine(definition, line));

/** The Notation view's document language. */
export const documentLanguage = (definition: AnyDialect) =>
  StreamLanguage.define(documentParser(definition));

/** A property field's language, by its value type. */
export const valueLanguage = (value: ValueConfig) =>
  StreamLanguage.define(
    highlighted(value.type, (line) => highlightValue(value, line)),
  );
