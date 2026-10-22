/**
 * One AST for the `ltl`-tagged `formula` value (dialect/src/schema.ts,
 * goal-controller#211), framework-generic: a real-time LTL with two surface
 * syntaxes over one grammar, a word-based sugar (`when … then
 * sooner-or-later …`) and the symbolic RT-LTL of van Lamsweerde's RE'01
 * "Guided Tour" (`○ ● ◇ ♦ □ ■ W U`, bounded `◇≤d □≤d ■≤d`, `@P`, strong
 * `⇒`). Each node that has two spellings carries which one it was read
 * with (`Surface`), so a writer can reproduce it; see `./print.ts`.
 *
 * Provenance per operator (recorded here, not only on #189, since the paper
 * transcription — docs/papers/rt-ltl-re01.md — found RE'01 itself prints no
 * operator table; the sugar surface's source grammar, its licence, and the
 * dialect that tags a `formula` `ltl` are packages/dialect/docs/
 * frameworks.md's to name):
 * - attested in RE'01's own example formulas: `◇` (eventually), `W`
 *   (weak-until), `o`/next, bounded `■≤d`, plain `⇒`.
 * - the sugar surface's source grammar: the spelling of every operator
 *   below that has one, plus `release` (dual of until, no RE'01
 *   attestation — kept since a sugar corpus may use it, even though the
 *   stress corpus here does not).
 * - the standard real-time LTL operator set #211's issue text lists, not
 *   attested in RE'01's own text: `●` (previously), `♦` (once,
 *   past-eventually), `□` (always, unbounded), bare `■` (historically,
 *   unbounded), bounded `◇≤d`/`□≤d`, `@P`, strong `⇒`, `⇔`.
 */

/** which spelling a node was read with; a writer reuses it */
export type Surface = 'sugar' | 'symbolic';

export interface TypedVariable {
  readonly name: string;
  readonly type: string;
}

/** one `<number> <unit>` pair of a duration (`2 minutes`, `30 s`); one or more make a `TimeConstraint` */
export interface TimeAmount {
  readonly amount: number;
  readonly unit: string;
}

/**
 * a time bound clause: sugar's `, before, 2 minutes,` / `, for more than, 2
 * minutes,` (the sugar grammar's `EventuallyBound`/`GloballyBound`) or the
 * symbolic `≤d`/`≥d` subscript (RE'01's `◇≤d`, `□≤d`, `■≤d`, p.9's `■≤0.5
 * sec`). `qualifier` is sugar-only; `comparator` is symbolic-only; a plain
 * `for 2 minutes` (no more/less-than) has neither.
 */
export interface Bound {
  readonly surface: Surface;
  readonly qualifier?: 'before' | 'after' | 'in' | 'moreThan' | 'lessThan';
  readonly strictly: boolean;
  readonly comparator?: '<=' | '>=';
  readonly duration: readonly TimeAmount[];
}

export type LtlNode =
  | Forall
  | Exists
  | Iff
  | Implies
  | StrongImplies
  | Or
  | And
  | Not
  | Until
  | Release
  | WeakUntil
  | Next
  | Previous
  | Eventually
  | Once
  | Always
  | Historically
  | AtLabel
  | Knows
  | Belief
  | Paren
  | Comparison
  | PredicateCall
  | RelationMembership
  | AttributeAccess
  | VariableRef
  | Literal;

export interface Forall {
  readonly kind: 'forall';
  readonly variables: readonly TypedVariable[];
  readonly body: LtlNode;
  readonly surface: Surface;
}

export interface Exists {
  readonly kind: 'exists';
  readonly variables: readonly TypedVariable[];
  readonly body: LtlNode;
  readonly surface: Surface;
}

/** `ψ iff φ` / `ψ ⇔ φ` */
export interface Iff {
  readonly kind: 'iff';
  readonly left: LtlNode;
  readonly right: LtlNode;
  readonly surface: Surface;
}

/** `if ψ then φ` / plain `ψ ⇒ φ` */
export interface Implies {
  readonly kind: 'implies';
  readonly left: LtlNode;
  readonly right: LtlNode;
  readonly surface: Surface;
}

/** `when ψ then φ`: the sugar's strong implication; no symbolic spelling is attested */
export interface StrongImplies {
  readonly kind: 'strongImplies';
  readonly left: LtlNode;
  readonly right: LtlNode;
}

export interface Or {
  readonly kind: 'or';
  readonly left: LtlNode;
  readonly right: LtlNode;
  readonly surface: Surface;
}

export interface And {
  readonly kind: 'and';
  readonly left: LtlNode;
  readonly right: LtlNode;
  readonly surface: Surface;
}

export interface Not {
  readonly kind: 'not';
  readonly expr: LtlNode;
  readonly surface: Surface;
}

/** `ψ until φ`, bounded `ψ until, before, 2 minutes, φ` / `ψ U φ`, `ψ U≤d φ` */
export interface Until {
  readonly kind: 'until';
  readonly left: LtlNode;
  readonly right: LtlNode;
  readonly bound?: Bound;
  readonly surface: Surface;
}

