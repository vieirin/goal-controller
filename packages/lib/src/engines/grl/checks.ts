/**
 * GRL's named checks: what jUCMNav's metamodel and algorithms require of a
 * model that a value type can't say (a quantitative contribution's
 * −100..100 is its int's bounds). A strategy that evaluates an element
 * the model doesn't have is the analysis's to say (no check sees both the
 * model and a resource: #105).
 */
import { checks } from '../checks';

export const grlCheckRegistry = checks({
  /** a belief is a rationale: an intentional element takes contributions, a belief doesn't */
  'grl.link.contribution': (_raw, context) =>
    context.readLink?.(context.self)?.ends?.target.kind === 'grl.Belief'
      ? 'A contribution goes to an intentional element, not to a belief'
      : null,
});

/** The names of GRL's checks: what a property's `check` may be. */
export type GrlCheckName = keyof typeof grlCheckRegistry;
