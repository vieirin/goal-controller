import {
  OCL_BOOLEANS,
  OCL_KEYWORDS,
  OCL_LITERALS,
  OCL_OPERATIONS,
  OCL_OPERATORS,
} from '@goal-controller/goal-language';
import { DefaultLexer, type LexerResult } from 'langium';

// chevrotain's (Langium's lexer), through Langium: lib does not depend on it
type IToken = LexerResult['tokens'][number];
type ILexingError = LexerResult['errors'][number];

type Rules = ReadonlyArray<readonly [name: string, pattern: RegExp]>;

const rules = (list: ReadonlyArray<readonly [string, RegExp]>): Rules =>
  list.map(([name, pattern]) => [name, new RegExp(pattern.source, 'y')]);

/** The keywords of a list, each matching itself. */
const literal = (...keywords: string[]): Array<[string, RegExp]> =>
  keywords.map((k) => [
    k,
    new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  ]);

/**
 * The catalog's operators and punctuation, without `,`, `[`, `]`: OCL's
 * grammar here (OclExpression) never uses them (those are OclVariables',
 * tokenized separately by `variables`).
 */
const OCL_SYMBOLS = OCL_OPERATORS.filter(
  (symbol) => symbol !== ',' && symbol !== '[' && symbol !== ']',
);

/**
 * OCL (OclExpression), built from the goal-language catalog
 * (goal-controller#172): longest match, so `->` beats `-`, `<>`/`!=` and
 * `<=` beat `<`; a keyword ties with an IDENT of its length and wins, a
 * longer word (`index`) is an IDENT. Spaces are skipped. The condition
 * words (`assertion`, `condition`, `trigger`) are not OCL, so they are not
 * here: this lexer reads them only in `creationCondition`.
 */
const OCL = rules([
  ...literal(...OCL_SYMBOLS),
  ...literal(...OCL_OPERATIONS.map((operation) => operation.name)),
  ...literal(...OCL_KEYWORDS),
  ...literal(...OCL_BOOLEANS),
  ['STRING', OCL_LITERALS.STRING],
  ['NUMBER', OCL_LITERALS.NUMBER],
  ['INTEGER', OCL_LITERALS.INTEGER],
  ['IDENT', OCL_LITERALS.IDENT],
  ['SKIPPED', /\s+/],
]);

/** Params, Location (Names): a name, or anything else up to a space or a comma. */
const NAMES = rules([
  [',', /,/],
  ['NAME', /[A-Za-z][A-Za-z0-9_]*/],
  ['OTHER', /[^\sA-Za-z,]+/],
  ['SKIPPED', /\s+/],
]);

/** RobotNumber: `parse_robot_number`'s `\d+` and `[\d+,\d+]`; no spaces. */
const ROBOT_NUMBER = rules([
  ...literal('[', ',', ']'),
  ['INTEGER', /[0-9]+/],
  ['OTHER', /[\s\S]/],
]);

/** A creation condition's word (`[^\s"]+`): which one, in any case. */
const CREATION_WORD = /^(?:(assertion)|(condition)|(trigger))$/i;

