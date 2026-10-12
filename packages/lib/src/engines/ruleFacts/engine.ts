/**
 * An engine on the rule layer (goal-controller#75): the kinds it defines, its
 * rule files (beside the core's), its checks' messages, and the reader that
 * makes its project's files into facts. A project is evaluated with the core
 * rules and its engine's, prepared once per engine; the problems come back
 * as diagnostics, located where the facts were read.
 */
import type { GoalView } from '@goal-controller/goal-tree';
import {
  evaluateRules,
  prepareRules,
  type NemoModule,
  type PreparedRules,
  type RuleProblem,
} from '../../rules';
import {
  collectFacts,
  type DocumentFacts,
  type KindDefinition,
  type ReadFacts,
  type RuleLocation,
} from './facts';

/** What an engine reads: the open model's view, the project's other models, its resources' texts. */
export type RuleProject = {
  model?: GoalView;
  /** MutRoSe: the project's other goal models (a shared domain) */
  otherModels?: readonly { path: string; view: GoalView }[];
  resources: readonly { kind: string; path: string; text: string }[];
};

export type EngineRules = {
  engine: string;
  kinds: Readonly<Record<string, KindDefinition>>;
  /** its rule files (Nemo's Datalog), beside the core's */
  ruleFiles: readonly string[];
  /** a check's message: `{name}` the name where it is, `{detail}` the problem's detail */
  messages: Readonly<Record<string, string>>;
  read(project: RuleProject): DocumentFacts[];
};

/** A problem where it is written, with its message. */
export type RuleDiagnostic = {
  location: RuleLocation;
  severity: RuleProblem['severity'];
  check: string;
  message: string;
  /** an unresolved reference's kinds (what it may name) */
  kinds?: readonly string[];
};

/** The core's checks' messages. */
const CORE_MESSAGES = {
  ambiguous: '`{name}` names more than one definition',
} as const;

const prepared = new WeakMap<NemoModule, Map<string, PreparedRules>>();

/** An engine's rules, prepared once per Nemo module. */
export const rulesFor = (
  nemo: NemoModule,
  engine: EngineRules,
): PreparedRules => {
  let byEngine = prepared.get(nemo);
  if (!byEngine) prepared.set(nemo, (byEngine = new Map()));
  let rules = byEngine.get(engine.engine);
  if (!rules)
    byEngine.set(engine.engine, (rules = prepareRules(nemo, engine.ruleFiles)));
  return rules;
};

/** A project's facts, as the engine reads them. */
export const readProject = (
  engine: EngineRules,
  project: RuleProject,
): ReadFacts => collectFacts(engine.kinds, engine.read(project));

/** Problems as diagnostics: located by their ids, with their messages. */
export const diagnosticsOf = (
  engine: EngineRules,
  read: ReadFacts,
  problems: readonly RuleProblem[],
): RuleDiagnostic[] =>
  problems.flatMap(({ id, severity, check, detail }) => {
    const location = read.locations.get(id);
    if (!location) return [];
    const name = read.names.get(id) ?? '';
    const message =
      check === 'unresolved'
        ? `No ${[
            ...new Set(
              (read.referenceKinds.get(id) ?? []).map(
                (kind) => engine.kinds[kind]?.label ?? kind,
              ),
            ),
          ].join(' or ')} named \`${name}\``
        : (
            engine.messages[check] ??
            CORE_MESSAGES[check as keyof typeof CORE_MESSAGES] ??
            check
          )
            .replace(/\{name\}/g, name)
            .replace(/\{detail\}/g, detail);
    const kinds = read.referenceKinds.get(id);
    return [
      {
        location,
        severity,
        check,
        message,
        ...(check === 'unresolved' && kinds && { kinds }),
      },
    ];
  });

/** A project's diagnostics: its facts read, its engine's rules run. */
export const checkProject = async (
  nemo: NemoModule,
  engine: EngineRules,
  project: RuleProject,
) => {
  const read = readProject(engine, project);
  const evaluation = await evaluateRules(rulesFor(nemo, engine), read.facts);
  return {
    read,
    evaluation,
    diagnostics: diagnosticsOf(engine, read, evaluation.problems),
  };
};
