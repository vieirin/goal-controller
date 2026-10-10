/**
 * The versions of GODA's generator the reference outputs come from
 * (goal-controller#34 D10), each a strategy (D14): its templates, how it
 * builds the containers and their time slots, the guards before a leaf
 * starts, and how it composes the formulas. Only cc808b6 (2019-01) is
 * ported: AND, OR, DM and Incompleteness were generated with it. 5305bc1
 * (2019-07: BSN, TAS, Fragmented) is another object here (#38).
 */
import {
  buildContainers,
  sortedById,
  type Container,
  type GodaRoots,
} from './containers';
import { composeFormulas, type GodaFormulas } from './formulas';
import { CC808B6_TEMPLATES, type GodaTemplates } from './templates';

/** The generator versions the references come from, by commit. */
export const GODA_VARIANTS = ['cc808b6', '5305bc1'] as const;
export type GodaVariant = (typeof GODA_VARIANTS)[number];

export type GodaGenerator = {
  variant: GodaVariant;
  templates: GodaTemplates;
  /** RTGoreProducer: the containers of an actor's roots, with their time slots */
  containers: (roots: GodaRoots) => Container[];
  /** the guards a leaf's start is written with, by template tag (none at cc808b6) */
  guards: (plan: Container) => Readonly<Record<string, string>>;
  /** PARAMProducer: the selected root's reliability and cost */
  formulas: (root: Container) => GodaFormulas;
};

const CC808B6: GodaGenerator = {
  variant: 'cc808b6',
  templates: CC808B6_TEMPLATES,
  // siblings sorted by id (sortIntentionalElements)
  containers: (roots) => buildContainers(roots, { siblings: sortedById }),
  guards: () => ({}),
  formulas: (root) => composeFormulas(root, { frequency: true }),
};

/** The generators this engine has, by variant. */
export const GODA_GENERATORS: Partial<Record<GodaVariant, GodaGenerator>> = {
  cc808b6: CC808B6,
};

/** The versions this engine generates. */
export const GODA_IMPLEMENTED_VARIANTS = Object.keys(
  GODA_GENERATORS,
) as readonly GodaVariant[];
