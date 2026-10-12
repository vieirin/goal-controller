/**
 * The rule layer (goal-controller#74): Datalog rules run on Nemo, knowing no
 * engine. An engine's reader turns its files into facts (the core relations
 * of `core.rls`, and its own); its rule file adds what its files mean. The
 * rules are prepared once (parsed and planned); each evaluation loads the
 * facts as rows, reasons, and reads the problems and resolutions.
 *
 * Nemo is passed in, not imported: its Node build (tests, the CLI) or its
 * web build (the workbench's worker) alike.
 */
import CORE_RULES from './core.rules';

export { CORE_RULES };

/** A fact's value: a string, a number or a boolean. */
export type FactValue = string | number | boolean;

/** What the layer uses of Nemo's prepared program (`nemo-wasm`'s NemoProgram). */
export type NemoEngineLike = {
  addFacts(predicate: string, rows: FactValue[][]): void;
  reason(): Promise<void>;
  getResultRows(predicate: string): Promise<unknown[][]>;
  free(): void;
};
export type NemoProgramLike = {
  createEngine(): Promise<NemoEngineLike>;
  free(): void;
};
/** `nemo-wasm`'s module, or what of it the layer uses. */
export type NemoModule = {
  NemoProgram: new (text: string) => NemoProgramLike;
};

/** The relations an evaluation reads back. */
const OUTPUTS = ['problem', 'resolves', 'rename_conflict'] as const;

/** Rules prepared once: the core's and the engines' rule files. */
export type PreparedRules = {
  program: NemoProgramLike;
  /** the rule text Nemo prepared */
  text: string;
  free(): void;
};

/** Prepares the core rules with the engines' rule files (Nemo parses and plans them once). */
export const prepareRules = (
  nemo: NemoModule,
  ruleFiles: readonly string[] = [],
): PreparedRules => {
  const text = [
    CORE_RULES,
    ...ruleFiles,
    ...OUTPUTS.map((relation) => `@output ${relation} .`),
  ].join('\n');
  const program = new nemo.NemoProgram(text);
  return { program, text, free: () => program.free() };
};

/** Facts as rows, by relation: what a reader gives. */
export class FactSet {
  readonly rows = new Map<string, FactValue[][]>();

  add(relation: string, ...values: FactValue[]): this {
    let rows = this.rows.get(relation);
    if (!rows) this.rows.set(relation, (rows = []));
    rows.push(values);
    return this;
  }

  /** Another set's facts too. */
  addAll(other: FactSet): this {
    for (const [relation, rows] of other.rows)
      for (const row of rows) this.add(relation, ...row);
    return this;
  }

  get size(): number {
    let size = 0;
    for (const rows of this.rows.values()) size += rows.length;
    return size;
  }
}

/** A problem the rules found: `problem(Id, Severity, Check, Detail)`. */
export type RuleProblem = {
  /** the definition or reference it is about */
  id: string;
  severity: 'error' | 'warning' | 'info';
  check: string;
  detail: string;
};

/** What a reference resolves to: `resolves(R, S)`. */
export type Resolution = { reference: string; definition: string };

export type Evaluation = {
  problems: RuleProblem[];
  resolves: Resolution[];
  /** for a rename's check: the definitions the new name clashes with */
  renameConflicts: string[];
  /** where the time went, in ms */
  timings: { engine: number; facts: number; reason: number; read: number };
};

const SEVERITIES = new Set(['error', 'warning', 'info']);
const now = () => performance.now();

/** The prepared rules on these facts: one engine, freed when done. */
export const evaluateRules = async (
  rules: PreparedRules,
  facts: FactSet,
): Promise<Evaluation> => {
  let at = now();
  const engine = await rules.program.createEngine();
  const timings = { engine: now() - at, facts: 0, reason: 0, read: 0 };
  try {
    at = now();
    for (const [relation, rows] of facts.rows) engine.addFacts(relation, rows);
    timings.facts = now() - at;
    at = now();
    await engine.reason();
    timings.reason = now() - at;
    at = now();
    const [problemRows, resolvesRows, conflictRows] = await Promise.all(
      OUTPUTS.map((relation) => engine.getResultRows(relation)),
    );
    timings.read = now() - at;
    // a row derived twice (a symmetric rule) is one problem
    const seen = new Set<string>();
    const problems: RuleProblem[] = [];
    for (const [id, severity, check, detail] of problemRows!.map((row) =>
      row.map(String),
    )) {
      const key = `${id}\u0000${severity}\u0000${check}\u0000${detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      problems.push({
        id: id!,
        severity: (SEVERITIES.has(severity!)
          ? severity
          : 'error') as RuleProblem['severity'],
        check: check!,
        detail: detail!,
      });
    }
    return {
      problems,
      resolves: resolvesRows!.map(([reference, definition]) => ({
        reference: String(reference),
        definition: String(definition),
      })),
      renameConflicts: conflictRows!.map(([definition]) => String(definition)),
      timings,
    };
  } finally {
    engine.free();
  }
};

/**
 * Whether renaming a definition to a new name (as its kind compares it)
 * clashes: the definitions of its kind, in its scope, already named so.
 */
export const renameConflicts = async (
  rules: PreparedRules,
  facts: FactSet,
  definition: string,
  newKey: string,
): Promise<string[]> =>
  (
    await evaluateRules(
      rules,
      new FactSet().addAll(facts).add('rename_request', definition, newKey),
    )
  ).renameConflicts;
