/**
 * STS-ml's security analysis (goal-controller#161, #160 item 1 §2):
 * conflicts among authorisations (DKE Def. 5), then each security
 * requirement against the actors' business policies, in some variant (DKE
 * Def. 8, Table 7; manual v2.1 App. B). Each finding's `details` name the
 * requester and the responsible actor, and what it reads (piStar ids).
 */
import type { AssertionTree } from '@goal-controller/goal-language';
import { authorityOf, type Authority } from './authority';
import { finding, type StsFinding } from './findings';
import { reachable, type StsIndex } from './graph';
import {
  OPERATIONS,
  type Operation,
  type StsAuthorisation,
  type StsDelegation,
} from './model';
import { formula, pursuedAtom, variantsOf, type Variants } from './variants';

const quote = (text: string) => `"${text}"`;
const list = (names: readonly string[]) =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
/** A verb for one subject or several (`prohibits`, `prohibit`). */
const verb = (subjects: readonly unknown[], stem: string) =>
  subjects.length > 1 ? stem : `${stem}s`;
/** How a document shows information: itself, or one of its parts. */
const shows = (
  index: StsIndex,
  { information, through }: { information: string; through: readonly string[] },
) =>
  through.length
    ? `its part${through.length > 1 ? 's' : ''} ${list(through.map((p) => quote(index.name(p))))}`
    : quote(index.name(information));
const OPERATION_NOUN: Record<Operation, string> = {
  read: 'reading',
  modify: 'modification',
  produce: 'production',
  transmit: 'transmission',
};

/** Information an authorisation covers, in the model's order: what it names, and their parts. */
const coverOf = (index: StsIndex, authority: Authority, a: StsAuthorisation) =>
  index.model.information
    .map((i) => i.id)
    .filter((i) => authority.covers(a, i));

/** Whether two authorisations' scopes share a goal (as subtrees; none: every goal). */
const scopesIntersect = (
  index: StsIndex,
  a: StsAuthorisation,
  b: StsAuthorisation,
) => {
  if (!a.scope.length || !b.scope.length) return true;
  const inA = new Set(a.scope.flatMap((g) => index.subtree(g)));
  return b.scope.some((g) => index.subtree(g).some((x) => inA.has(x)));
};

/**
 * DKE Def. 5: two authorisations towards one actor over common
 * information conflict when one is scoped and the other isn't, or, their
 * scopes intersecting, one grants an operation the other prohibits, or
 * they differ on transferability (both granting something: a prohibition
 * passes no right to transfer, DKE §3.2.2). One finding per actor,
 * information and what conflicts, with every pair that does.
 */
export const authorisationConflicts = (
  index: StsIndex,
  authority: Authority = authorityOf(index),
): StsFinding[] => {
  const found = new Map<
    string,
    {
      actor: string;
      information: string;
      on: string;
      links: Set<string>;
      from: Set<string>;
    }
  >();
  const note = (
    actor: string,
    information: string,
    on: string,
    a: StsAuthorisation,
    b: StsAuthorisation,
  ) => {
    const key = `${actor}\n${information}\n${on}`;
    const entry = found.get(key) ?? {
      actor,
      information,
      on,
      links: new Set<string>(),
      from: new Set<string>(),
    };
    entry.links.add(a.id).add(b.id);
    entry.from.add(a.from).add(b.from);
    found.set(key, entry);
  };
  for (const actor of index.model.actors) {
    const incoming = index.authorisationsTo(actor.id);
    incoming.forEach((a, i) =>
      incoming.slice(i + 1).forEach((b) => {
        const common = coverOf(index, authority, a).filter((x) =>
          authority.covers(b, x),
        );
        for (const information of common) {
          if (!a.scope.length !== !b.scope.length) {
            note(actor.id, information, 'scope', a, b);
            continue;
          }
          if (!scopesIntersect(index, a, b)) continue;
          for (const op of OPERATIONS)
            if (
              (a.granted.includes(op) && b.prohibited.includes(op)) ||
              (b.granted.includes(op) && a.prohibited.includes(op))
            )
              note(actor.id, information, op, a, b);
          if (
            a.transferable !== b.transferable &&
            a.granted.length &&
            b.granted.length
          )
            note(actor.id, information, 'transferability', a, b);
        }
      }),
    );
  }
  return [...found.values()].map(({ actor, information, on, links, from }) => {
    const what =
      on === 'scope'
        ? 'the goal scope (one is limited to goals, the other is not)'
        : on === 'transferability'
          ? 'the authority to transfer authorisations'
          : `${OPERATION_NOUN[on as Operation]} of ${quote(index.name(information))}`;
    return finding(
      'authorisationConflict',
      'error',
      `The authorisations from ${list([...from].map((x) => quote(index.name(x))))} to ${quote(index.name(actor))} over ${quote(index.name(information))} conflict on ${what}`,
      [actor, information, ...from],
      [...links],
      { actor, information, on },
    );
  });
};

