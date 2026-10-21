/**
 * A recursive-descent parser for the LTL formula value (../ast.ts), one
 * grammar for both surfaces: a word-based sugar (as transcribed in
 * docs/papers/rt-ltl-re01.md §7, with its source grammar's rule names and
 * licence — packages/dialect/docs/frameworks.md's to name) and RE'01's
 * symbolic RT-LTL. The precedence chain mirrors the sugar grammar's own
 * (`Formula` → `Quantified` → `StrongBinary` → `Binary` → `TemporalBinary` →
 * `And` → `Or` → `Unary` → `FormulaAtomic`) exactly, including its
 * right-hand sides recursing to the top (`Formula`) rather than to the next
 * tighter level — the source grammar is deliberately right-associative this
 * way, and a different shape would silently diverge from the oracle
 * grammar. Each symbolic spelling is accepted at the sugar word's same
 * grammar position, so the two surfaces share one parser; which one a node
 * read with is recorded (`Surface`) for `./print.ts`.
 */
import type {
  AttributeAccess,
  Bound,
  Comparison,
  ComparisonOperator,
  Literal,
  LtlNode,
  PredicateCall,
  RelationMembership,
  TimeAmount,
  TypedVariable,
  VariableRef,
} from './ast.js';
import { tokenize, type LtlToken } from './lexer.js';

export interface LtlParseError {
  readonly message: string;
  readonly pos: number;
}

export interface LtlParseResult {
  readonly value: LtlNode | null;
  readonly errors: readonly LtlParseError[];
}

const COMPARATORS = new Set(['==', '!=', '>=', '<=', '>', '<']);

class Parser {
  private tokens: readonly LtlToken[];
  private i = 0;
  errors: LtlParseError[] = [];

  constructor(text: string) {
    this.tokens = tokenize(text);
  }

  peek(): LtlToken {
    return this.tokens[this.i]!;
  }

  private isId(text: string): boolean {
    const t = this.peek();
    return t.type === 'id' && t.text === text;
  }

  private isSymbol(text: string): boolean {
    const t = this.peek();
    return t.type === 'symbol' && t.text === text;
  }

  private isOneOfId(...texts: readonly string[]): boolean {
    const t = this.peek();
    return t.type === 'id' && texts.includes(t.text);
  }

  private isOneOfSymbol(...texts: readonly string[]): boolean {
    const t = this.peek();
    return t.type === 'symbol' && texts.includes(t.text);
  }

  private advance(): LtlToken {
    const t = this.peek();
    if (t.type !== 'eof') this.i++;
    return t;
  }

  private fail(message: string): never {
    throw { message, pos: this.peek().pos } satisfies LtlParseError;
  }

  private expectId(text: string): void {
    if (!this.isId(text)) this.fail(`Expected "${text}"`);
    this.advance();
  }

  private expectSymbol(text: string): void {
    if (!this.isSymbol(text)) this.fail(`Expected "${text}"`);
    this.advance();
  }

  private readId(): string {
    const t = this.peek();
    if (t.type !== 'id') this.fail('Expected a name');
    this.advance();
    return t.text;
  }

  mark(): number {
    return this.i;
  }

  reset(mark: number): void {
    this.i = mark;
  }

  // -------------------------------------------------------------------
  // the precedence chain, each level's binary/unary alternatives tried in
  // the PEG's own order
  // -------------------------------------------------------------------

  parseFormula(): LtlNode {
    return this.parseQuantified();
  }

  private parseQuantified(): LtlNode {
    const sugar = this.isOneOfId('forall', 'exists');
    const symbolic = this.isOneOfSymbol('∀', '∃');
    if (!sugar && !symbolic) return this.parseStrongBinary();
    const kind =
      this.isOneOfId('forall') || this.isOneOfSymbol('∀') ? 'forall' : 'exists';
    const surface = sugar ? 'sugar' : 'symbolic';
    this.advance();
    const variables: TypedVariable[] = [this.parseTypedVariable()];
    while (this.isSymbol(',')) {
      this.advance();
      variables.push(this.parseTypedVariable());
    }
    if (this.isSymbol('.') || this.isSymbol('·') || this.isSymbol('∙'))
      this.advance();
    else this.fail('Expected "." (or "·"/"∙")');
    const body = this.parseFormula();
    return kind === 'forall'
      ? { kind: 'forall', variables, body, surface }
      : { kind: 'exists', variables, body, surface };
  }

