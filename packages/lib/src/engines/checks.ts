import {
  checkInputOf,
  parses,
  type CheckContext,
  type CheckInput,
  type NamedCheck,
  type OwnerPropertiesOf,
  type PropertyDialect,
  type PropertyList,
  type PropertyOwner,
} from '@goal-controller/goal-language';

/**
 * A check's context (the goal language's): the element's RT id, the kinds
 * of the others (the dialect's, `istar.Goal`), and the whole model when the
 * caller has it.
 */
export type { CheckContext, CheckInput };

/**
 * What is wrong with a property's value, as an engine's mapper would reject it
 * (null when fine). Gets what a mapper gets (goal-controller#222): the record
 * of the element (or actor, or link) the property is on, read by its dialect
 * (`props`, typed by `L`, its properties; `raw`, as written; `kind`), so
 * cross-property rules work: the bounds check reads both lowerBound and
 * upperBound regardless of which one is being checked. It is run on a key
 * only when that key's value reads as its type (`runCheck`): it checks
 * meaning, never syntax, which the dialect's value check says. A rule across
 * elements reads `context.elements`, and says nothing when the caller doesn't
 * have the model.
 *
 * `Check` (no `L`) is any check, as a registry holds them.
 */
export type Check<L extends PropertyList = PropertyList> =
  PropertyList extends L
    ? NamedCheck
    : (input: CheckInput<L>, context: CheckContext) => string | null;

/** Checks by name: each a `Check`, the names kept (a misspelt one doesn't compile where it is used). */
export const checks = <K extends string>(byName: Record<K, Check>) => byName;

/**
 * A check on a dialect's element kind (`{ element: 'goal' }`), its actors or a
 * link kind: its input typed by that owner's properties.
 */
export const checkOn =
  <const D extends PropertyDialect, const O extends PropertyOwner>(
    _dialect: D,
    _owner: O,
  ) =>
  (check: Check<OwnerPropertiesOf<D, O>>): Check<OwnerPropertiesOf<D, O>> =>
    check;

/**
 * Runs a check on a key of an owner's stored properties, as the editors do:
 * read by the dialect, and only when the key's value reads as its type (null
 * otherwise: the dialect's value check says what is wrong).
 */
export const runCheck = (
  dialect: PropertyDialect,
  owner: PropertyOwner,
  key: string,
  stored: Readonly<Record<string, string | undefined>>,
  check: Check | undefined,
  context: CheckContext,
): string | null => {
  if (!check) return null;
  const input = checkInputOf(dialect, owner, stored);
  return parses(input, key) ? check(input, context) : null;
};
