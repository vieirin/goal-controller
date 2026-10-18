/**
 * The four analyses of contextual goal models (REJ 2010 §4–§5,
 * goal-controller#153), over the framework's variants and solver (#152):
 *
 * 1. **Variants in a situation** (§4): the variants whose context holds,
 *    ranked by the priority formula, best first.
 * 2. **Unadoptable variants** (§5.1, Fig. 8): the variants whose context is
 *    unsatisfiable under a set of logical relations.
 * 3. **Core variants** (§5.2, Def. 8, Fig. 10): the core groups, and each
 *    non-core variant with a core variant that replaces it.
 * 4. **Minimum-cost tasks** (§5.3, Fig. 12): the tasks to develop, their
 *    cost, the cost of developing all tasks, the variants implemented.
 *
 * A variant's context is the conjunction of the contexts at its variation
 * points (Table 1, kinds 1–5; Fig. 3), each context then replaced by its
 * formula down to facts, as the relations may name facts (§5.1).
 * Contributions decide a variant's score only (#151 D10, D14).
 */
import type { AssertionTree } from '@goal-controller/goal-language';
import type { AnalysisCase, AnalysisModel, AnalysisResult } from '../analysis';
import { equivalent, implies, satisfiable } from '../propositional';
import {
  variantContext,
  variantsOf,
  type Variant,
  type VariantGuard,
  type VariationPoint,
} from '../variants';
import { evaluate, expandToFacts } from './formulas';
import { costOfTasks, readCgmModel, type CgmModel } from './model';
import {
  readRelationSets,
  readSituations,
  resourceFiles,
  type RelationSet,
} from './resources';
import { contextsHolding, contributionSign } from './situation';
import { elementValues, linkValues } from './values';

/** at most this many variants per root (REJ 2010's own case had 324,000) */
export const VARIANT_LIMIT = 20_000;

/**
 * Where the walk asks for a guard: a root's activation, a link's context
 * (#151 D13). Written but unreadable → `'unreadable'` (goal-controller#238:
 * that variant is excluded; the dialect's diagnostic is what the user sees).
 */
export const cgmGuard = (at: VariationPoint): VariantGuard => {
  if (at.point === 'root') {
    const raw = at.element.properties.activation;
    const value = elementValues(at.element).activation;
    if (raw?.trim() && value === undefined) return 'unreadable';
    return value ?? null;
  }
  const raw = at.link.properties.context;
  const value = linkValues(at.link).context;
  if (raw?.trim() && value === undefined) return 'unreadable';
  return value ?? null;
};

/**
 * How a link joins its parent: iStar's refinements as iStar's (AND and
 * NeededBy keep, OR chooses, a means-end is a task's OR), and a dependency
 * as an alternative, its context required, not an activation: the depender
 * delegates under it (IST 2013 §3.1's required context, #151 D13).
 */
const CGM_RELATION: Readonly<Record<string, 'and' | 'or'>> = {
  'istar.AndRefinementLink': 'and',
  'istar.NeededByLink': 'and',
  'istar.OrRefinementLink': 'or',
  'istar.DependencyLink': 'or',
};

/** A model's variants, from each root, the dependencies followed into the dependee's tree. */
export const cgmVariants = (
  cgm: CgmModel,
  limit = VARIANT_LIMIT,
): {
  root: string;
  variants: readonly Variant[];
  truncated: boolean;
  total: number;
}[] =>
  cgm.roots.map((root) => {
    const { variants, truncated, total } = variantsOf(cgm.model, root, {
      guard: cgmGuard,
      relation: (link) => CGM_RELATION[link.kind],
      follow: (dependency) => (dependency.dependee ? true : undefined),
      limit,
    });
    return { root, variants, truncated, total };
  });

/** A variant's tasks: the leaves that are tasks, by id, in tree order. */
export const tasksOf = (cgm: CgmModel, variant: Variant): string[] =>
  variant.leaves.filter((id) => cgm.element(id)?.kind === 'istar.Task');

/** A variant's context down to facts (§5.1), or none when it passed no guard. */
export const factContext = (cgm: CgmModel, variant: Variant) =>
  expandToFacts(variantContext(variant), cgm.lookup);

/** A variant written for a summary: its tasks by id (`{T1, T4}`). */
export const variantName = (cgm: CgmModel, variant: Variant) =>
  `{${tasksOf(cgm, variant).map(cgm.idOf).join(', ')}}`;

