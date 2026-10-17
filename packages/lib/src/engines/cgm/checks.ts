/**
 * Contextual goal models' named checks (goal-controller#153): the
 * properties' rules, each about one element or link. They read the model
 * when the caller has it (`context.elements`, `context.readLink`) and say
 * nothing without it; `cgmProblems` (./problems) says the same of a whole
 * model. Each reads its properties as the dialect does (./values): a
 * formula written with an error is unset here, the dialect's value check
 * reports it.
 */
import type { Check, CheckContext } from '../checks';
import { monitorabilityProblem, type FormulaLookup } from './formulas';
import { elementValues, linkValues } from './values';
import { CGM_KINDS } from './vocabulary';

/** An element by id, as a check's model has it. */
const lookupIn =
  (context: CheckContext): FormulaLookup =>
  (id) =>
    context.elements?.[id] ?? context.readElement?.(id);

/** Why a context's formula, or a statement's support, isn't monitorable (Defs. 6–7). */
const monitorable =
  (kind: string, key: 'formula' | 'supportedBy') =>
  (raw: Partial<Record<string, string>>, context: CheckContext) =>
    context.elements || context.readElement
      ? monitorabilityProblem(
          elementValues({ kind, properties: raw })[key],
          lookupIn(context),
        )
      : null;

/**
 * The names of the dialect's checks: what a property's `check` may be
 * (listed, not derived from the registry: the checks read the dialect's
 * values, whose types are the dialect's own).
 */
export type CgmCheckName =
  | 'cgm.context.monitorable'
  | 'cgm.statement.supported'
  | 'cgm.goal.activation'
  | 'cgm.contribution.opposite';

export const cgmCheckRegistry: Readonly<Record<CgmCheckName, Check>> = {
  /** Defs. 6–7: a context's statements are supported down to facts */
  'cgm.context.monitorable': monitorable(CGM_KINDS.context, 'formula'),
  /** Defs. 5–6: a statement is supported, by statements supported in turn, down to facts */
  'cgm.statement.supported': monitorable(CGM_KINDS.statement, 'supportedBy'),
  /** Table 1, kind 1: activation is a root goal's */
  'cgm.goal.activation': (raw, context) => {
    if (!elementValues({ kind: 'goal', properties: raw }).activation)
      return null;
    if (!context.elements) return null;
    const parent = Object.entries(context.elements).find(([, element]) =>
      element.children.includes(context.self),
    );
    return parent
      ? `Only a root goal has an activation context (REJ 2010 Table 1): ${context.self} refines ${parent[0]}; put the context on its link instead`
      : null;
  },
  /** #151 D10: the opposite label applies under its own context */
  'cgm.contribution.opposite': (raw) => {
    const { context, opposite } = linkValues({
      kind: 'istar.ContributionLink',
      properties: raw,
    });
    if (!opposite) return null;
    if (!context)
      return 'An opposite context needs the contribution’s own context (REJ 2010 Table 1: positively iff Ci, negatively iff Cj)';
    return opposite.text() === context.text()
      ? 'The opposite context is the contribution’s own: the two labels would apply together'
      : null;
  },
};
