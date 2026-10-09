/**
 * MutRoSe's property checks, ported from the decomposer's goal model readers
 * (`utils/gm_utils.cpp`), with their messages. They also parse: the mapper
 * reads the values with the same functions.
 */
import { checks, type Check } from '../checks';

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

/** A variable list's check: each item names a variable. */
const varsCheck =
  (key: 'Controls' | 'Monitors'): Check =>
  (raw) => {
    const text = raw[key] ?? '';
    if (!text.trim()) return null;
    const bad = text.split(',').find((item) => !parseVars(item)[0]!.name);
    return bad !== undefined
      ? `Invalid variable declaration ${bad} in GM.`
      : null;
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
  'mutrose.goal.achieveCondition': (raw) => {
    const text = raw.AchieveCondition ?? '';
    // the decomposer reads a forAll by the word, then requires its shape
    return text.includes('forAll') && !parseForAll(text)
      ? `Invalid forAll statement ${text} in GM.`
      : null;
  },
  'mutrose.goal.queriedProperty': (raw) => {
    const text = raw.QueriedProperty ?? '';
    return text && !parseSelect(text)
      ? `Invalid select statement ${text} in GM.`
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
  'mutrose.task.params': (raw) => {
    const text = raw.Params ?? '';
    if (!text.trim()) return null;
    const bad = text.split(',').find((item) => !IDENTIFIER.test(item));
    return bad !== undefined
      ? `Params are variable names, comma-separated: not ${bad.trim() || 'an empty name'}`
      : null;
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