/** A delegation's need, by the dialect's name (#160 item 1 §2). */
const hasNeed = (d: StsDelegation, need: string) => d.needs.includes(need);

/**
 * R7, no-redelegation (DKE Table 7; manual App. B): the delegatee
 * delegates the delegated goal or any of its subgoals, in a variant where
 * it pursues the delegation.
 */
const noRedelegation = (index: StsIndex, variants: Variants): StsFinding[] =>
  index.model.delegations
    .filter((d) => hasNeed(d, 'noRedelegation') && d.received !== undefined)
    .flatMap((d) =>
      index.subtree(d.received!).flatMap((goal) =>
        index
          .delegationsOf(goal)
          .filter(() => variants.possible([d.goal, goal]))
          .map((e) =>
            finding(
              'noRedelegation',
              'error',
              `${quote(index.name(d.from))} requires ${quote(index.name(d.to))} not to redelegate ${quote(index.name(d.goal))}, and yet ${quote(index.name(d.to))} delegates ${quote(index.name(goal))} to ${quote(index.name(e.to))}`,
              [d.to, goal, d.received!, d.from, e.to],
              [d.id, e.id],
              {
                requester: d.from,
                responsible: d.to,
                goal: d.received!,
                redelegated: goal,
                to: e.to,
              },
            ),
          ),
      ),
    );

/**
 * R3–R6, redundancy (DKE §4.2.2.2; manual App. B (1)–(3)): true and
 * fallback alike. Violated when the delegatee doesn't OR-decompose the
 * delegated goal; single-actor, when it delegates one of the goal's
 * subgoals; multi-actor, when it delegates none.
 */
const redundancy = (index: StsIndex): StsFinding[] =>
  index.model.delegations.flatMap((d) => {
    const single =
      hasNeed(d, 'trueRedundancySingle') ||
      hasNeed(d, 'fallbackRedundancySingle');
    const multi =
      hasNeed(d, 'trueRedundancyMulti') ||
      hasNeed(d, 'fallbackRedundancyMulti');
    if ((!single && !multi) || d.received === undefined) return [];
    const goal = d.received;
    const decomposition = index.decompositionOf(goal);
    const below = index.subtree(goal).slice(1);
    const redelegated = below.filter((g) => index.delegationsOf(g).length);
    const why =
      decomposition?.type !== 'or'
        ? `doesn't decompose ${quote(index.name(goal))} into alternatives`
        : single && redelegated.length
          ? `delegates ${list(redelegated.map((g) => quote(index.name(g))))} to other actors`
          : multi && !redelegated.length
            ? `involves no other actor in the alternatives for ${quote(index.name(goal))}`
            : null;
    if (!why) return [];
    const kind = single ? 'singleRedundancy' : 'multiRedundancy';
    return [
      finding(
        kind,
        'error',
        `${quote(index.name(d.from))} requires ${quote(index.name(d.to))} ${single ? 'single' : 'multi'}-actor redundancy for ${quote(index.name(goal))}, but ${quote(index.name(d.to))} ${why}`,
        [d.to, goal, d.from, ...redelegated],
        [
          d.id,
          ...redelegated.flatMap((g) =>
            index.delegationsOf(g).map((e) => e.id),
          ),
        ],
        { requester: d.from, responsible: d.to, goal },
      ),
    ];
  });

const NEED_OF_USE: Record<'read' | 'modify' | 'produce', string> = {
  read: 'nonReading',
  modify: 'nonModification',
  produce: 'nonProduction',
};
const VERB: Record<Operation, string> = {
  read: 'reads',
  modify: 'modifies',
  produce: 'produces',
  transmit: 'transmits',
};

/**
 * R27–R30 (DKE Table 7): a goal of a variant reads, modifies or produces a
 * document conveying information its actor has no right to that operation
 * on, for that goal: need-to-know when the actor has the right for other
 * goals, non-reading, non-modification or non-production otherwise.
 */
