/**
 * The versions of GODA's generator the reference outputs come from
 * (goal-controller#34 D10), each a strategy (D14): its templates, how it
 * builds the containers and their time slots, which slots a module's labels
 * read, where a leaf's context comes from, the guards before a leaf starts,
 * and how it composes the formulas. cc808b6 (2019-01) made AND, OR, DM and
 * Incompleteness; 5305bc1 (2019-07) made TAS, Fragmented and BSN.
 */
import {
  buildContainers,
  clearElId,
  maxSlots,
  sortedById,
  timePaths,
  type Container,
  type GodaRoots,
} from './containers';
import { composeFormulas, type GodaFormulas } from './formulas';
import { composeFormulas5305bc1 } from './formulas5305bc1';
import {
  CC808B6_TEMPLATES,
  JULY_2019_PREV_FAILURE,
  JULY_2019_TEMPLATES,
  type GodaTemplates,
} from './templates';

/** The generator versions the references come from, by commit. */
export const GODA_VARIANTS = ['cc808b6', '5305bc1'] as const;
export type GodaVariant = (typeof GODA_VARIANTS)[number];

/** The version written when none is asked for: the newest the engine reproduces (#34 D24). */
export const GODA_DEFAULT_VARIANT: GodaVariant = '5305bc1';

/** What the writer knows of the decision-making modules written so far. */
export type DecisionMakingView = {
  /** each decision-making element's children, and their contexts */
  list: ReadonlyMap<Container, string>;
  /** `equalsRoot`: whether a container descends from another */
  equalsRoot: (alt: Container, plan: Container) => boolean;
  /** `getKeyRTContainer`: the first child with these contexts */
  childWith: (ctx: string) => Container | undefined;
};

export type GodaGenerator = {
  variant: GodaVariant;
  templates: GodaTemplates;
  /** RTGoreProducer: the containers of an actor's roots, with their time slots */
  containers: (roots: GodaRoots) => Container[];
  /** the slots a module's labels read: `[next_<prev>]` to start, `[next_<time>]` once done */
  slots: (c: Container) => { prev: number; time: number };
  /**
   * a leaf's context (its conditions as CtxParser prints them): the id of
   * its `CTX_` parameter, and whether a decision-making module sets it (then
   * the leaf declares no constant of its own)
   */
  leafContext: (
    plan: Container,
    ctx: string,
    decisions: DecisionMakingView,
  ) => { ctxId: string; nonDeterminismCtx: boolean };
  /** the guards a leaf's start is written with, by template tag, after the formula before it */
  guards: (
    plan: Container,
    prevFormula: string | null,
  ) => Readonly<Record<string, string>>;
  /** PARAMProducer: the selected root's reliability and cost, and the eval script where it writes it */
  formulas: (root: Container) => GodaFormulas & { evalScript?: string };
};

const CC808B6: GodaGenerator = {
  variant: 'cc808b6',
  templates: CC808B6_TEMPLATES,
  // siblings sorted by id (sortIntentionalElements)
  containers: (roots) =>
    buildContainers(roots, { siblings: sortedById, slots: timePaths() }),
  // a sequence of no cardinality: its own time slot, after the one before
  slots: (c) => ({ prev: c.timeSlot - 1, time: c.timeSlot }),
  // getContextId: the decision-making child with the same contexts, when the leaf descends from it
  leafContext: (plan, ctx, { childWith, equalsRoot }) => {
    const node = childWith(ctx);
    return {
      ctxId: node && equalsRoot(node, plan) ? clearElId(node) : clearElId(plan),
      nonDeterminismCtx: !!node && (node === plan || equalsRoot(node, plan)),
    };
  },
  guards: () => ({}),
  formulas: (root) => composeFormulas(root, { frequency: true }),
};

/** `RTContainer.getParentGoal`: the nearest goal above a plan. */
const parentGoal = (plan: Container): Container | null => {
  let root = plan.root;
  while (root && root.kind === 'plan') root = root.root;
  return root;
};

const JULY_2019: GodaGenerator = {
  variant: '5305bc1',
  templates: JULY_2019_TEMPLATES,
  containers: (roots) =>
    buildContainers(roots, { siblings: sortedById, slots: maxSlots() }),
  slots: (c) => ({ prev: c.prevTimeSlot, time: c.timeSlot }),
  // getContextId, ndCtxListContainsARoot: the nearest ancestor that is a decision-making child
  leafContext: (plan, _ctx, { list }) => {
    let root = plan.root;
    while (root && !list.has(root)) root = root.root;
    return {
      ctxId: clearElId(root ?? plan),
      nonDeterminismCtx: list.has(plan) || !!root,
    };
  },
  // 9a993f8: a leaf after a sibling goal starts when that goal succeeded
  // (failed, under an OR), and is skipped otherwise
  guards: (plan, prevFormula) => {
    if (prevFormula === null)
      return {
        $PREV_EFFECT$: '',
        $PREV_SUCCESS$: '',
        $PREV_SUCCESS_EFFECT$: '',
      };
    const grandparent = parentGoal(plan)?.root;
    const or = grandparent?.decomposition === 'OR';
    const success = grandparent
      ? or
        ? `!(${prevFormula}) & `
        : `(${prevFormula}) & `
      : '';
    return {
      $PREV_EFFECT$: JULY_2019_PREV_FAILURE,
      $PREV_SUCCESS$: success,
      $PREV_SUCCESS_EFFECT$: !success
        ? ''
        : or
          ? success.slice(1)
          : `!${success}`,
    };
  },
  formulas: (root) =>
    composeFormulas5305bc1(root, JULY_2019_TEMPLATES.evalFormula),
};

/** The generators this engine has, by variant. */
export const GODA_GENERATORS: Partial<Record<GodaVariant, GodaGenerator>> = {
  cc808b6: CC808B6,
  '5305bc1': JULY_2019,
};

/** The versions this engine generates. */
export const GODA_IMPLEMENTED_VARIANTS = Object.keys(
  GODA_GENERATORS,
) as readonly GodaVariant[];
