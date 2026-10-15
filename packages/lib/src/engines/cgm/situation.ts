/**
 * What holds in a situation (REJ 2010 §4, #151 D14–D15), and the sign a
 * contribution has there (#151 D10): the one rule §4's ranking and Code 3's
 * encoding share.
 */
import type { AnalysisLink } from '../analysis';
import { evaluate, formulaOf, holdsGivenFacts } from './formulas';
import { contextsOf, type CgmModel } from './model';
import type { Situation } from './resources';
import { CGM_KEYS, isPositiveLabel } from './vocabulary';

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
        (!!cgm.lookup(id)?.properties[CGM_KEYS.formula]?.trim() &&
          holdsGivenFacts(id, cgm.lookup, (name) => facts.has(name))),
    ),
  );
};

/** A formula's truth when the contexts in `holding` hold and no other does. */
export const holdsIn = (
  text: string | undefined,
  holding: ReadonlySet<string>,
) => evaluate(formulaOf(text), (name) => holding.has(name));

/**
 * A contribution's sign where `holds` says which contexts hold (#151 D10):
 * its label's iff its `context` holds, the opposite iff its `opposite`
 * does; with neither property, its label's always. Null: it doesn't apply.
 */
export const contributionSign = (
  link: AnalysisLink,
  holds: (formula: string) => boolean,
): 'pos' | 'neg' | null => {
  const positive = isPositiveLabel(link.label);
  const context = link.properties[CGM_KEYS.context];
  const opposite = link.properties[CGM_KEYS.opposite];
  if (!context?.trim() && !opposite?.trim()) return positive ? 'pos' : 'neg';
  if (context?.trim() && holds(context)) return positive ? 'pos' : 'neg';
  if (opposite?.trim() && holds(opposite)) return positive ? 'neg' : 'pos';
  return null;
};