/** A variant's context as Fig. 3 writes it: its literals, in tree order (`C0 ∧ ¬C2 ∧ …`). */
export const contextText = (cgm: CgmModel, variant: Variant): string =>
  variant.literals.length
    ? variant.literals
        .map(({ condition, holds }) => {
          const text = formulaText(condition);
          return holds
            ? text
            : `¬${/^[\w.]+$/.test(text) ? text : `(${text})`}`;
        })
        .join(' ∧ ')
    : 'true';

const formulaText = (tree: AssertionTree | null): string => {
  if (!tree) return 'true';
  switch (tree.kind) {
    case 'var':
      return tree.variable;
    case 'not':
      return `¬${formulaText(tree.expr)}`;
    case 'paren':
      return `(${formulaText(tree.expr)})`;
    case 'and':
      return `${formulaText(tree.left)} ∧ ${formulaText(tree.right)}`;
    case 'or':
      return `${formulaText(tree.left)} ∨ ${formulaText(tree.right)}`;
    default:
      return JSON.stringify(tree);
  }
};

const selectionOf = (variant: Variant) => [
  ...variant.elements,
  ...variant.links,
];

/**
 * §4's priority of a variant: Σ_sg percentPos(v, sg)·priority(sg) −
 * Σ_sg percentNeg(v, sg)·priority(sg), over the contributions from its
 * goals and tasks that apply where `holding` holds.
 */
export const variantScore = (
  cgm: CgmModel,
  variant: Variant,
  holding: ReadonlySet<string>,
  priorities: Readonly<Record<string, number>>,
): {
  score: number;
  bySoftgoal: Record<string, { pos: number; neg: number }>;
} => {
  const inVariant = new Set(variant.elements);
  const bySoftgoal: Record<string, { pos: number; neg: number }> = {};
  for (const link of cgm.contributions) {
    if (!inVariant.has(link.source)) continue;
    const sign = contributionSign(link, (formula) =>
      evaluate(formula, (name) => holding.has(name)),
    );
    if (!sign) continue;
    const softgoal = cgm.idOf(link.target);
    const counts = (bySoftgoal[softgoal] ??= { pos: 0, neg: 0 });
    counts[sign] += 1;
  }
  let score = 0;
  for (const [softgoal, { pos, neg }] of Object.entries(bySoftgoal)) {
    const priority =
      priorities[softgoal] ??
      priorities[cgm.byId(softgoal)?.id ?? softgoal] ??
      0;
    score += ((pos - neg) / (pos + neg)) * priority;
  }
  return { score, bySoftgoal };
};

/** Whether a variant applies where `holding` holds: each guard as the variant passed it. */
export const applies = (variant: Variant, holding: ReadonlySet<string>) =>
  variant.literals.every(
    ({ condition, holds }) =>
      evaluate(condition, (name) => holding.has(name)) === holds,
  );

/** 1. §4: per situation, the applicable variants, best first. */
export const runVariantsInSituation = (
  model: AnalysisModel,
  resource?: Readonly<Record<string, string>>,
): AnalysisResult => {
  const cgm = readCgmModel(model);
  const { situations } = readSituations(resourceFiles(resource));
  const all = cgmVariants(cgm).flatMap(({ variants }) => variants);
  return {
    cases: situations.flatMap((situation): AnalysisCase[] => {
      const holding = contextsHolding(cgm, situation);
      const ranked = all
        .filter((variant) => applies(variant, holding))
        .map((variant) => ({
          variant,
          ...variantScore(cgm, variant, holding, situation.priorities),
        }))
        .sort((a, b) => b.score - a.score);
      return ranked.map(({ variant, score }, i) => ({
        id: `${situation.path}#${i + 1}`,
        label: `${situation.label}: #${i + 1} ${variantName(cgm, variant)}`,
        selection: selectionOf(variant),
        summary: `score ${round(score)}; context ${contextText(cgm, variant)}`,
        values: {
          [variant.elements[0]!]: {
            value: round(score),
            label: `score ${round(score)}`,
          },
        },
      }));
    }),
  };
};

const round = (n: number) => Math.round(n * 1000) / 1000;

/** The relation sets a relations file gives: its absolute relations, then each environment's with them. */
export const relationCases = (sets: readonly RelationSet[]) =>
  sets.flatMap((set) => [
    { id: set.path, label: set.label, relations: set.absolute },
    ...Object.entries(set.environments).map(([name, relations]) => ({
      id: `${set.path}#${name}`,
      label: `${set.label}, in ${name}`,
      relations: [...set.absolute, ...relations],
    })),
  ]);

/** The relations' trees, down to facts. */
const assumptionsOf = (
  cgm: CgmModel,
  relations: readonly { tree: AssertionTree }[],
) => relations.map(({ tree }) => expandToFacts(tree, cgm.lookup)!);

