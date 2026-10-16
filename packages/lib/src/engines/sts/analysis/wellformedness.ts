/**
 * STS-ml's well-formedness analysis (goal-controller#161, #160 item 1 §1):
 * the checks that read the whole model (#160 D-G1). The dialect's checks
 * (red's, #163) cover what one link and its ends show. Severities are the
 * manual's and the reports' (manual v2.1 App. A; the reports' App. B),
 * and #160 D-G2's where those say nothing.
 */
import { authorityOf } from './authority';
import { finding, type StsFinding } from './findings';
import { cyclesOf, reachable, type StsIndex } from './graph';
import type { StsAuthorisation, StsModel } from './model';

const quote = (text: string) => `"${text}"`;

/**
 * Delegation child cycle (DKE Def. 3(8a); manual App. A; NESSoS Fig. 17):
 * the delegatee, or an actor further down, delegates the delegated goal or
 * one of its subgoals back to an actor upstream of it.
 */
const delegationChildCycles = (index: StsIndex): StsFinding[] =>
  index.model.delegations.flatMap((d) => {
    if (d.received === undefined) return [];
    /** The delegators d's goal came through: d's, then theirs, back to the first. */
    const upstream = reachable([d.goal], (g) =>
      index.delegationsTo(g).map((x) => x.goal),
    ).map((g) => index.actorOf(g));
    return index.subtree(d.received).flatMap((goal) =>
      index
        .delegationsOf(goal)
        .filter((e) => upstream.includes(e.to))
        .map((e) =>
          finding(
            'delegationChildCycle',
            'warning',
            `There is a delegation cycle: ${quote(index.name(goal))}, ${goal === d.received ? 'delegated' : `a subgoal of ${quote(index.name(d.received!))}, delegated`} to ${quote(index.name(d.to))}, is delegated back to ${quote(index.name(e.to))}`,
            [goal, d.received!, d.to, e.to],
            [d.id, e.id],
            { goal, to: e.to },
          ),
        ),
    );
  });

/** Part-of cycles (DKE Def. 3(8b); the reports' App. B): one warning per cycle, listing it. */
const partOfCycles = (index: StsIndex, of: 'information' | 'document') => {
  const parts = index.model.partOf.filter((p) => p.of === of);
  const nodes = (
    of === 'information' ? index.model.information : index.model.documents
  ).map((x) => x.id);
  return cyclesOf(
    nodes,
    parts.map((p) => [p.part, p.whole] as const),
  ).map((cycle) =>
    finding(
      of === 'information' ? 'informationPartOfCycle' : 'documentPartOfCycle',
      'warning',
      `${cycle.map((x) => quote(index.name(x))).join(', ')} form a cycle of part-of relationships`,
      cycle,
      parts
        .filter((p) => cycle.includes(p.part) && cycle.includes(p.whole))
        .map((p) => p.id),
      { cycle: cycle.join(',') },
    ),
  );
};

/**
 * Information no ownership (manual App. A; Healthcare report Table 17):
 * information no actor owns, itself or as a whole it is part of (#160
 * D-G13).
 */
const informationNoOwner = (index: StsIndex): StsFinding[] =>
  index.model.information
    .filter((i) => !authorityOf(index).ownersOf(i.id).length)
    .map((i) =>
      finding(
        'informationNoOwner',
        'warning',
        `Information ${quote(i.name)} has no owner`,
        [i.id],
        [],
        { information: i.id },
      ),
    );

const subset = <T>(a: readonly T[], b: readonly T[]) =>
  a.every((x) => b.includes(x));
const sameSet = <T>(a: readonly T[], b: readonly T[]) =>
  subset(a, b) && subset(b, a);
/** Whether `a`'s goal scope lies in `b`'s (none: every goal). */
const scopeWithin = (
  index: StsIndex,
  a: StsAuthorisation,
  b: StsAuthorisation,
) =>
  !b.scope.length ||
  (a.scope.length > 0 &&
    a.scope.every((g) => b.scope.some((h) => index.subtree(h).includes(g))));

/**
 * Duplicate authorisations (manual App. A; the reports' App. B): two
 * authorisations between the same actors, in the same direction, equal,
 * or one granting a subset of the other's (its information, operations and
 * scope within the other's, transferability the same).
 */