const uses = (
  index: StsIndex,
  authority: Authority,
  variants: Variants,
): StsFinding[] =>
  index.model.uses.flatMap((use) => {
    const actor = index.actorOf(use.goal);
    if (actor === undefined || !variants.possible([use.goal])) return [];
    return authority.conveyed(use.document).flatMap((conveyed) => {
      const { information } = conveyed;
      const forGoal = authority.rightTo(actor, conveyed, use.kind, use.goal);
      if (forGoal.holds) return [];
      const anyGoal = authority.rightTo(actor, conveyed, use.kind);
      const subject = `${quote(index.name(actor))} ${VERB[use.kind]} ${quote(index.name(use.document))}, which makes ${shows(index, conveyed)} tangible, for ${quote(index.name(use.goal))}`;
      if (anyGoal.holds) {
        // a whole conveyed through its parts is authorised through them (#160 D-G4)
        const sources = conveyed.through.length
          ? conveyed.through
          : [information];
        const scoped = [
          ...new Set(
            sources.flatMap((i) =>
              authority
                .incoming(actor, i, use.kind)
                .granting.filter((a) => a.scope.length),
            ),
          ),
        ];
        const requesters = [...new Set(scoped.map((a) => a.from))];
        return [
          finding(
            'needToKnow',
            'error',
            `${list(requesters.map((x) => quote(index.name(x))))} ${verb(requesters, 'authorise')} ${quote(index.name(actor))} on ${quote(index.name(information))} only for ${list([...new Set(scoped.flatMap((a) => a.scope))].map((g) => quote(index.name(g))))}, but ${subject}`,
            [actor, information, use.goal, use.document, ...requesters],
            [use.id, ...scoped.map((a) => a.id)],
            {
              requester: requesters.join(','),
              responsible: actor,
              information,
              goal: use.goal,
              operation: use.kind,
            },
          ),
        ];
      }
      const kind = NEED_OF_USE[use.kind];
      return [
        finding(
          kind,
          'error',
          `${forGoal.explicit ? `${list(forGoal.requesters.map((x) => quote(index.name(x))))} ${verb(forGoal.requesters, 'prohibit')}` : `No authorisation grants`} ${quote(index.name(actor))} the ${OPERATION_NOUN[use.kind]} of ${quote(index.name(information))}, but ${subject}`,
          [actor, information, use.goal, use.document, ...forGoal.requesters],
          [use.id, ...forGoal.authorisations],
          {
            requester: forGoal.requesters.join(','),
            responsible: actor,
            information,
            goal: use.goal,
            explicit: String(forGoal.explicit),
          },
        ),
      ];
    });
  });

/**
 * When an actor can possess a document in a variant (DKE Def. 3(4)): it
 * has it from scratch, a goal of its pursued produces it, or it is
 * transmitted to it by an actor that possesses it.
 */
const possessionOf = (
  index: StsIndex,
  document: string,
  seen: ReadonlySet<string> = new Set(),
): AssertionTree => {
  if (seen.has(document)) return { kind: 'bool', value: false };
  const doc = index.model.documents.find((d) => d.id === document);
  const producers = index
    .usesOfDocument(document)
    .filter((u) => u.kind === 'produce')
    .map((u) => pursuedAtom(u.goal));
  const received = index
    .transmissionsTo(document)
    .map((t) => possessionOf(index, t.document, new Set([...seen, document])));
  const fromScratch = doc?.possessed ?? false;
  return fromScratch
    ? { kind: 'bool', value: true }
    : formula.or([...producers, ...received]);
};

/**
 * R31, non-disclosure (DKE Table 7; manual App. B): an actor transmits a
 * document conveying information it has no right to transmit, in a
 * variant where it possesses the document.
 */
const disclosures = (
  index: StsIndex,
  authority: Authority,
  variants: Variants,
): StsFinding[] =>
  index.model.transmissions.flatMap((t) => {
    if (!variants.possibleThat(possessionOf(index, t.document))) return [];
    return authority.conveyed(t.document).flatMap((conveyed) => {
      const { information } = conveyed;
      const right = authority.rightTo(t.from, conveyed, 'transmit');
      return right.holds
        ? []
        : [
            finding(
              'nonDisclosure',
              'error',
              `${right.explicit ? `${list(right.requesters.map((x) => quote(index.name(x))))} ${verb(right.requesters, 'prohibit')}` : 'No authorisation grants'} ${quote(index.name(t.from))} the transmission of ${quote(index.name(information))}, but ${quote(index.name(t.from))} transmits ${quote(index.name(t.document))}, which makes ${shows(index, conveyed)} tangible, to ${quote(index.name(t.to))}`,
              [t.from, information, t.document, t.to, ...right.requesters],
              [t.id, ...right.authorisations],
              {
                requester: right.requesters.join(','),
                responsible: t.from,
                information,
                to: t.to,
                explicit: String(right.explicit),
              },
            ),
          ];
    });
  });

