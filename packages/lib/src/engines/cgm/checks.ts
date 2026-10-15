/**
 * Contextual goal models' named checks (goal-controller#153): the
 * properties' rules, each about one element or link. They read the model
 * when the caller has it (`context.elements`, `context.readLink`) and say
 * nothing without it; `cgmProblems` (./problems) says the same of a whole
 * model.
 */
import type { CheckContext } from '../checks';
import { checks } from '../checks';
import { monitorabilityProblem, type FormulaLookup } from './formulas';
import { CGM_KEYS } from './vocabulary';

const set = (value: string | undefined) => Boolean(value?.trim());

/** An element by id, as a check's model has it. */
const lookupIn =
  (context: CheckContext): FormulaLookup =>
  (id) => {
    const element = context.elements?.[id] ?? context.readElement?.(id);
    return element && { kind: element.kind, properties: element.properties };
  };

/** Why a context's formula, or a statement's support, isn't monitorable (Defs. 6–7). */
const monitorable =
  (key: string) =>
  (raw: Partial<Record<string, string>>, context: CheckContext) =>
    context.elements || context.readElement
      ? monitorabilityProblem(raw[key], lookupIn(context))
      : null;

export const cgmCheckRegistry = checks({
  /** Defs. 6–7: a context's statements are supported down to facts */
  'cgm.context.monitorable': monitorable(CGM_KEYS.formula),
  /** Defs. 5–6: a statement is supported, by statements supported in turn, down to facts */
  'cgm.statement.supported': monitorable(CGM_KEYS.supportedBy),
  /** Table 1, kind 1: activation is a root goal's */
  'cgm.goal.activation': (raw, context) => {
    if (!set(raw[CGM_KEYS.activation]) || !context.elements) return null;
    const parent = Object.entries(context.elements).find(([, element]) =>
      element.children.includes(context.self),
    );
    return parent
      ? `Only a root goal has an activation context (REJ 2010 Table 1): ${context.self} refines ${parent[0]}; put the context on its link instead`
      : null;
  },
  /** #151 D10: the opposite label applies under its own context */
  'cgm.contribution.opposite': (raw) => {
    if (!set(raw[CGM_KEYS.opposite])) return null;
    if (!set(raw[CGM_KEYS.context]))
      return 'An opposite context needs the contribution’s own context (REJ 2010 Table 1: positively iff Ci, negatively iff Cj)';
    return raw[CGM_KEYS.opposite]!.replace(/\s/g, '') ===
      raw[CGM_KEYS.context]!.replace(/\s/g, '')
      ? 'The opposite context is the contribution’s own: the two labels would apply together'
      : null;
  },
});

/** The names of the dialect's checks: what a property's `check` may be. */
export type CgmCheckName = keyof typeof cgmCheckRegistry;
