/**
 * MutRoSe's property checks, ported from the decomposer's goal model readers
 * (`utils/gm_utils.cpp`), with their messages. They read the values with
 * MutRoSe's language (./language), whose shapes accept what the decomposer's
 * regexes do; the mapper reads the values with the same functions.
 */
import { readProperties } from '@goal-controller/goal-language';
import { checks, type Check, type CheckContext } from '../checks';
import { mutrose } from './definition';
import {
  readCreationCondition,
  readForAll,
  readNames,
  readRobotNumber,
  readSelect,
  readVariableItems,
  classOfType,
} from './language';
import type { MutroseConfiguration } from './projectResources/configuration';
import type { MutroseGoalType } from './types';
import type { WorldKnowledge } from './projectResources/world';
import {
  depthFirst,
  forAllProblem,
  queryProblem,
  scopeIssues,
  type ScopeIssue,
} from './scope';

/** A variable, `name : Type`; Monitors usually omit the type. */
export type MutroseVar = { name: string; type: string };

/**
 * `parse_vars`: comma-separated `name[ : Type]`, `Sequence(T)` for a
 * collection; leniently, as the decomposer (an item's first word, the rest
 * ignored), so a name may be empty.
 */
export const parseVars = (text: string): MutroseVar[] =>
  readVariableItems(text).map(({ name, type }) => ({
    name: name?.name ?? '',
    type,
  }));

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
/** A names list's items, as written (spaces around them aside), names or not. */
const names = (text: string | undefined): string[] =>
  readNames(text ?? '').value.map(({ item }) => item.text);

// ---------------------------------------------------------------------------
// the project's resources (goal-controller#25): what the world and the
// configuration say, when the project has them
// ---------------------------------------------------------------------------

const worldOf = (context: CheckContext): WorldKnowledge | undefined =>
  context.projectResources?.world?.data as WorldKnowledge | undefined;
const configurationOf = (
  context: CheckContext,
): MutroseConfiguration | undefined =>
  context.projectResources?.configuration?.data as
    | MutroseConfiguration
    | undefined;

/** What is wrong with a type, given the world: not one of its classes. */
const typeProblem = (type: string, context: CheckContext): string | null => {
  const world = worldOf(context);
  const name = classOfType(type);
  if (!world || !name || name in world.classes) return null;
  const known = Object.keys(world.classes);
  return `${name} is not a class of the world knowledge${known.length ? ` (it has ${known.join(', ')})` : ''}`;
};

/** The type a variable is declared with, by any element's Controls. */
const declaredType = (
  name: string,
  context: CheckContext,
): string | undefined => {
  for (const element of Object.values(context.elements ?? {}))
    for (const declared of vars(element.properties.Controls))
      if (declared.name === name && declared.type) return declared.type;
  return undefined;
};

/**
 * A variable list's check: each item names a variable; then, in a model, a
 * Monitors variable an earlier goal declared, a Controls one declared once;
 * then, with the world, a declared type is one of its classes.
 */
const varsCheck =
  (key: 'Controls' | 'Monitors'): Check =>
  ({ raw }, context) => {
    const text = raw[key] ?? '';
    if (!text.trim()) return null;
    // the decomposer quotes the item as written, between its commas
    const bad = readVariableItems(text).find(({ name }) => !name);
    if (bad) return `Invalid variable declaration ${bad.item.text} in GM.`;
    return (
      scopeProblem(context, key) ??
      vars(text)
        .map(({ type }) => typeProblem(type, context))
        .find((problem) => problem !== null) ??
      null
    );
  };

export type ForAll = { iterated: string; iteration: string; condition: string };

/**
 * `parse_forAll_expr` (`forall_regex_exp`): `coll->forAll(it | condition)`,
 * what it iterates over, with which variable, and its condition. Strict as
 * the decomposer's regex: no space but before the pipe, the condition any
 * text on one line.
 */