/**
 * R32, non-reauthorisation (DKE §3.2.2, Table 7, §5.1.2; manual App. B
 * "Authority Violations" and "Unauthorized Delegation of …"): explicitly,
 * an actor that received information non-transferably (by an
 * authorisation granting something) authorises others with a permission on
 * it; implicitly, an actor authorises an operation it has no right to
 * itself. The owner may authorise anything.
 */
const reauthorisations = (
  index: StsIndex,
  authority: Authority,
): StsFinding[] =>
  index.model.authorisations
    .filter((b) => b.granted.length)
    .flatMap((b) =>
      coverOf(index, authority, b).flatMap((information) => {
        if (authority.ownersOf(information).includes(b.from)) return [];
        const nonTransferable = index
          .authorisationsTo(b.from)
          .filter(
            (a) =>
              !a.transferable &&
              a.granted.length &&
              authority.covers(a, information),
          );
        const explicit = nonTransferable.length
          ? [
              finding(
                'nonReauthorisation',
                'error',
                `${list([...new Set(nonTransferable.map((a) => quote(index.name(a.from))))])} ${verb([...new Set(nonTransferable.map((a) => a.from))], 'authorise')} ${quote(index.name(b.from))} on ${quote(index.name(information))} without the right to transfer it, but ${quote(index.name(b.from))} authorises ${quote(index.name(b.to))} on it`,
                [
                  b.from,
                  information,
                  b.to,
                  ...nonTransferable.map((a) => a.from),
                ],
                [b.id, ...nonTransferable.map((a) => a.id)],
                {
                  requester: [
                    ...new Set(nonTransferable.map((a) => a.from)),
                  ].join(','),
                  responsible: b.from,
                  information,
                  to: b.to,
                },
              ),
            ]
          : [];
        const operations = b.granted.flatMap((operation) => {
          const right = authority.right(b.from, information, operation);
          return right.holds
            ? []
            : [
                finding(
                  'nonReauthorisationOperation',
                  'error',
                  `${quote(index.name(b.from))} has no right to the ${OPERATION_NOUN[operation]} of ${quote(index.name(information))}, but authorises ${quote(index.name(b.to))} to it`,
                  [b.from, information, b.to, ...right.requesters],
                  [b.id, ...right.authorisations],
                  {
                    requester: right.requesters.join(','),
                    responsible: b.from,
                    information,
                    to: b.to,
                    operation,
                  },
                ),
              ];
        });
        return [...explicit, ...operations];
      }),
    );

/**
 * The goals that are a goal's work, wherever it is done: the goal, its
 * subgoals, and the goals of the actors it is delegated to, as theirs.
 */
const workOf = (index: StsIndex, goal: string) =>
  reachable([goal], (g) => [
    ...index.subgoals(g),
    ...index
      .delegationsOf(g)
      .flatMap((d) => (d.received !== undefined ? [d.received] : [])),
  ]);

/**
 * Who answers for duties (DKE R23–R26: "all agents"): each agent, with the
 * roles it plays, and each role no agent is known to play.
 */
const dutyHolders = (index: StsIndex) => {
  const { actors, plays } = index.model;
  const played = new Set(plays.map((p) => p.role));
  return [
    ...actors
      .filter((a) => a.kind === 'agent')
      .map((a) => ({
        actor: a.id,
        agent: true,
        as: [a.id, ...plays.filter((p) => p.agent === a.id).map((p) => p.role)],
      })),
    ...actors
      .filter((a) => a.kind === 'role' && !played.has(a.id))
      .map((a) => ({ actor: a.id, agent: false, as: [a.id] })),
  ];
};

/**
 * Whether one of these actors, in a variant, pursues part of a goal (one
 * of its work goals is in its strategy, DKE R24), or, `final`, performs it:
 * pursues it and doesn't delegate it (the final performer, DKE §4.2.2.1).
 */