/** CreationCondition: words, quoted text and spaces (the grammar says where). */
const CREATION = rules([
  ['SPACE', /\s+/],
  ['STRING', /"[^"]*"/],
  ['WORD', /[^\s"]+/],
  ['OTHER', /"/],
]);

/** One step of a shape: a token, where an optional one may be missing. */
type Step = readonly [name: string, pattern: RegExp, optional?: 'optional'];

const step = (name: string, pattern: RegExp, optional?: 'optional'): Step => [
  name,
  new RegExp(pattern.source, 'y'),
  optional,
];

/** a shape's path, `[a-zA-Z]+[\w.]*` */
const PATH = /[a-zA-Z][\w.]*/;
/** a shape's condition, `(.*)` before the closing parenthesis that ends the text */
const BODY = /.+(?=\)$)/;
/** the spaces a shape allows, `[ ]*` */
const SPACES = /[ ]+/;

/**
 * The decomposer's `forall_regex_exp`, `(.)*` and `[)]`, matched in full:
 * `[a-zA-Z]+[\w.]*(->forAll)[(][a-zA-Z]+[\w.]*[ ]*[|](.)*[)]`.
 */
const FOR_ALL: Step[] = [
  step('PATH', PATH),
  step('->', /->/),
  step('forAll', /forAll/),
  step('(', /\(/),
  step('PATH', PATH),
  step('SPACE', SPACES, 'optional'),
  step('|', /\|/),
  step('BODY', BODY, 'optional'),
  step(')', /\)/),
];

/**
 * The decomposer's `select_regex_exp`, matched in full:
 * `[a-zA-Z]{1}[\w.]*(->select)[(][a-zA-Z]{1}[\w.]*[:][a-zA-Z]+[\w.]+[ ]*[|][ ]*(.*)[)]`
 * (its type has two characters at least).
 */
const SELECT: Step[] = [
  step('PATH', PATH),
  step('->', /->/),
  step('select', /select/),
  step('(', /\(/),
  step('PATH', PATH),
  step(':', /:/),
  step('PATH', /[a-zA-Z][\w.]+/),
  step('SPACE', SPACES, 'optional'),
  step('|', /\|/),
  step('SPACE', SPACES, 'optional'),
  step('BODY', BODY, 'optional'),
  step(')', /\)/),
];

/** Where a tokenize call starts: the grammar's rule it is read with. */
export type MutroseStart =
  | 'expression'
  | 'variables'
  | 'names'
  | 'robotNumber'
  | 'creationCondition'
  | 'forAll'
  | 'select'
  | 'type';

const HIDDEN = new Set(['SKIPPED']);

const at = (pattern: RegExp, text: string, offset: number) => {
  pattern.lastIndex = offset;
  return pattern.exec(text)?.[0];
};

/** `parse_vars`'s words: a name before an item's colon, a type after it. */
const VARIABLE_NAME = /[A-Za-z][A-Za-z0-9_]*/y;
const TYPE_WORD = /[A-Za-z0-9]+/y;
const TYPE_CLASS = /\(([A-Za-z]+)\)/y;

export class MutroseLexer extends DefaultLexer {
  /** Where the next `tokenize` starts (reset after each call). */
  start: MutroseStart = 'expression';

  override tokenize(text: string): LexerResult {
    const tokens: IToken[] = [];
    const hidden: IToken[] = [];
    const errors: ILexingError[] = [];
    const start = this.start;
    this.start = 'expression';
    let offset = 0;
    let line = 1;
    let column = 1;

    const advance = (image: string) => {
      for (const ch of image) {
        if (ch === '\n') {
          line++;
          column = 1;
        } else column++;
      }
      offset += image.length;
    };
    const push = (name: string, image: string) => {
      const tokenType = this.definition[name];
      if (!tokenType) throw new Error(`MutroseLexer: no token type ${name}`);
      const [startLine, startColumn, startOffset] = [line, column, offset];
      advance(image);
      // as chevrotain's createTokenInstance makes it: 1-based lines and
      // columns, inclusive ends
      const token: IToken = {
        image,
        startOffset,
        endOffset: offset - 1,
        startLine,
        endLine: line,
        startColumn,
        endColumn: column - 1,
        tokenTypeIdx: tokenType.tokenTypeIdx!,
        tokenType,
      };
      (HIDDEN.has(name) ? hidden : tokens).push(token);
    };
    /** the longest match of a token set (ties: the first listed) */
    const longest = (set: Rules) => {
      let best: { name: string; image: string } | null = null;
      for (const [name, pattern] of set) {
        const image = at(pattern, text, offset);
        if (image && (!best || image.length > best.image.length))
          best = { name, image };
      }
      return best;
    };
    const unrecognized = () => {
      errors.push({
        offset,
        line,
        column,
        length: 1,
        message: `token recognition error at: '${text[offset]}'`,
      });
      advance(text[offset]!);
    };

    /** `Room`, `Sequence(Room)`: a type word, and the class in its parentheses */
    const typeTokens = () => {
      push('TYPE_WORD', at(TYPE_WORD, text, offset)!);
      TYPE_CLASS.lastIndex = offset;
      const element = TYPE_CLASS.exec(text);
      if (element) {
        push('(', '(');
        push('NAME', element[1]!);
        push(')', ')');
      }
    };

    if (start === 'type') {
      // one type, as a variable list has it; anything else is an OTHER
      if (at(TYPE_WORD, text, offset)) typeTokens();
      if (offset < text.length) push('OTHER', text.slice(offset));
      return { tokens, hidden, errors };
    }

    if (start === 'forAll' || start === 'select') {
      // the shape's steps in order; what does not fit is one OTHER, which
      // the grammar never expects
      for (const [name, pattern, optional] of start === 'forAll'
        ? FOR_ALL
        : SELECT) {
        const image = at(pattern, text, offset);
        if (image) push(name, image);
        else if (!optional) break;
      }
      if (offset < text.length) push('OTHER', text.slice(offset));
      return { tokens, hidden, errors };
    }

    if (start === 'variables') {
      // `parse_vars`: each item split at its colons; the first name before
      // the first colon, the first type word between it and the second
      // colon; the rest of the item, up to its comma, IGNORED
      let part: 'name' | 'type' | 'rest' = 'name';
      let found = false;
      let ignored = '';
      const word = (name: string, image: string) => {
        if (ignored) push('IGNORED', ignored);
        ignored = '';
        push(name, image);
      };
      while (offset + ignored.length < text.length) {
        const here = offset + ignored.length;
        const ch = text[here]!;
        const name = !found && part === 'name' && at(VARIABLE_NAME, text, here);
        const type = !found && part === 'type' && at(TYPE_WORD, text, here);
        if (ch === ',') {
          word(',', ch);
          [part, found] = ['name', false];
        } else if (ch === ':' && part === 'name') {
          word(':', ch);
          [part, found] = ['type', false];
        } else if (name) {
          word('NAME', name);
          found = true;
        } else if (type) {
          if (ignored) push('IGNORED', ignored);
          ignored = '';
          typeTokens();
          found = true;
        } else {
          if (ch === ':') part = 'rest';
          ignored += ch;
        }
      }
      if (ignored) push('IGNORED', ignored);
      return { tokens, hidden, errors };
    }

    const set = {
      expression: OCL,
      names: NAMES,
      robotNumber: ROBOT_NUMBER,
      creationCondition: CREATION,
    }[start];
    while (offset < text.length) {
      const best = longest(set);
      if (!best) unrecognized();
      else if (best.name !== 'WORD') push(best.name, best.image);
      else {
        const word = CREATION_WORD.exec(best.image);
        push(
          word?.[1]
            ? 'ASSERTION'
            : word?.[2]
              ? 'CONDITION'
              : word?.[3]
                ? 'TRIGGER'
                : 'OTHER',
          best.image,
        );
      }
    }
    return { tokens, hidden, errors };
  }
}
