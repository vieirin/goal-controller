/**
 * MutRoSe's property checks, ported from the decomposer's goal model readers
 * (`utils/gm_utils.cpp`), with their messages. They also parse: the mapper
 * reads the values with the same functions.
 */
import { checks, type Check, type CheckContext } from '../checks';
import {
  depthFirst,
  forAllProblem,
  queryProblem,
  scopeIssues,
  type ScopeIssue,
} from './scope';

/** A variable, `name : Type`; Monitors usually omit the type. */
export type MutroseVar = { name: string; type: string };

/** `parse_vars`: comma-separated `name[ : Type]`, `Sequence(T)` for a collection. */
export const parseVars = (text: string): MutroseVar[] =>
  text.split(',').map((item) => {
    const [name = '', type = ''] = item.split(':');
    return {
      name: /[A-Za-z][A-Za-z0-9_]*/.exec(name)?.[0] ?? '',
      type: /[A-Za-z0-9]+(\([A-Za-z]+\))?/.exec(type)?.[0] ?? '',
    };
  });

type Elements = NonNullable<CheckContext['elements']>;

/**
 * The model's scoping problems (`./scope`), walked from what an editor has:
 * every element's raw properties, children and diagram x. Once per model.
 */
const scopeOfModel = new WeakMap<Elements, ScopeIssue[]>();
const scopeOf = (elements: Elements): ScopeIssue[] => {
  const known = scopeOfModel.get(elements);
  if (known) return known;
  const ids = Object.keys(elements);
  const children = new Set(ids.flatMap((id) => elements[id]!.children));
  const issues = scopeIssues(
    depthFirst(
      ids.filter((id) => !children.has(id) && elements[id]!.kind === 'goal'),
      (id) => elements[id]?.children ?? [],
      (id) => elements[id]?.x,
    ).flatMap((id) => {
      const element = elements[id];
      if (element?.kind !== 'goal' && element?.kind !== 'task') return [];
      const { properties } = element;
      return [
        {
          id,
          kind: element.kind,
          controls: vars(properties.Controls),
          monitors: vars(properties.Monitors),
          params: names(properties.Params),
        },
      ];
    }),
  );
  scopeOfModel.set(elements, issues);
  return issues;
};

/** The element's problem of a key in the model's scoping, when the caller has the model. */
const scopeProblem = (
  context: CheckContext,
  key: ScopeIssue['key'],
): string | null =>
  context.elements
    ? (scopeOf(context.elements).find(
        (issue) => issue.id === context.self && issue.key === key,
      )?.message ?? null)
    : null;

const vars = (text: string | undefined): MutroseVar[] =>
  text?.trim() ? parseVars(text) : [];
const names = (text: string | undefined): string[] =>
  text?.trim() ? text.split(',').map((name) => name.trim()) : [];

/**
 * A variable list's check: each item names a variable; then, in a model, a
 * Monitors variable an earlier goal declared, a Controls one declared once.
 */
const varsCheck =
  (key: 'Controls' | 'Monitors'): Check =>
  (raw, context) => {
    const text = raw[key] ?? '';
    if (!text.trim()) return null;
    const bad = text.split(',').find((item) => !parseVars(item)[0]!.name);
    return bad !== undefined
      ? `Invalid variable declaration ${bad} in GM.`
      : scopeProblem(context, key);
  };

export type ForAll = { iterated: string; iteration: string; condition: string };

/**
 * `parse_forAll_expr` (`forall_regex_exp`): `coll->forAll(it | condition)`,
 * what it iterates over, with which variable, and its condition.
 */
export const parseForAll = (text: string): ForAll | null => {
  const match =
    /^([a-zA-Z]+[\w.]*)->forAll\(([a-zA-Z]+[\w.]*)[ ]*\|(.*)\)$/.exec(text);
  return match
    ? { iterated: match[1]!, iteration: match[2]!, condition: match[3]! }
    : null;
};

export type Select = {
  source: string;
  variable: string;
  type: string;
  condition: string;
};

