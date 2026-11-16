/**
 * Which element a document's line is (goal-controller#518): the one its id
 * names, never the one at its position. An id is an element's written one
 * (`G1`, `net_up`; in a dialect whose ids are scoped by their goal, under
 * the goal line above), or the first characters of its piStar id where it
 * has none (`shortId`). An id two elements show names neither.
 */
import {
  hasIds,
  type AnyDialect,
  type DefinitionContext,
} from '@goal-controller/dialect';
import { hasWrittenId, shownId } from '../print.js';
import { lineScope } from './scope.js';

/** An element as a line names it: its key, written id (or none) and piStar id. */
export type Identified = {
  key: string;
  id: string;
  iStarId: string;
  hasId?: boolean;
};

/** What a line's id names: an element, several (they show one id), or none. */
export type LineIdentity =
  | { key: string }
  | { ambiguous: readonly string[] }
  | null;

/**
 * Reads a document's element lines in order (`resolve` each, at its
 * indentation) and says which element each names.
 */
export const lineIdentities = (
  definition: Pick<AnyDialect, 'elements' | 'idScope'>,
  elements: Iterable<Identified>,
) => {
  const ids = hasIds(definition);
  const keys = new Map<string, Identified>();
  // the ids the elements show, each with the keys that show it
  const shown = new Map<string, string[]>();
  for (const element of elements) {
    keys.set(element.key, element);
    // a scoped dialect's written ids are its scope's to tell apart
    if (ids && hasWrittenId(element)) continue;
    const id = shownId(element);
    shown.set(id, [...(shown.get(id) ?? []), element.key]);
  }
  const scope = lineScope(definition);
  let lastGoal: string | null = null;
  return {
    /** the goal the line last resolved is under, in a dialect that scopes ids by it (else null) */
    goal(): string | null {
      return lastGoal;
    },
    /** the element a line's id names, the line at `indent` (called for every element line, in order) */
    resolve(indent: number, id: string | null): LineIdentity {
      lastGoal = null;
      if (id === null) return null;
      const goal = scope.enter(indent, id);
      lastGoal = goal;
      const candidates = [...(shown.get(id) ?? [])];
      if (ids) {
        const key = scope.keyOf(goal, id, (k) => keys.has(k));
        const element = keys.get(key);
        if (element && hasWrittenId(element) && !candidates.includes(key))
          candidates.unshift(key);
      }
      if (candidates.length === 0) return null;
      return candidates.length === 1
        ? { key: candidates[0]! }
        : { ambiguous: candidates };
    },
    /** an element, by key */
    element(key: string): Identified | undefined {
      return keys.get(key);
    },
  };
};

/** The elements of a context a document's lines name (`lineIdentities`): its elements, by key. */
export const identifiedOfContext = (
  context: Pick<DefinitionContext, 'elements'>,
): Identified[] =>
  Object.entries(context.elements).map(([key, element]) => ({
    key,
    id: element.id ?? key,
    // a context made by hand keys its elements by their written ids
    iStarId: element.iStarId ?? key,
    hasId: element.hasId ?? (element.iStarId === undefined || undefined),
  }));

/** The key of the element an id names in a context, wherever its line is (no scope): null, none or several. */
export const contextKeyOf = (
  context: Pick<DefinitionContext, 'elements'>,
  id: string,
): string | null => {
  if (id in context.elements) return id;
  const found = identifiedOfContext(context).filter((e) => shownId(e) === id);
  return found.length === 1 ? found[0]!.key : null;
};