/** `ψ release φ` / `ψ R φ`: the sugar's dual-of-until, and its symbol; no RE'01 attestation */
export interface Release {
  readonly kind: 'release';
  readonly left: LtlNode;
  readonly right: LtlNode;
  readonly surface: Surface;
}

/** `ψ unless φ`, bounded `for 2 minutes unless` / `ψ W φ`, `ψ W≤d φ` */
export interface WeakUntil {
  readonly kind: 'weakUntil';
  readonly left: LtlNode;
  readonly right: LtlNode;
  readonly bound?: Bound;
  readonly surface: Surface;
}

/** `next φ` / `○ φ` */
export interface Next {
  readonly kind: 'next';
  readonly expr: LtlNode;
  readonly surface: Surface;
}

/** `● φ`: previously (past-next); no sugar spelling */
export interface Previous {
  readonly kind: 'previous';
  readonly expr: LtlNode;
}

/**
 * `sooner-or-later φ` / `eventually φ`, bounded, `◇ φ`, bounded `◇≤d φ`.
 * `glyph`: which codepoint a symbolic surface was read with, `◇` (U+25C7,
 * this parser's canonical spelling) or `◊` (U+25CA, the paper
 * transcriptions' verbatim FormalDef quotes, a PDF font variant of the
 * same operator, goal-controller#399) — unset for the sugar surface. A
 * writer reproduces it, not always `◇` (D4: the writer emits what it
 * read).
 */
export interface Eventually {
  readonly kind: 'eventually';
  readonly expr: LtlNode;
  readonly bound?: Bound;
  readonly surface: Surface;
  readonly glyph?: '◇' | '◊';
}

/** `♦ φ`: once (past-eventually); no sugar spelling */
export interface Once {
  readonly kind: 'once';
  readonly expr: LtlNode;
}

/** `always φ` / `globally φ`, bounded, `□ φ`, bounded `□≤d φ` */
export interface Always {
  readonly kind: 'always';
  readonly expr: LtlNode;
  readonly bound?: Bound;
  readonly surface: Surface;
}

/** `■ φ`, bounded `■≤d φ` (RE'01 p.9's one bounded example); no sugar spelling */
export interface Historically {
  readonly kind: 'historically';
  readonly expr: LtlNode;
  readonly bound?: Bound;
}

/** `φ@P`: RE'01's state-label operator; symbolic only, no sugar spelling */
export interface AtLabel {
  readonly kind: 'atLabel';
  readonly expr: LtlNode;
  readonly label: string;
}

/**
 * `Knows ag (P)` / `KnowsV ag (v)` (ICSE'04, #212): an agent-indexed
 * epistemic unary operator, attested in the paper's own formulas (its
 * `KnowsV` is the value-knowledge form, `∃x: Knows ag (x = v)`; both are
 * written directly in formulas, so both get a node rather than expanding
 * `KnowsV` away). Neither surface's `[ag]` subscript spelling is attested
 * (the paper's own PDF-to-text extraction prints the subscript with
 * inconsistent spacing, "Knows ag (P)" / "KnowsVp (…)"); the bracket here
 * is this project's own choice, matching the keyed-value spelling the
 * dialects already use elsewhere (`Probability[e1]`), documented as
 * unattested in frameworks.md.
 */
export interface Knows {
  readonly kind: 'knows';
  readonly agent: string;
  readonly expr: LtlNode;
  readonly asValue: boolean;
  readonly surface: Surface;
}

/** `Belief ag (P)` (ICSE'04, #212): "P is in agent ag's local memory"; see `Knows`'s doc for the `[ag]` spelling */
export interface Belief {
  readonly kind: 'belief';
  readonly agent: string;
  readonly expr: LtlNode;
  readonly surface: Surface;
}

/** an explicit `(…)`, kept so a writer reproduces it even where precedence wouldn't need it */
export interface Paren {
  readonly kind: 'paren';
  readonly expr: LtlNode;
}

export type ComparisonOperator = '==' | '!=' | '>=' | '<=' | '>' | '<';

export interface Comparison {
  readonly kind: 'comparison';
  readonly left: LtlNode;
  readonly operator: ComparisonOperator;
  readonly right: LtlNode;
}

/** `p(x, y)`: a predicate or function application over variables */
export interface PredicateCall {
  readonly kind: 'predicateCall';
  readonly name: string;
  readonly args: readonly string[];
}

/** `(x, y) in R` */
export interface RelationMembership {
  readonly kind: 'relationMembership';
  readonly args: readonly string[];
  readonly relation: string;
}

/** `a.b`: dotted attribute access on a variable or element */
export interface AttributeAccess {
  readonly kind: 'attributeAccess';
  readonly variable: string;
  readonly attribute: string;
}

export interface VariableRef {
  readonly kind: 'variableRef';
  readonly name: string;
}

export type LiteralValue = string | number | boolean;

export interface Literal {
  readonly kind: 'literal';
  readonly value: LiteralValue;
}