  private parseTypedVariable(): TypedVariable {
    const name = this.readId();
    this.expectSymbol(':');
    const type = this.readId();
    return { name, type };
  }

  private parseStrongBinary(): LtlNode {
    if (!this.isId('when')) return this.parseBinary();
    this.advance();
    const left = this.parseBinary();
    this.expectId('then');
    const right = this.parseFormula();
    return { kind: 'strongImplies', left, right };
  }

  private parseBinary(): LtlNode {
    if (this.isId('if')) {
      this.advance();
      const left = this.parseTemporalBinary();
      this.expectId('then');
      const right = this.parseFormula();
      return { kind: 'implies', left, right, surface: 'sugar' };
    }
    const left = this.parseTemporalBinary();
    if (this.isId('iff') || this.isSymbol('⇔')) {
      const surface = this.isId('iff') ? 'sugar' : 'symbolic';
      this.advance();
      const right = this.parseFormula();
      return { kind: 'iff', left, right, surface };
    }
    if (this.isSymbol('⇒')) {
      this.advance();
      const right = this.parseFormula();
      return { kind: 'implies', left, right, surface: 'symbolic' };
    }
    return left;
  }

  private parseTemporalBinary(): LtlNode {
    const left = this.parseAnd();
    if (this.isId('until') || this.isId('U')) {
      this.advance();
      const bound = this.tryParseEventuallyStyleBound();
      const right = this.parseFormula();
      return { kind: 'until', left, right, bound, surface: 'sugar' };
    }
    if (this.isId('release') || this.isId('R')) {
      const surface = this.isId('R') ? 'symbolic' : 'sugar';
      this.advance();
      const right = this.parseFormula();
      return { kind: 'release', left, right, surface };
    }
    const mark = this.mark();
    const bound = this.tryParseGloballyStyleBound();
    if (this.isId('unless') || this.isId('W')) {
      const surface = this.isId('W') ? 'symbolic' : 'sugar';
      this.advance();
      const right = this.parseFormula();
      return { kind: 'weakUntil', left, right, bound, surface };
    }
    if (bound) this.reset(mark);
    return left;
  }

  private parseAnd(): LtlNode {
    const left = this.parseOr();
    if (this.isId('and') || this.isSymbol('∧')) {
      const surface = this.isId('and') ? 'sugar' : 'symbolic';
      this.advance();
      const right = this.parseFormula();
      return { kind: 'and', left, right, surface };
    }
    return left;
  }

  private parseOr(): LtlNode {
    const left = this.parseUnary();
    if (this.isId('or') || this.isSymbol('∨')) {
      const surface = this.isId('or') ? 'sugar' : 'symbolic';
      this.advance();
      const right = this.parseFormula();
      return { kind: 'or', left, right, surface };
    }
    return left;
  }

