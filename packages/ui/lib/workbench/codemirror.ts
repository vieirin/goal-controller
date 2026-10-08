/**
 * CodeMirror setup shared by the workbench editors: PRISM syntax, the
 * workbench theme, and small helpers for decorations.
 */
import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
  type StreamParser,
} from '@codemirror/language';
import {
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { PROPERTY_MODES } from '@goal-controller/rt-language/properties';

// ---------------------------------------------------------------------------
// PRISM language (enough for highlighting generated models)
// ---------------------------------------------------------------------------

const KEYWORDS = new Set([
  'dtmc',
  'mdp',
  'ctmc',
  'module',
  'endmodule',
  'formula',
  'const',
  'label',
  'rewards',
  'endrewards',
  'init',
  'endinit',
  'global',
  'system',
  'endsystem',
]);
const TYPES = new Set(['int', 'double', 'bool']);
const ATOMS = new Set(['true', 'false']);

const prismParser: StreamParser<{ inLabel: boolean }> = {
  name: 'prism',
  startState: () => ({ inLabel: false }),
  token(stream, state) {
    if (stream.eatSpace()) return null;
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.peek() === '[') {
      stream.next();
      state.inLabel = true;
      return 'bracket';
    }
    if (state.inLabel) {
      if (stream.peek() === ']') {
        stream.next();
        state.inLabel = false;
        return 'bracket';
      }
      stream.match(/^[^\]]+/);
      return 'labelName';
    }
    if (stream.match(/^"[^"]*"/)) return 'string';
    if (stream.match(/^\d+(\.\d+)?/)) return 'number';
    const word = stream.match(/^[A-Za-z_][A-Za-z0-9_]*'?/);
    if (word) {
      const text = (word as RegExpMatchArray)[0];
      if (KEYWORDS.has(text)) return 'keyword';
      if (TYPES.has(text)) return 'typeName';
      if (ATOMS.has(text)) return 'atom';
      return 'variableName';
    }
    if (stream.match(/^(->|<=|>=|!=|=>|<=>|[=<>&|!+\-*/?:;.])/))
      return 'operator';
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: '//' } },
};

export const prismLanguage = StreamLanguage.define(prismParser);

// ---------------------------------------------------------------------------
// RT notation (`G1: Name [G2;G3@2->T4]`), for the notation view
// ---------------------------------------------------------------------------

const PROPERTY_KEY = new RegExp(
  `^(${Object.keys(PROPERTY_MODES).join('|')})(?![\\w])`,
);