/**
 * `parse_select_expr` (`select_regex_exp`): `source->select(v:Type | condition)`,
 * what a query reads, its variable and type, and its condition.
 */
export const parseSelect = (text: string): Select | null => {
  const match =
    /^([a-zA-Z][\w.]*)->select\(([a-zA-Z][\w.]*):([a-zA-Z]+[\w.]+)[ ]*\|[ ]*(.*)\)$/.exec(
      text,
    );
  return match
    ? {
        source: match[1]!,
        variable: match[2]!,
        type: match[3]!,
        condition: match[4]!,
      }
    : null;
};

/** `parse_robot_number`: `N` or `[lo,hi]`, no spaces. */
export const parseRobotNumber = (
  text: string,
): number | [number, number] | null => {
  const range = /^\[(\d+),(\d+)\]$/.exec(text);
  if (range) return [Number(range[1]), Number(range[2])];
  return /^\d+$/.test(text) ? Number(text) : null;
};

/** `CreationCondition`: `assertion condition "expr"` or `assertion trigger "Event"`. */
export const parseCreationCondition = (
  text: string,
): { kind: 'condition' | 'trigger'; value: string } | null => {
  const match = /^\s*assertion\s+(condition|trigger)\s+"([^"]*)"\s*$/i.exec(
    text,
  );
  return match
    ? {
        kind: match[1]!.toLowerCase() as 'condition' | 'trigger',
        value: match[2]!,
      }
    : null;
};

const IDENTIFIER = /^\s*[A-Za-z][A-Za-z0-9_]*\s*$/;

/**
 * The checks the MutRoSe definition names, by name: the one place the names
 * are written.
 */
export const mutroseCheckRegistry = checks({
  'mutrose.goal.controls': varsCheck('Controls'),
  'mutrose.goal.monitors': varsCheck('Monitors'),
  'mutrose.goal.achieveCondition': (raw, { self }) => {
    const text = raw.AchieveCondition ?? '';
    // the decomposer reads a forAll by the word, then requires its shape
    if (!text.includes('forAll')) return null;
    const forAll = parseForAll(text);
    if (!forAll) return `Invalid forAll statement ${text} in GM.`;
    return raw.GoalType?.trim() === 'Achieve'
      ? forAllProblem(self, forAll, vars(raw.Monitors), vars(raw.Controls))
      : null;
  },
  'mutrose.goal.queriedProperty': (raw, { self }) => {
    const text = raw.QueriedProperty ?? '';
    if (!text) return null;
    const query = parseSelect(text);
    if (!query) return `Invalid select statement ${text} in GM.`;
    return raw.GoalType?.trim() === 'Query'
      ? queryProblem(self, query, vars(raw.Controls))
      : null;
  },
  // the decomposer ignores any other text; the editors say what it reads
  'mutrose.goal.creationCondition': (raw) => {
    const text = raw.CreationCondition ?? '';
    return text.trim() && !parseCreationCondition(text)
      ? 'A CreationCondition is assertion condition "expr" or assertion trigger "Event"'
      : null;
  },
  'mutrose.task.location': (raw) => {
    const text = raw.Location ?? '';
    return text.trim() && !IDENTIFIER.test(text)
      ? `A Location is one variable name, not ${text.trim()}`
      : null;
  },
  'mutrose.task.params': (raw, context) => {
    const text = raw.Params ?? '';
    if (!text.trim()) return null;
    const bad = text.split(',').find((item) => !IDENTIFIER.test(item));
    return bad !== undefined
      ? `Params are variable names, comma-separated: not ${bad.trim() || 'an empty name'}`
      : scopeProblem(context, 'Params');
  },
  'mutrose.task.robotNumber': (raw) => {
    const text = raw.RobotNumber ?? '';
    return text && parseRobotNumber(text) === null
      ? `Invalid declaration of robot number: ${text}`
      : null;
  },
});

/** The names of MutRoSe's checks: what a property's `check` may be. */
export type MutroseCheckName = keyof typeof mutroseCheckRegistry;