const duplicateAuthorisations = (index: StsIndex): StsFinding[] => {
  const { authorisations } = index.model;
  return authorisations.flatMap((a, i) =>
    authorisations.slice(i + 1).flatMap((b) => {
      if (
        a.from !== b.from ||
        a.to !== b.to ||
        a.transferable !== b.transferable
      )
        return [];
      const within = (x: StsAuthorisation, y: StsAuthorisation) =>
        subset(x.information, y.information) &&
        subset(x.granted, y.granted) &&
        subset(x.prohibited, y.prohibited) &&
        scopeWithin(index, x, y);
      const equal =
        sameSet(a.information, b.information) &&
        sameSet(a.granted, b.granted) &&
        sameSet(a.prohibited, b.prohibited) &&
        sameSet(a.scope, b.scope);
      if (!equal && !within(a, b) && !within(b, a)) return [];
      return [
        finding(
          'duplicateAuthorisations',
          'warning',
          `The authorisations from ${quote(index.name(a.from))} to ${quote(index.name(a.to))} ${equal ? 'are identical' : 'overlap: one grants a subset of the other'}, and could be merged`,
          [a.from, a.to],
          [a.id, b.id],
          { from: a.from, to: a.to, equal: String(equal) },
        ),
      ];
    }),
  );
};

/**
 * Inconsistent contribution cycle (the reports' App. B): a cycle of
 * contributions mixing positive and negative ones.
 */
const contributionCycles = (index: StsIndex): StsFinding[] => {
  const { contributions } = index.model;
  return cyclesOf(
    index.model.goals.map((g) => g.id),
    contributions.map((c) => [c.from, c.to] as const),
  ).flatMap((cycle) => {
    const inside = contributions.filter(
      (c) => cycle.includes(c.from) && cycle.includes(c.to),
    );
    const signs = new Set(inside.map((c) => c.sign));
    return signs.size > 1
      ? [
          finding(
            'inconsistentContributionCycle',
            'warning',
            `The contributions among ${cycle.map((g) => quote(index.name(g))).join(', ')} form a cycle with both positive and negative ones`,
            cycle,
            inside.map((c) => c.id),
            { cycle: cycle.join(',') },
          ),
        ]
      : [];
  });
};

/** Negative contributions between AND-subgoals (the reports' App. B): of one goal. */
const negativeAndSubgoals = (index: StsIndex): StsFinding[] =>
  index.model.contributions
    .filter((c) => c.sign === '-')
    .flatMap((c) => {
      const parent = index
        .parentsOf(c.from)
        .find(
          (p) =>
            p.type === 'and' &&
            index.parentsOf(c.to).some((q) => q.goal === p.goal),
        );
      return parent
        ? [
            finding(
              'negativeContributionAndSubgoals',
              'warning',
              `${quote(index.name(c.from))} contributes negatively to ${quote(index.name(c.to))}, and both are AND-subgoals of ${quote(index.name(parent.goal))}`,
              [c.from, c.to, parent.goal],
              [c.id],
              { goal: parent.goal },
            ),
          ]
        : [];
    });

/**
 * Organisational constraint consistency (the reports' App. C): a
 * separation and a combination of duties between the same two goals or
 * roles can't both hold (#160 D-G2: an error).
 */
const conflictingOrgConstraints = (model: StsModel, index: StsIndex) =>
  model.duties
    .filter((s) => s.type === 'sod')
    .flatMap((s) =>
      model.duties
        .filter(
          (c) =>
            c.type === 'cod' &&
            ((c.first === s.first && c.second === s.second) ||
              (c.first === s.second && c.second === s.first)),
        )
        .map((c) =>
          finding(
            'conflictingOrgConstraints',
            'error',
            `Both a separation and a combination of duties are required between ${quote(index.name(s.first))} and ${quote(index.name(s.second))}`,
            [s.first, s.second],
            [s.id, c.id],
            { first: s.first, second: s.second },
          ),
        ),
    );

/** Every finding of the well-formedness analysis, in the manual's order. */
export const wellFormednessAnalysis = (index: StsIndex): StsFinding[] => [
  ...delegationChildCycles(index),
  ...partOfCycles(index, 'document'),
  ...partOfCycles(index, 'information'),
  ...informationNoOwner(index),
  ...duplicateAuthorisations(index),
  ...contributionCycles(index),
  ...negativeAndSubgoals(index),
  ...conflictingOrgConstraints(index.model, index),
];