/** 2. §5.1: per relation set, the variants whose context is unsatisfiable. */
export const runUnadoptable = (
  model: AnalysisModel,
  resource?: Readonly<Record<string, string>>,
): AnalysisResult => {
  const cgm = readCgmModel(model);
  const { relations } = readRelationSets(resourceFiles(resource));
  const all = cgmVariants(cgm).flatMap(({ variants }) => variants);
  return {
    cases: relationCases(relations).flatMap(({ id, label, relations }) => {
      const assumptions = assumptionsOf(cgm, relations);
      return all.flatMap((variant, i): AnalysisCase[] => {
        const result = satisfiable(
          factContext(cgm, variant) ?? { kind: 'bool', value: true },
          assumptions,
        );
        if (result.satisfiable) return [];
        const conflicting = result.conflict.map((k) => relations[k]!.text);
        return [
          {
            id: `${id}#${i + 1}`,
            label: `${label}: ${variantName(cgm, variant)} is unadoptable`,
            selection: selectionOf(variant),
            summary: `context ${contextText(cgm, variant)}; unsatisfiable${conflicting.length ? ` with ${conflicting.join(', ')}` : ' on its own'}`,
            values: {
              [variant.elements[0]!]: {
                value: 'unadoptable',
                severity: 'warning',
              },
            },
          },
        ];
      });
    }),
  };
};

export type CoreGroups = {
  /** the satisfiable variants, grouped by context equivalence: the core groups */
  groups: Variant[][];
  /** each non-core variant, and a core variant whose context its context implies */
  nonCore: { variant: Variant; replacedBy: Variant }[];
  /** the variants whose context is unsatisfiable */
  unadoptable: Variant[];
};

/** §5.2: Def. 8's core variants, grouped (Defs. 9–10, Fig. 10). */
export const coreGroups = (
  cgm: CgmModel,
  variants: readonly Variant[],
  relations: readonly { tree: AssertionTree }[],
): CoreGroups => {
  const assumptions = assumptionsOf(cgm, relations);
  const contextOf = new Map(
    variants.map((v) => [
      v,
      factContext(cgm, v) ?? ({ kind: 'bool', value: true } as const),
    ]),
  );
  const unadoptable: Variant[] = [];
  const live: Variant[] = [];
  for (const variant of variants)
    (satisfiable(contextOf.get(variant)!, assumptions).satisfiable
      ? live
      : unadoptable
    ).push(variant);
  // Fig. 10, lines 2–8: partitioned by context equivalence
  const classes: Variant[][] = [];
  for (const variant of live) {
    const same = classes.find(
      (group) =>
        equivalent(
          contextOf.get(group[0]!)!,
          contextOf.get(variant)!,
          assumptions,
        ).holds,
    );
    if (same) same.push(variant);
    else classes.push([variant]);
  }
  // lines 9–14 (#151 D14): a group whose context strictly implies another's is non-core
  const impliesGroup = (a: Variant[], b: Variant[]) =>
    implies(contextOf.get(a[0]!)!, contextOf.get(b[0]!)!, assumptions).holds;
  const groups = classes.filter(
    (group) =>
      !classes.some((other) => other !== group && impliesGroup(group, other)),
  );
  const nonCore = classes
    .filter((group) => !groups.includes(group))
    .flatMap((group) => {
      const core = groups.find((other) => impliesGroup(group, other))!;
      return group.map((variant) => ({ variant, replacedBy: core[0]! }));
    });
  return { groups, nonCore, unadoptable };
};

/** 3. §5.2: per relation set, the core groups and the non-core variants. */
export const runCoreVariants = (
  model: AnalysisModel,
  resource?: Readonly<Record<string, string>>,
): AnalysisResult => {
  const cgm = readCgmModel(model);
  const { relations } = readRelationSets(resourceFiles(resource));
  const all = cgmVariants(cgm).flatMap(({ variants }) => variants);
  return {
    cases: relationCases(relations).flatMap(({ id, label, relations }) => {
      const { groups, nonCore } = coreGroups(cgm, all, relations);
      return [
        ...groups.map((group, g): AnalysisCase => ({
          id: `${id}#core${g + 1}`,
          label: `${label}: core group ${g + 1} (${group.length} variants)`,
          selection: [...new Set(group.flatMap(selectionOf))],
          summary: `${group.map((v) => variantName(cgm, v)).join(', ')}; context ${contextText(cgm, group[0]!)}`,
          values: {},
        })),
        ...nonCore.map(({ variant, replacedBy }, n): AnalysisCase => ({
          id: `${id}#noncore${n + 1}`,
          label: `${label}: ${variantName(cgm, variant)} is non-core`,
          selection: selectionOf(variant),
          summary: `replaced by ${variantName(cgm, replacedBy)}`,
          values: {},
        })),
      ];
    }),
  };
};

