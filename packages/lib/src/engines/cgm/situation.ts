/**
 * What holds in a situation (REJ 2010 §4, #151 D14–D15), and the sign a
 * contribution has there (#151 D10): the one rule §4's ranking and Code 3's
 * encoding share.
 */
import type { AssertionTree } from '@goal-controller/goal-language';
import type { AnalysisLink } from '../analysis';
import {
  definitionOf,
  evaluate,
  holdsGivenFacts,
  type Formula,
} from './formulas';
import { contextsOf, type CgmModel } from './model';
import type { Situation } from './resources';
import { linkValues } from './values';
import { isPositiveLabel } from './vocabulary';

/**
 * The contexts that hold in a situation: those it lists, and those whose
 * formula holds over the facts it lists (closed-world: the others are
 * false).
 */
export const contextsHolding = (
  cgm: CgmModel,
  situation: Pick<Situation, 'contexts' | 'facts'>,
): Set<string> => {
  const listed = new Set(situation.contexts);
  const facts = new Set(situation.facts);
  return new Set(
    contextsOf(cgm).filter(
      (id) =>
        listed.has(id) ||
        (!!definitionOf(cgm.lookup(id)) &&
          holdsGivenFacts(id, cgm.lookup, (name) => facts.has(name))),
    ),
  );
};

/** A formula's truth when the contexts in `holding` hold and no other does. */
export const holdsIn = (formula: Formula, holding: ReadonlySet<string>) =>
  evaluate(formula, (name) => holding.has(name));

/**
 * A contribution's sign where `holds` says which contexts hold (#151 D10):
 * its label's iff its `context` holds, the opposite iff its `opposite`
 * does; with neither property, its label's always. Null: it doesn't apply.
 */
export const contributionSign = (
  link: AnalysisLink,
  holds: (formula: AssertionTree) => boolean,
): 'pos' | 'neg' | null => {
  const positive = isPositiveLabel(link.label);
  const { context, opposite } = linkValues(link);
  if (!context && !opposite) return positive ? 'pos' : 'neg';
  if (context && holds(context)) return positive ? 'pos' : 'neg';
  if (opposite && holds(opposite)) return positive ? 'neg' : 'pos';
  return null;
};
