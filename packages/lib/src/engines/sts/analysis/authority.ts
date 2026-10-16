/**
 * What an actor may do with information (DKE §3.1.3 and Def. 4). An
 * authorisation over information covers its parts too. The owner has every
 * right, and prohibitions don't bind it. Anyone else has a right when an
 * incoming authorisation grants it, for the goal at hand when one is
 * scoped, and none prohibits it ("authorisations are summed up"). Without
 * one, the owner's implicit prohibition holds (Def. 4, the authorisation
 * closure). That actor's requesters are then the owners, and otherwise the
 * explicit prohibitors.
 */
import type { StsIndex } from './graph';
import type { Operation, StsAuthorisation } from './model';

export type Authority = ReturnType<typeof authorityOf>;

export const authorityOf = (index: StsIndex) => {
  const { model } = index;
  /** Information an authorisation covers: what it names and their parts (DKE §3.1.3). */
  const covers = (authorisation: StsAuthorisation, information: string) =>
    authorisation.information.some(
      (i) => i === information || index.partsOfDeep(i).includes(information),
    );
  /** Whether a goal is in an authorisation's scope: its goals' subtrees, or everywhere when it has none. */
  const inScope = (authorisation: StsAuthorisation, goal?: string) =>
    goal === undefined ||
    authorisation.scope.length === 0 ||
    authorisation.scope.some((g) => index.subtree(g).includes(goal));

  /**
   * The owners of information: its own, and those of every whole it is
   * part of. An owner's full rights cover the parts, as an authorisation's
   * do (DKE §3.1.3, #160 D-G13).
   */
  const ownersOf = (information: string): string[] => [
    ...new Set(
      [information, ...index.wholesOfDeep(information)].flatMap((i) =>
        model.ownerships.filter((o) => o.information === i).map((o) => o.actor),
      ),
    ),
  ];

  /** The incoming authorisations granting and prohibiting an operation on information, for a goal. */
  const incoming = (
    actor: string,
    information: string,
    operation: Operation,
    goal?: string,
  ) => {
    const relevant = index
      .authorisationsTo(actor)
      .filter((a) => covers(a, information) && inScope(a, goal));
    return {
      granting: relevant.filter((a) => a.granted.includes(operation)),
      prohibiting: relevant.filter((a) => a.prohibited.includes(operation)),
    };
  };

  /**
   * Whether an actor has the right to an operation on information, for a
   * goal (any goal, when none), and if not, who requires it not to (the
   * explicit prohibitors, or else the owners) and by which authorisations.
   */
  const right = (
    actor: string,
    information: string,
    operation: Operation,
    goal?: string,
  ):
    | { holds: true }
    | {
        holds: false;
        explicit: boolean;
        requesters: string[];
        authorisations: string[];
      } => {
    if (ownersOf(information).includes(actor)) return { holds: true };
    const { granting, prohibiting } = incoming(
      actor,
      information,
      operation,
      goal,
    );
    if (granting.length && !prohibiting.length) return { holds: true };
    return prohibiting.length
      ? {
          holds: false,
          explicit: true,
          requesters: [...new Set(prohibiting.map((a) => a.from))],
          authorisations: prohibiting.map((a) => a.id),
        }
      : {
          holds: false,
          explicit: false,
          requesters: ownersOf(information),
          authorisations: [],
        };
  };

  /**
   * The information a document conveys (DKE Table 7: "D makes tangible
   * (part of) I", #160 D-G4): what it makes tangible and their parts, and
   * the wholes they are part of, `through` the parts it makes tangible.
   */
  const conveyed = (
    document: string,
  ): { information: string; through: string[] }[] => {
    const direct = index
      .tangibleIn(document)
      .flatMap((i) => [i, ...index.partsOfDeep(i)]);
    const wholes = new Map<string, string[]>();
    for (const part of index.tangibleIn(document))
      for (const whole of index.wholesOfDeep(part))
        if (!direct.includes(whole))
          wholes.set(whole, [...(wholes.get(whole) ?? []), part]);
    return [
      ...[...new Set(direct)].map((information) => ({
        information,
        through: [],
      })),
      ...[...wholes].map(([information, through]) => ({
        information,
        through,
      })),
    ];
  };

  /**
   * An actor's right to an operation on information a document conveys,
   * for a goal. Conveyed through some of its parts, a whole is used no
   * further than those parts: the right to each of them suffices (#160
   * D-G4, the Healthcare report's rows on *medical history info*).
   */
  const rightTo = (
    actor: string,
    { information, through }: { information: string; through: string[] },
    operation: Operation,
    goal?: string,
  ) => {
    const own = right(actor, information, operation, goal);
    return !own.holds &&
      through.length > 0 &&
      through.every((part) => right(actor, part, operation, goal).holds)
      ? ({ holds: true } as const)
      : own;
  };

  return { covers, inScope, ownersOf, incoming, right, conveyed, rightTo };
};
