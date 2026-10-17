/**
 * An engine's check, run on a key as the editors run it (goal-controller#222):
 * on the record its dialect reads from the strings given, and only when the
 * key's value reads as its type.
 */
import type {
  PropertyDialect,
  PropertyOwner,
} from '@goal-controller/goal-language';
import {
  runCheck,
  type Check,
  type CheckContext,
} from '../../src/engines/checks';

export const checkOnKey =
  (dialect: PropertyDialect, owner: PropertyOwner, key: string, check: Check) =>
  (raw: Readonly<Record<string, string>>, context: CheckContext) =>
    runCheck(dialect, owner, key, raw, check, context);