export type MinimumCost = {
  tasks: string[];
  cost: number;
  allTasksCost: number;
  /** the core variants whose tasks are all in `tasks` */
  implemented: Variant[];
  mandatory: string[];
};

/** at most this many combinations in Fig. 12's Cartesian product */
export const PRODUCT_LIMIT = 1_000_000;

/** §5.3, Fig. 12: a minimum-cost set of tasks for the core groups. */
export const minimumCostTasks = (
  cgm: CgmModel,
  groups: readonly (readonly Variant[])[],
): MinimumCost => {
  const tasks = (v: Variant) => tasksOf(cgm, v);
  // lines 1–4: the mandatory tasks, in every variant of some group
  const mandatory = new Set<string>();
  for (const group of groups)
    for (const task of tasks(group[0]!))
      if (group.every((v) => tasks(v).includes(task))) mandatory.add(task);
  // lines 5–9: a group one of whose variants the mandatory tasks implement is done
  const open = groups.filter(
    (group) => !group.some((v) => tasks(v).every((t) => mandatory.has(t))),
  );
  // lines 10–11: the mandatory tasks left out; groups with the same variants unified
  const reduced: string[][][] = [];
  for (const group of open) {
    const options = group.map((v) => tasks(v).filter((t) => !mandatory.has(t)));
    const key = (o: string[]) => [...o].sort().join(',');
    const keys = new Set(options.map(key));
    if (
      !reduced.some(
        (other) =>
          other.length === keys.size && other.every((o) => keys.has(key(o))),
      )
    )
      reduced.push(
        options.filter(
          (o, i) => options.findIndex((p) => key(p) === key(o)) === i,
        ),
      );
  }
  // lines 12–14: the product's cheapest combination
  const size = reduced.reduce((n, group) => n * group.length, 1);
  if (size > PRODUCT_LIMIT)
    throw new Error(
      `Fig. 12's product has ${size} combinations, more than ${PRODUCT_LIMIT}`,
    );
  let best: { tasks: Set<string>; cost: number } | null = null;
  const choose = (i: number, chosen: Set<string>): void => {
    if (i === reduced.length) {
      const cost = costOfTasks(cgm, chosen);
      if (!best || cost < best.cost) best = { tasks: new Set(chosen), cost };
      return;
    }
    for (const option of reduced[i]!)
      choose(i + 1, new Set([...chosen, ...option]));
  };
  choose(0, new Set(mandatory));
  const found = best as { tasks: Set<string>; cost: number } | null;
  const chosen = found?.tasks ?? mandatory;
  const order = cgm.model.elements.map((e) => e.id);
  const allTasks = cgm.model.elements
    .filter((e) => e.kind === 'istar.Task')
    .map((e) => e.id);
  return {
    tasks: [...chosen].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    cost: found?.cost ?? costOfTasks(cgm, mandatory),
    allTasksCost: costOfTasks(cgm, allTasks),
    implemented: groups
      .flat()
      .filter((v) => tasks(v).every((t) => chosen.has(t))),
    mandatory: [...mandatory],
  };
};

/** 4. §5.3: per relation set, the minimum-cost tasks. */
export const runMinimumCost = (
  model: AnalysisModel,
  resource?: Readonly<Record<string, string>>,
): AnalysisResult => {
  const cgm = readCgmModel(model);
  const { relations } = readRelationSets(resourceFiles(resource));
  const all = cgmVariants(cgm).flatMap(({ variants }) => variants);
  return {
    cases: relationCases(relations).map(
      ({ id, label, relations }): AnalysisCase => {
        const { groups } = coreGroups(cgm, all, relations);
        const result = minimumCostTasks(cgm, groups);
        return {
          id,
          label: `${label}: minimum-cost tasks`,
          selection: [
            ...result.tasks,
            ...new Set(result.implemented.flatMap(selectionOf)),
          ],
          summary: `tasks {${result.tasks.map(cgm.idOf).join(', ')}}, cost ${result.cost} (all tasks ${result.allTasksCost}); implements ${result.implemented.map((v) => variantName(cgm, v)).join(', ')}`,
          values: Object.fromEntries(
            result.tasks.map((t) => [
              t,
              { value: cgm.costOf(t), label: `cost ${cgm.costOf(t)}` },
            ]),
          ),
        };
      },
    ),
  };
};
