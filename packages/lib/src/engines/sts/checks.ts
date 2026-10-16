/**
 * STS-ml's named checks (goal-controller#163): the authorisation's
 * properties' rules, each about one link. They read the model when the
 * caller has it (`context.readLink`, `context.readActor`) and say nothing
 * without it. What the structure says alone (a goal decomposed into one
 * subgoal, a delegated goal that isn't a leaf) has no property to hang on:
 * `stsProblems` (./problems) says it of a whole model, with the rules here.
 */
import { readEnumSet } from '@goal-controller/goal-language';
import { checks, type CheckContext } from '../checks';
import { refListItems, STS_KEYS } from './vocabulary';

const listOf = (text: string | undefined): string[] => refListItems(text) ?? [];

/** An authorisation's operations, granted and prohibited, as written. */
export const authorisationOperations = (
  properties: Readonly<Partial<Record<string, string>>>,
): { granted: string[]; prohibited: string[] } => ({
  granted: readEnumSet(properties[STS_KEYS.granted] ?? '') ?? [],
  prohibited: readEnumSet(properties[STS_KEYS.prohibited] ?? '') ?? [],
});

/** DKE Def. 3(6): an authorisation names information and an operation it grants or prohibits. */
export const authorisationInvalidity = (
  properties: Readonly<Partial<Record<string, string>>>,
): string | null => {
  const { granted, prohibited } = authorisationOperations(properties);
  const information = listOf(properties[STS_KEYS.information]);
  if (!information.length)
    return 'An authorisation is over at least one information (DKE Def. 3(6))';
  if (!granted.length && !prohibited.length)
    return 'An authorisation grants or prohibits at least one operation (DKE Def. 3(6))';
  return null;
};

/** An operation both granted and prohibited by one authorisation. */
export const operationsOverlap = (
  properties: Readonly<Partial<Record<string, string>>>,
): string | null => {
  const { granted, prohibited } = authorisationOperations(properties);
  const both = granted.filter((operation) => prohibited.includes(operation));
  return both.length
    ? `${both.join(', ')} is both granted and prohibited: an authorisation does one or the other (DKE Table 4)`
    : null;
};

/** The scope's goals that aren't the authorisee's (`readActor`'s keys), or null without the model. */
export const scopeOutsideAuthorisee = (
  properties: Readonly<Partial<Record<string, string>>>,
  authoriseeElements: readonly string[] | undefined,
): string[] | null =>
  authoriseeElements
    ? listOf(properties[STS_KEYS.scope]).filter(
        (goal) => !authoriseeElements.includes(goal),
      )
    : null;

/** The authorisee's elements' keys, when the check has the model. */
const authoriseeOf = (context: CheckContext) => {
  const target = context.readLink?.(context.self)?.ends?.target;
  return target ? context.readActor?.(target.iStarId)?.elements : undefined;
};

export const stsCheckRegistry = checks({
  /** DKE Def. 3(6), Table 4: something granted or prohibited, nothing both */
  'sts.authorisation.operations': (raw) =>
    operationsOverlap(raw) ??
    (raw[STS_KEYS.information]?.trim() ? authorisationInvalidity(raw) : null),
  /** DKE Def. 3(6): over some information */
  'sts.authorisation.information': (raw) => authorisationInvalidity(raw),
  /** DKE §3.1.3: the scope is the authorisee's goals */
  'sts.authorisation.scope': (raw, context) => {
    const outside = scopeOutsideAuthorisee(raw, authoriseeOf(context));
    return outside?.length
      ? `The scope is the authorisee’s goals (DKE §3.1.3): ${outside.join(', ')} ${outside.length > 1 ? 'are' : 'is'} not the authorisee’s`
      : null;
  },
});

/** The names of STS-ml's checks: what a property's `check` may be. */
export type StsCheckName = keyof typeof stsCheckRegistry;