export const parseForAll = (text: string): ForAll | null => {
  const forAll = readForAll(text).value;
  return forAll
    ? {
        iterated: forAll.iterated.name,
        iteration: forAll.iteration.name,
        condition: forAll.condition.text,
      }
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
 * what a query reads, its variable and type, and its condition. Strict as
 * the decomposer's regex: `v:Type` with no spaces, a type of two characters
 * at least.
 */
export const parseSelect = (text: string): Select | null => {
  const select = readSelect(text).value;
  return select
    ? {
        source: select.source.name,
        variable: select.variable.name,
        type: select.type.name,
        condition: select.condition.text,
      }
    : null;
};

/** `parse_robot_number`: `N` or `[lo,hi]`, no spaces. */
export const parseRobotNumber = (
  text: string,
): number | [number, number] | null => readRobotNumber(text).value;

/**
 * `CreationCondition`: `assertion condition "expr"` or `assertion trigger
 * "Event"`, its words in any case. The decomposer does not read the
 * condition's OCL here: neither does the check.
 */
export const parseCreationCondition = (
  text: string,
): { kind: 'condition' | 'trigger'; value: string } | null => {
  const condition = readCreationCondition(text).value;
  return condition
    ? { kind: condition.kind, value: condition.value.text }
    : null;
};

/**
 * A goal's GoalType as MutRoSe's dialect reads it (the mapper's
 * `props.GoalType`): one of its options, or unset.
 */
const goalTypeOf = (
  raw: Partial<Record<string, string>>,
): MutroseGoalType | null | undefined =>
  raw.GoalType === undefined
    ? undefined
    : readProperties(mutrose, { element: 'goal' }, { GoalType: raw.GoalType })
        .values.GoalType;

/**
 * The checks the MutRoSe definition names, by name: the one place the names
 * are written.
 */
export const mutroseCheckRegistry = checks({
  'mutrose.goal.controls': varsCheck('Controls'),
  'mutrose.goal.monitors': varsCheck('Monitors'),
  'mutrose.goal.achieveCondition': ({ raw }, { self }) => {
    const text = raw.AchieveCondition ?? '';
    // the decomposer reads a forAll by the word, then requires its shape
    if (!text.includes('forAll')) return null;
    const forAll = parseForAll(text);
    if (!forAll) return `Invalid forAll statement ${text} in GM.`;
    return goalTypeOf(raw) === 'Achieve'
      ? forAllProblem(self, forAll, vars(raw.Monitors), vars(raw.Controls))
      : null;
  },
  'mutrose.goal.queriedProperty': ({ raw }, context) => {
    const { self } = context;
    const text = raw.QueriedProperty ?? '';
    if (!text) return null;
    const query = parseSelect(text);
    if (!query) return `Invalid select statement ${text} in GM.`;
    return (
      (goalTypeOf(raw) === 'Query'
        ? queryProblem(self, query, vars(raw.Controls))
        : null) ?? typeProblem(query.type, context)
    );
  },
  // the decomposer ignores any other text; the editors say what it reads
  'mutrose.goal.creationCondition': ({ raw }) => {
    const text = raw.CreationCondition ?? '';
    return text.trim() && !parseCreationCondition(text)
      ? 'A CreationCondition is assertion condition "expr" or assertion trigger "Event"'
      : null;
  },
  'mutrose.task.location': ({ raw }, context) => {
    const text = raw.Location ?? '';
    if (!text.trim()) return null;
    const [location, ...more] = readNames(text).value;
    const name = !more.length && location?.name?.name;
    if (!name) return `A Location is one variable name, not ${text.trim()}`;
    // with the configuration: the variable's class is one of its location types
    const locations = configurationOf(context)?.locationTypes ?? [];
    const type = declaredType(name, context);
    const typeClass = type && (classOfType(type) ?? type);
    return locations.length && typeClass && !locations.includes(typeClass)
      ? `${name} is a ${typeClass}: a Location is one of the configuration's location types (${locations.join(', ')})`
      : null;
  },
  'mutrose.task.params': ({ raw }, context) => {
    const text = raw.Params ?? '';
    if (!text.trim()) return null;
    const bad = readNames(text).value.find(({ name }) => !name);
    return bad
      ? `Params are variable names, comma-separated: not ${bad.item.text || 'an empty name'}`
      : scopeProblem(context, 'Params');
  },
  'mutrose.task.robotNumber': ({ raw }) => {
    const text = raw.RobotNumber ?? '';
    return text && parseRobotNumber(text) === null
      ? `Invalid declaration of robot number: ${text}`
      : null;
  },
});

/** The names of MutRoSe's checks: what a property's `check` may be. */
export type MutroseCheckName = keyof typeof mutroseCheckRegistry;