  private parseUnary(): LtlNode {
    if (this.isId('not') || this.isSymbol('¬')) {
      const surface = this.isId('not') ? 'sugar' : 'symbolic';
      this.advance();
      return { kind: 'not', expr: this.parseUnary(), surface };
    }
    if (this.isId('next') || this.isSymbol('○')) {
      const surface = this.isId('next') ? 'sugar' : 'symbolic';
      this.advance();
      return { kind: 'next', expr: this.parseUnary(), surface };
    }
    if (this.isSymbol('●')) {
      this.advance();
      return { kind: 'previous', expr: this.parseUnary() };
    }
    if (this.isOneOfId('sooner-or-later', 'eventually') || this.isSymbol('◇')) {
      const surface = this.isSymbol('◇') ? 'symbolic' : 'sugar';
      this.advance();
      const bound = this.tryParseEventuallyStyleBound();
      return { kind: 'eventually', expr: this.parseUnary(), bound, surface };
    }
    if (this.isSymbol('♦')) {
      this.advance();
      return { kind: 'once', expr: this.parseUnary() };
    }
    if (this.isOneOfId('always', 'globally') || this.isSymbol('□')) {
      const surface = this.isSymbol('□') ? 'symbolic' : 'sugar';
      this.advance();
      const bound = this.tryParseGloballyStyleBound();
      return { kind: 'always', expr: this.parseUnary(), bound, surface };
    }
    if (this.isSymbol('■')) {
      this.advance();
      const bound = this.tryParseGloballyStyleBound();
      return { kind: 'historically', expr: this.parseUnary(), bound };
    }
    return this.parseAtomPostfix();
  }

  // -------------------------------------------------------------------
  // bounds: sugar's `, before, 2 minutes,` / `, for more than, 2 minutes,`
  // (EventuallyBound/GloballyBound, GoalModelParser.peg:214-236), or the
  // symbolic `≤d`/`≥d` immediately after the operator
  // -------------------------------------------------------------------

  private tryParseSymbolicBound(): Bound | undefined {
    if (!this.isOneOfSymbol('≤', '≥')) return undefined;
    const comparator = this.isSymbol('≤') ? '<=' : '>=';
    this.advance();
    const duration = this.parseTimeConstraint();
    return { surface: 'symbolic', strictly: false, comparator, duration };
  }

  private tryParseEventuallyStyleBound(): Bound | undefined {
    const symbolic = this.tryParseSymbolicBound();
    if (symbolic) return symbolic;
    if (!this.isSymbol(',')) return undefined;
    const mark = this.mark();
    this.advance();
    let strictly = false;
    if (this.isId('strictly')) {
      this.advance();
      strictly = true;
    }
    let qualifier: 'before' | 'after' | 'in' | undefined;
    if (this.isId('before')) {
      this.advance();
      qualifier = 'before';
    } else if (this.isId('after')) {
      this.advance();
      qualifier = 'after';
    } else if (this.isId('in')) {
      this.advance();
      qualifier = 'in';
    } else {
      this.reset(mark);
      return undefined;
    }
    const duration = this.parseTimeConstraint();
    this.expectSymbol(',');
    return { surface: 'sugar', qualifier, strictly, duration };
  }

  private tryParseGloballyStyleBound(): Bound | undefined {
    const symbolic = this.tryParseSymbolicBound();
    if (symbolic) return symbolic;
    if (!this.isSymbol(',')) return undefined;
    const mark = this.mark();
    this.advance();
    if (!this.isId('for')) {
      this.reset(mark);
      return undefined;
    }
    this.advance();
    let strictly = false;
    if (this.isId('strictly')) {
      this.advance();
      strictly = true;
    }
    let qualifier: 'moreThan' | 'lessThan' | undefined;
    if (this.isId('more')) {
      this.advance();
      qualifier = 'moreThan';
      this.expectId('than');
    } else if (this.isId('less')) {
      this.advance();
      qualifier = 'lessThan';
      this.expectId('than');
    }
    const duration = this.parseTimeConstraint();
    this.expectSymbol(',');
    return { surface: 'sugar', qualifier, strictly, duration };
  }

  private parseTimeConstraint(): readonly TimeAmount[] {
    const amounts: TimeAmount[] = [this.parseTimeAmount()];
    while (this.peek().type === 'number') amounts.push(this.parseTimeAmount());
    return amounts;
  }

  private parseTimeAmount(): TimeAmount {
    const t = this.peek();
    if (t.type !== 'number') this.fail('Expected a duration (e.g. 2 minutes)');
    this.advance();
    const unit = this.readId();
    return { amount: Number(t.text), unit };
  }

  // -------------------------------------------------------------------
  // atoms: `@P` postfix, parenthesised groups, relation membership,
  // comparisons, predicate calls, attribute access, bare names, literals
  // -------------------------------------------------------------------