const pursues = (
  index: StsIndex,
  as: readonly string[],
  goal: string,
  final: boolean,
): AssertionTree =>
  formula.or(
    workOf(index, goal)
      .filter(
        (g) =>
          as.includes(index.actorOf(g) ?? '') &&
          !(final && index.delegationsOf(g).length),
      )
      .map(pursuedAtom),
  );

/**
 * R23–R26, separation and combination of duties (DKE Table 7, §4.2.2.1;
 * manual App. B "Business Violation"). By role: an agent plays both roles
 * (SoD), or one and not the other (CoD). By goal (#160 D-G17):
 * - SoD: in some variant one agent, or a role no agent plays, pursues part
 *   of both goals (DKE R24, "should not pursue both … or their subgoals");
 * - CoD: in some variant one of them is the final performer of part of
 *   one goal and not of the other (DKE §4.2.2.1). When none is, but only a
 *   role no agent plays performs both, two agents playing it may still
 *   split them: a warning, as the NESSoS chapter's Fig. 37 shows it.
 */
const duties = (index: StsIndex, variants: Variants): StsFinding[] =>
  index.model.duties.flatMap((duty) => {
    const pair = [duty.first, duty.second] as const;
    const names = pair.map((x) => quote(index.name(x)));
    if (duty.of === 'role') {
      const agents = index.model.actors.filter((a) => a.kind === 'agent');
      return agents.flatMap((agent) => {
        const plays = pair.map((r) =>
          index.model.plays.some((p) => p.agent === agent.id && p.role === r),
        );
        const violated =
          duty.type === 'sod' ? plays[0] && plays[1] : plays[0] !== plays[1];
        return violated
          ? [
              finding(
                duty.type === 'sod' ? 'roleSod' : 'roleCod',
                'error',
                duty.type === 'sod'
                  ? `${quote(agent.name)} plays both ${list(names)}, between which a separation of duties is required`
                  : `${quote(agent.name)} plays only one of ${list(names)}, between which a combination of duties is required`,
                [agent.id, ...pair],
                [duty.id],
                {
                  responsible: agent.id,
                  first: duty.first,
                  second: duty.second,
                },
              ),
            ]
          : [];
      });
    }
    const holders = dutyHolders(index);
    const [first, second] = pair;
    const sod = duty.type === 'sod';
    const witnesses = holders.filter((holder) => {
      const a = pursues(index, holder.as, first, !sod);
      const b = pursues(index, holder.as, second, !sod);
      return variants.possibleThat(
        sod
          ? formula.and([a, b])
          : formula.or([
              formula.and([a, formula.not(b)]),
              formula.and([b, formula.not(a)]),
            ]),
      );
    });
    const possible =
      !sod && !witnesses.length
        ? holders.filter(
            (holder) =>
              !holder.agent &&
              variants.possibleThat(
                formula.and([
                  pursues(index, holder.as, first, true),
                  pursues(index, holder.as, second, true),
                ]),
              ),
          )
        : [];
    const who = (list_: typeof holders) =>
      list(list_.map((w) => quote(index.name(w.actor))));
    const details = (list_: typeof holders) => ({
      first,
      second,
      witnesses: list_.map((w) => w.actor).join(','),
    });
    if (witnesses.length)
      return [
        finding(
          sod ? 'goalSod' : 'goalCod',
          'error',
          sod
            ? `A separation of duties is required between ${list(names)}, but ${who(witnesses)} may pursue both`
            : `A combination of duties is required between ${list(names)}, but ${who(witnesses)} may perform one without the other`,
          [...pair, ...witnesses.map((w) => w.actor)],
          [duty.id],
          details(witnesses),
        ),
      ];
    return possible.length
      ? [
          finding(
            'goalCod',
            'warning',
            `A combination of duties is required between ${list(names)}, which ${who(possible)} performs, but no agent is known to play it: agents playing it may split them`,
            [...pair, ...possible.map((w) => w.actor)],
            [duty.id],
            details(possible),
          ),
        ]
      : [];
  });

/** Every finding of the security analysis, conflicts among authorisations first. */
export const securityAnalysis = (index: StsIndex): StsFinding[] => {
  const authority = authorityOf(index);
  const variants = variantsOf(index);
  return [
    ...authorisationConflicts(index, authority),
    ...noRedelegation(index, variants),
    ...redundancy(index),
    ...uses(index, authority, variants),
    ...disclosures(index, authority, variants),
    ...reauthorisations(index, authority),
    ...duties(index, variants),
  ];
};