const rtParser: StreamParser<{
  inNotation: boolean;
  named: boolean;
  property: boolean;
  decl: boolean;
}> = {
  name: 'rt',
  startState: () => ({
    inNotation: false,
    named: false,
    property: false,
    decl: false,
  }),
  token(stream, state) {
    if (stream.sol()) {
      state.named = false;
      state.property = false;
      state.decl = false;
      state.inNotation = false;
    }
    if (stream.eatSpace()) return null;
    // a property line under an element: `maintain battery > 20`
    if (!state.named && !state.property && stream.match(PROPERTY_KEY)) {
      state.property = true;
      return 'propertyName';
    }
    if (state.property || state.decl) {
      if (state.decl && stream.eat('}')) {
        state.decl = false;
        return 'brace';
      }
      if (stream.match(/^(true|false)\b/)) return 'bool';
      if (stream.match(/^-?\d+(\.\d+)?/)) return 'number';
      if (stream.match(/^(int|bool)\b/) && state.decl) return 'typeName';
      if (stream.match(/^[A-Za-z_]\w*/)) return 'variableName';
      if (stream.match(/^(!=|<=|>=|\.\.|[&|!<>=(),:])/)) return 'operator';
      stream.next();
      return null;
    }
    if (stream.eat('{')) {
      state.decl = true;
      return 'brace';
    }
    if (stream.eat('[')) {
      state.inNotation = true;
      return 'bracket';
    }
    if (stream.eat(']')) {
      state.inNotation = false;
      return 'bracket';
    }
    if (!state.inNotation && !state.named) {
      if (stream.match(/^[GTR][0-9][0-9a-zA-Z.]*/)) return 'labelName';
      if (stream.eat(':')) {
        state.named = true;
        return 'punctuation';
      }
    }
    if (!state.inNotation) {
      stream.match(/^[^[{]+/);
      return 'string';
    }
    if (stream.match('skip')) return 'keyword';
    if (stream.match(/^[GTR][0-9][0-9a-zA-Z.]*/)) return 'labelName';
    if (stream.match(/^@[0-9.]+/)) return 'number';
    if (stream.match(/^(->|[;#+|?])/)) return 'operator';
    stream.next();
    return null;
  },
};

export const rtLanguage = StreamLanguage.define(rtParser);

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: '#1E2527', fontWeight: '600' },
  { tag: t.typeName, color: '#1F7A74' },
  { tag: t.labelName, color: '#6D4AFF' },
  { tag: t.comment, color: '#9AA4A6', fontStyle: 'italic' },
  { tag: [t.number, t.atom, t.bool], color: '#B7791F' },
  { tag: t.string, color: '#1F7A74' },
  { tag: t.operator, color: '#6B7679' },
  { tag: t.variableName, color: '#1E2527' },
  { tag: t.propertyName, color: '#1F7A74' },
  { tag: t.punctuation, color: '#6B7679' },
]);

export const workbenchTheme: Extension = [
  EditorView.theme({
    '&': { backgroundColor: '#FFFFFF', color: '#1E2527' },
    '.cm-gutters': {
      backgroundColor: '#FFFFFF',
      color: '#9AA4A6',
      borderRight: '1px solid #DDE3E1',
    },
    '.cm-activeLineGutter': { backgroundColor: '#F3F5F4', color: '#3A4447' },
    '.cm-activeLine': { backgroundColor: 'rgba(30, 37, 39, 0.03)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'rgba(109, 74, 255, 0.18) !important',
    },
    '.cm-cursor': { borderLeftColor: '#6D4AFF' },
    '.cm-tooltip': { border: '1px solid #DDE3E1', borderRadius: '6px' },
    '.cm-changedLine': {
      backgroundColor: 'rgba(31, 122, 116, 0.07) !important',
    },
    '.cm-deletedChunk': {
      backgroundColor: 'rgba(194, 65, 45, 0.07) !important',
    },
    '.cm-insertedLine, .cm-changedText': {
      backgroundColor: 'rgba(31, 122, 116, 0.12) !important',
    },
    '.cm-deletedLine, .cm-deletedText': {
      backgroundColor: 'rgba(194, 65, 45, 0.12) !important',
    },
    '.cm-collapsedLines': {
      backgroundColor: '#F3F5F4',
      color: '#6B7679',
      fontFamily: 'var(--font-ui)',
    },
  }),
  syntaxHighlighting(highlight),
];

// ---------------------------------------------------------------------------
// Line / range decorations driven from React
// ---------------------------------------------------------------------------

export type LineMark = { line: number; className: string };
export type RangeMark = { from: number; to: number; className: string };

export const setLineMarks = StateEffect.define<LineMark[]>();
export const setRangeMarks = StateEffect.define<RangeMark[]>();

export const lineMarksField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    let next = value.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setLineMarks)) {
        const builder = new RangeSetBuilder<Decoration>();
        const lines = tr.state.doc.lines;
        [...effect.value]
          .filter((mark) => mark.line >= 1 && mark.line <= lines)
          .sort((a, b) => a.line - b.line)
          .forEach((mark) => {
            const at = tr.state.doc.line(mark.line).from;
            builder.add(at, at, Decoration.line({ class: mark.className }));
          });
        next = builder.finish();
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const rangeMarksField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    let next = value.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setRangeMarks)) {
        const length = tr.state.doc.length;
        next = Decoration.set(
          effect.value
            .filter((mark) => mark.from < mark.to && mark.to <= length)
            .sort((a, b) => a.from - b.from)
            .map((mark) =>
              Decoration.mark({ class: mark.className }).range(
                mark.from,
                mark.to,
              ),
            ),
        );
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});