  private parseAtomPostfix(): LtlNode {
    let node = this.parseAtom();
    while (this.isSymbol('@')) {
      this.advance();
      const label = this.readId();
      node = { kind: 'atLabel', expr: node, label };
    }
    return node;
  }

  private parseAtom(): LtlNode {
    if (this.isSymbol('(')) {
      const relation = this.tryParseRelationMembership();
      if (relation) return relation;
      this.advance();
      const inner = this.parseFormula();
      this.expectSymbol(')');
      return { kind: 'paren', expr: inner };
    }
    const term = this.parseTerm();
    if (this.peek().type === 'symbol' && COMPARATORS.has(this.peek().text)) {
      const operator = this.advance().text as ComparisonOperator;
      const right = this.parseTerm();
      const node: Comparison = {
        kind: 'comparison',
        left: term,
        operator,
        right,
      };
      return node;
    }
    return term;
  }

  private tryParseRelationMembership(): RelationMembership | undefined {
    const mark = this.mark();
    this.advance(); // '('
    const args: string[] = [];
    if (this.peek().type !== 'id') {
      this.reset(mark);
      return undefined;
    }
    args.push(this.readId());
    while (this.isSymbol(',')) {
      this.advance();
      if (this.peek().type !== 'id') {
        this.reset(mark);
        return undefined;
      }
      args.push(this.readId());
    }
    if (!this.isSymbol(')')) {
      this.reset(mark);
      return undefined;
    }
    this.advance();
    if (!this.isId('in')) {
      this.reset(mark);
      return undefined;
    }
    this.advance();
    const relation = this.readId();
    return { kind: 'relationMembership', args, relation };
  }

  private parseTerm(): LtlNode {
    const t = this.peek();
    if (t.type === 'string') {
      this.advance();
      const unquoted = t.text.startsWith('"') ? t.text.slice(1) : t.text;
      const value = unquoted.endsWith('"') ? unquoted.slice(0, -1) : unquoted;
      return { kind: 'literal', value } satisfies Literal;
    }
    if (t.type === 'number') {
      this.advance();
      return { kind: 'literal', value: Number(t.text) } satisfies Literal;
    }
    if (t.type === 'id') {
      if (t.text === 'true' || t.text === 'false') {
        this.advance();
        return { kind: 'literal', value: t.text === 'true' } satisfies Literal;
      }
      const name = this.readId();
      if (this.isSymbol('(')) {
        this.advance();
        const args: string[] = [];
        if (this.peek().type === 'id') {
          args.push(this.readId());
          while (this.isSymbol(',')) {
            this.advance();
            args.push(this.readId());
          }
        }
        this.expectSymbol(')');
        return { kind: 'predicateCall', name, args } satisfies PredicateCall;
      }
      if (this.isSymbol('.')) {
        this.advance();
        const attribute = this.readId();
        return {
          kind: 'attributeAccess',
          variable: name,
          attribute,
        } satisfies AttributeAccess;
      }
      return { kind: 'variableRef', name } satisfies VariableRef;
    }
    this.fail('Expected a name, a number, a string or "("');
  }
}

/**
 * Parses an LTL formula (either surface). `errors` is empty and `value` set
 * on success; on a syntax error, `value` is null (the text is still written
 * back unchanged — the goal-language's `formula` value never parse-fails a
 * document, ../notation/values.ts turns a non-empty `errors` into a Problem).
 */
export const parseLtl = (text: string): LtlParseResult => {
  const parser = new Parser(text);
  try {
    const value = parser.parseFormula();
    if (parser.peek().type !== 'eof') {
      return {
        value: null,
        errors: [
          {
            message: `Unexpected "${parser.peek().text}"`,
            pos: parser.peek().pos,
          },
        ],
      };
    }
    return { value, errors: [] };
  } catch (e) {
    const error = e as LtlParseError;
    return { value: null, errors: [error] };
  }
};
