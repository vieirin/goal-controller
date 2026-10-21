/**
 * What applying a countermeasure does to a KAOS model (goal-controller#191,
 * D2): a transformation of the model in memory, per TSE'00 strategy and per
 * SEAMS'17 countermeasure form, whose result (a variant) kaosprop
 * propagates. The file is untouched; writing a variant back is a later
 * "apply" action.
 *
 * A countermeasure is a resolution link, from its countermeasure goal (CG)
 * to the obstacle (O) it resolves, read in kaosres's dialect: its
 * `ResolutionType` (TSE'00's strategy), `Anchor`, `Form`, `Condition`,
 * `Replaces` and `Cost`. Its `Form`, when set, says what it does; otherwise
 * its strategy does. Every integration is one of these (the definitions they
 * follow are quoted in packages/dialect/docs/frameworks.md, "KAOS stress
 * test, step 4 part A"):
 *
 * - `substitute` (goal substitution, agent substitution, goal
 *   deidealization by weakening; the thesis's first integration schema,
 *   KAOSTools' `RemoveObstructedGoal`): the anchor's one refinement loses
 *   its children O obstructs, directly or below them, and gains CG;
 * - `replace` (the form `replaces`): CG takes the goal it `Replaces`'s place
 *   in every refinement that goal is in;
 * - `anchor` (obstacle prevention, reduction, mitigation weak or strong,
 *   goal restoration, the form `except`; SEAMS'17 §VI.A's "the anchor goal
 *   is refined into two subgoals; one subgoal is the obstructed goal
 *   conjoined with the negation of the obstacle condition; the other subgoal
 *   is the countermeasure goal"): the anchor is refined into K, its own
 *   refinements and obstructions with O false below it, and CG. With the
 *   `model` scope, O is false everywhere instead (KAOSTools'
 *   `obstacle.Resolved = true`) and K keeps the anchor's content as it is;
 * - `deidealize` (the forms `provided`, `providedNot`, `relaxedTo`: an extra
 *   conjunct on CG's antecedent, an extra disjunct on its consequent): CG
 *   itself is weakened to cover O, so O, false, no longer obstructs it;
 * - `eliminate` (domain transformation: the obstacle made inconsistent with
 *   the domain): O cannot occur, anywhere;
 * - `record` (do-nothing): nothing changes; the decision is the resolution.
 *
 * "O false below a goal" is a copy: the goal's sub-goals and obstacle trees
 * that O reaches are copied with O's branches cut (an AND with a false
 * member is false; an obstruction by O itself goes), and an original that
 * nothing uses any more is removed and its copy takes its id back, so a
 * goal or obstacle only O reached is changed in place, and one also used
 * elsewhere is kept there, beside its copy (named "… unless O"). The
 * resolved obstacle itself stays, a root of its own, with its resolutions.
 *
 * Countermeasures are applied one after another, in the model's order of
 * their links; each reads the model the previous ones gave.
 */
import {
  elementKindDefinition,
  inheritMetamodel,
  linkKindDefinition,
  withMetamodel,
  type ElementKindOf,
  type IstarElement,
  type IstarLink,
  type IstarModel,
  type LinkKindOf,
} from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import { KAOS_VOCABULARIES } from '../../dialects/kaos';
import { viewValues, type AnalysisModel, type ViewValues } from '../analysis';
import { kaosres, type CountermeasureForm } from './definition';

/** A KAOS model's element kinds, its obstacle analysis's too (istar-ts's `KAOS_OBSTACLES`). */
export type KaosElementKind = ElementKindOf<typeof KAOS_OBSTACLES>;
/** A KAOS model's link kinds, its obstacle analysis's too. */
export type KaosLinkKind = LinkKindOf<typeof KAOS_OBSTACLES>;
/** A KAOS model as the workbench reads it: KAOS with its obstacle analysis, kinds typed. */
export type KaosModel = IstarModel<KaosElementKind, KaosLinkKind>;
type Element = IstarElement<KaosElementKind>;
type Link = IstarLink<KaosLinkKind>;

const GOAL_KINDS = [
  'kaos.BehavioralGoal',
  'kaos.Softgoal',
] as const satisfies readonly KaosElementKind[];
const OBSTACLE = 'kaosObstacles.Obstacle' satisfies KaosElementKind;
const GOAL_HUB = 'kaos.RefinementLinkHub' satisfies KaosElementKind;
const GOAL_LEG = 'kaos.RefinementLinkStart' satisfies KaosLinkKind;
const GOAL_END = 'kaos.RefinementLinkEnd' satisfies KaosLinkKind;
const OBSTACLE_HUB =
  'kaosObstacles.ObstacleRefinementLinkHub' satisfies KaosElementKind;
const OBSTACLE_LEG =
  'kaosObstacles.ObstacleRefinementLinkStart' satisfies KaosLinkKind;
const OBSTACLE_END =
  'kaosObstacles.ObstacleRefinementLinkEnd' satisfies KaosLinkKind;
const OBSTRUCTION = 'kaosObstacles.ObstructionLink' satisfies KaosLinkKind;
const RESOLUTION = 'kaosObstacles.ResolutionLink' satisfies KaosLinkKind;

const isGoal = (element: Element | undefined): element is Element =>
  !!element && GOAL_KINDS.some((kind) => kind === element.kind);

/** A resolution link's values, as kaosres's dialect reads them. */
type ResolutionValues = ViewValues<typeof kaosres>;

/** A vocabulary's value: a value, or a value and its label. */
type VocabularyValue<T> = T extends readonly [infer V, string] ? V : T;

/** TSE'00's resolution strategies, KAOSTools' names for two of them too (the `kaos` dialect's `ResolutionType`). */
export type ResolutionStrategy = VocabularyValue<
  (typeof KAOS_VOCABULARIES.ResolutionType)[number]
>;

/** What applying a countermeasure does to the model (see the module's comment). */
export type Integration =
  | 'substitute'
  | 'replace'
  | 'anchor'
  | 'deidealize'
  | 'eliminate'
  | 'record';

/**
 * Each strategy's integration: the thesis's (Cailliau 2017, ch. 5) and
 * KAOSTools' `ResolutionIntegrator`: substitution and weakening remove the
 * obstructed goal, prevention, reduction, mitigation and restoration keep
 * it; agent substitution as the thesis's example applies it (its
 * countermeasure replaces the old refinement); domain transformation and
 * do-nothing, TSE'00's own words (§6.1.5, §6.3.3).
 */
export const STRATEGY_INTEGRATIONS = {
  'goal substitution': 'substitute',
  'agent substitution': 'substitute',
  'goal deidealization': 'substitute',
  'obstacle prevention': 'anchor',
  prevention: 'anchor',
  'obstacle reduction': 'anchor',
  'goal restoration': 'anchor',
  'obstacle mitigation': 'anchor',
  mitigation: 'anchor',
  'weak mitigation': 'anchor',
  'strong mitigation': 'anchor',
  'domain transformation': 'eliminate',
  'do-nothing': 'record',
} as const satisfies Record<ResolutionStrategy, Integration>;

/** Each countermeasure form's integration (the thesis's ch. 5: Except is the second schema). */
export const FORM_INTEGRATIONS = {
  except: 'anchor',
  replaces: 'replace',
  provided: 'deidealize',
  providedNot: 'deidealize',
  relaxedTo: 'deidealize',
} as const satisfies Record<CountermeasureForm, Integration>;

/**
 * Where a kept obstructed goal no longer sees the obstacle: below the
 * anchor (`anchor`, SEAMS'17 and the thesis, the default), or everywhere
 * (`model`, KAOSTools' `obstacle.Resolved = true`).
 */
export type ResolutionScope = 'anchor' | 'model';

/** A countermeasure: a resolution link, as kaosres's dialect reads it. */
export type Countermeasure = {
  /** the resolution link's id */
  id: string;
  /** the countermeasure goal */
  goal: string;
  obstacle: string;
  strategy: ResolutionStrategy | null;
  form: CountermeasureForm | null;
  anchor: string | null;
  replaces: string | null;
  condition: string | null;
  cost: number | null;
};

/** A countermeasure applied: how, where, and what it added (new element ids). */
export type AppliedCountermeasure = {
  countermeasure: Countermeasure;
  integration: Integration;
  /**
   * the goals it was integrated at, where its obstacle no longer obstructs:
   * the anchor; a replaced goal's parents; the deidealized goal; none for
   * an obstacle eliminated or tolerated
   */
  at: readonly string[];
  /** the elements it added (K, its hub, a copy beside an original still used elsewhere) */
  added: readonly string[];
  /** what it did, in words */
  summary: string;
};

/** Why a countermeasure wasn't applied, or what to know about it. */
export type CountermeasureProblem = {
  countermeasure: string;
  severity: 'error' | 'warning';
  message: string;
};

/** A model with countermeasures applied, and what each did. */
export type CountermeasureVariant = {
  model: KaosModel;
  applied: readonly AppliedCountermeasure[];
  /** an `error` is a countermeasure not applied */
  problems: readonly CountermeasureProblem[];
  /** the applied countermeasures' `Cost`s, summed (SEAMS'17's resolution cost; an unset one counts 0) */
  cost: number;
};

export type ApplyOptions = { scope?: ResolutionScope };

/** A link's kaosres values, read once per link object. */
const valuesRead = new WeakMap<Link, ResolutionValues>();
const valuesOf = (link: Link): ResolutionValues => {
  let values = valuesRead.get(link);
  if (!values)
    valuesRead.set(
      link,
      (values = viewValues(kaosres, 'link', {
        kind: link.kind,
        // open: every key as read; the dialect reads its own
        properties: link.customProperties ?? {},
      })),
    );
  return values;
};

const isStrategy = (value: unknown): value is ResolutionStrategy =>
  typeof value === 'string' && Object.hasOwn(STRATEGY_INTEGRATIONS, value);
const isForm = (value: unknown): value is CountermeasureForm =>
  typeof value === 'string' && Object.hasOwn(FORM_INTEGRATIONS, value);

/** A text value, `null` when unset or empty. */
const textOf = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** Every resolution link of the model, as a countermeasure, in the model's order. */
export const countermeasuresOf = (model: KaosModel): Countermeasure[] =>
  [...model.links.values()]
    .filter((link) => link.kind === RESOLUTION)
    .map((link) => {
      const values = valuesOf(link);
      return {
        id: link.id,
        goal: link.source,
        obstacle: link.target,
        strategy: isStrategy(values.ResolutionType)
          ? values.ResolutionType
          : null,
        form: isForm(values.Form) ? values.Form : null,
        anchor: textOf(values.Anchor),
        replaces: textOf(values.Replaces),
        condition: textOf(values.Condition),
        cost: typeof values.Cost === 'number' ? values.Cost : null,
      };
    });

/** A countermeasure's integration: its form's, else its strategy's; none when it has neither. */
export const integrationOf = (
  countermeasure: Countermeasure,
): Integration | null =>
  countermeasure.form
    ? FORM_INTEGRATIONS[countermeasure.form]
    : countermeasure.strategy
      ? STRATEGY_INTEGRATIONS[countermeasure.strategy]
      : null;

/** A countermeasure can't be applied: why. */
class Refused extends Error {}

/**
 * The model's elements and links while countermeasures are applied: mutable
 * maps in the model's order, and the graph's queries over them.
 */
class Working {
  readonly elements: Map<string, Element>;
  readonly links: Map<string, Link>;

  constructor(model: KaosModel) {
    this.elements = new Map(model.elements);
    this.links = new Map(model.links);
  }

  element(id: string): Element | undefined {
    return this.elements.get(id);
  }

  /** A fresh id from `base`: `base`, `base-2`, … */
  freshId(base: string): string {
    let id = base;
    for (let n = 2; this.elements.has(id) || this.links.has(id); n++)
      id = `${base}-${n}`;
    return id;
  }

  linksWhere(test: (link: Link) => boolean): Link[] {
    return [...this.links.values()].filter(test);
  }

  /** The hubs refining an element (a goal's or an obstacle's), in order. */
  hubsOf(id: string): Element[] {
    return this.linksWhere(
      (l) =>
        (l.kind === GOAL_END || l.kind === OBSTACLE_END) && l.target === id,
    ).flatMap((l) => this.elements.get(l.source) ?? []);
  }

  /** A hub's legs, in order. */
  legsOf(hub: string): Link[] {
    return this.linksWhere(
      (l) =>
        (l.kind === GOAL_LEG || l.kind === OBSTACLE_LEG) && l.target === hub,
    );
  }

  /** The element a hub refines. */
  parentOfHub(hub: string): string | undefined {
    return this.linksWhere(
      (l) =>
        (l.kind === GOAL_END || l.kind === OBSTACLE_END) && l.source === hub,
    )[0]?.target;
  }

  /** The goals an element is a sub-goal of. */
  parentsOf(id: string): string[] {
    return this.linksWhere(
      (l) => l.kind === GOAL_LEG && l.source === id,
    ).flatMap((l) => this.parentOfHub(l.target) ?? []);
  }

  obstructionsOf(goal: string): Link[] {
    return this.linksWhere((l) => l.kind === OBSTRUCTION && l.target === goal);
  }

  /** Whether `obstacle`'s tree has `o` (it, or below it). */
  contains(obstacle: string, o: string, seen = new Set<string>()): boolean {
    if (obstacle === o) return true;
    if (seen.has(obstacle)) return false;
    seen.add(obstacle);
    return this.hubsOf(obstacle).some((hub) =>
      this.legsOf(hub.id).some((leg) => this.contains(leg.source, o, seen)),
    );
  }

  /** Whether `o` obstructs a goal: it, or a goal below it. */
  affects(goal: string, o: string, seen = new Set<string>()): boolean {
    if (seen.has(goal)) return false;
    seen.add(goal);
    return (
      this.obstructionsOf(goal).some((l) => this.contains(l.source, o)) ||
      this.hubsOf(goal).some((hub) =>
        this.legsOf(hub.id).some((leg) => this.affects(leg.source, o, seen)),
      )
    );
  }

  /** The goals an obstacle's tree obstructs (KAOSTools' `GetObstructedGoalIdentifiers`, before its ancestors). */
  obstructedBy(o: string): string[] {
    return [
      ...new Set(
        this.linksWhere(
          (l) => l.kind === OBSTRUCTION && this.contains(l.source, o),
        ).map((l) => l.target),
      ),
    ];
  }

  /** Whether `ancestor` is `goal` or above it. */
  isAbove(ancestor: string, goal: string, seen = new Set<string>()): boolean {
    if (ancestor === goal) return true;
    if (seen.has(goal)) return false;
    seen.add(goal);
    return this.parentsOf(goal).some((p) => this.isAbove(ancestor, p, seen));
  }

  /** A goal or an obstacle by its id, or (a goal) by its name. */
  goalNamed(reference: string): Element | undefined {
    const byId = this.elements.get(reference);
    if (isGoal(byId)) return byId;
    return [...this.elements.values()].find(
      (e) => isGoal(e) && e.name.trim() === reference.trim(),
    );
  }

  addElement(element: Element) {
    this.elements.set(element.id, element);
  }

  addLink(link: Link) {
    this.links.set(link.id, link);
  }

  removeLink(id: string) {
    this.links.delete(id);
  }

  /** The users of an element: the links that make it a sub-goal, a sub-obstacle or an obstructor. */
  users(id: string): number {
    return this.linksWhere(
      (l) =>
        l.source === id &&
        (l.kind === GOAL_LEG ||
          l.kind === OBSTACLE_LEG ||
          l.kind === OBSTRUCTION),
    ).length;
  }

  /** Whether a resolution names it (its countermeasure goal or its obstacle): kept whatever else. */
  resolves(id: string): boolean {
    return (
      this.linksWhere(
        (l) => l.kind === RESOLUTION && (l.source === id || l.target === id),
      ).length > 0
    );
  }

  model(from: KaosModel): KaosModel {
    return inheritMetamodel(from, {
      ...from,
      elements: new Map(this.elements),
      links: new Map(this.links),
    });
  }
}

/** A name with O false: "… unless O". */
const unless = (name: string, obstacle: Element) =>
  `${name.trim()} unless ${obstacle.name.trim()}`;

/**
 * Copies of the goals and obstacle trees O reaches below `source`, with O's
 * branches cut, attached to `target` (its new hubs and obstructions), then
 * `source`'s own refinements and obstructions removed, and what nothing uses
 * any more removed, its copy taking its id back. `o` null copies without
 * cutting (the `model` scope's K).
 */
const restrictInto = (
  work: Working,
  source: string,
  target: string,
  o: string | null,
): string[] => {
  // what used what before: an element no longer used afterwards goes
  const usedBefore = new Set(
    [...work.elements.keys()].filter((id) => work.users(id) > 0),
  );
  const added: string[] = [];
  /** copies: an original's id → its copy's (elements and links) */
  const copies = new Map<string, string>();
  /** a copied element's name, by its copy's id */
  const names = new Map<string, string>();
  const obstacle = o === null ? undefined : work.element(o);

  const copyLink = (link: Link, change: Partial<Link>): Link => {
    const id = work.freshId(`${link.id}~`);
    copies.set(link.id, id);
    const copy: Link = { ...link, ...change, id };
    work.addLink(copy);
    return copy;
  };
  const copyElement = (element: Element, name: string): Element => {
    const id = work.freshId(`${element.id}~`);
    copies.set(element.id, id);
    names.set(id, element.name);
    const copy: Element = {
      ...element,
      id,
      name,
      x: element.x + 30,
      y: element.y + 30,
    };
    work.addElement(copy);
    added.push(id);
    // an agent's assignment and a conflict go with it
    for (const link of work.linksWhere(
      (l) =>
        (l.kind === 'kaos.ResponsibilityAssignment' ||
          l.kind === 'kaos.Conflict') &&
        (l.source === element.id || l.target === element.id),
    ))
      copyLink(link, {
        source: link.source === element.id ? id : link.source,
        target: link.target === element.id ? id : link.target,
      });
    return copy;
  };

  const obstacles = new Map<string, string | null>();
  /** an obstacle with O false: itself when O isn't in its tree, a copy, or null when it can't occur */
  const obstacleWithout = (id: string): string | null => {
    if (o === null || !work.contains(id, o)) return id;
    if (id === o) return null;
    if (obstacles.has(id)) return obstacles.get(id)!;
    const element = work.element(id)!;
    const hubs = work
      .hubsOf(id)
      .map((hub) => ({
        hub,
        legs: work.legsOf(hub.id).map((leg) => ({
          leg,
          child:
            work.element(leg.source)?.kind === OBSTACLE
              ? obstacleWithout(leg.source)
              : leg.source,
        })),
      }))
      // an AND with a false member is false
      .filter(({ legs }) => legs.every(({ child }) => child !== null));
    if (!hubs.length) {
      obstacles.set(id, null);
      return null;
    }
    const copy = copyElement(element, unless(element.name, obstacle!));
    obstacles.set(id, copy.id);
    for (const { hub, legs } of hubs) attachHub(hub, copy.id, legs);
    return copy.id;
  };

  /** a copy of `hub` refining `parent`, its legs' children as given */
  const attachHub = (
    hub: Element,
    parent: string,
    legs: { leg: Link; child: string | null }[],
  ) => {
    const copy = copyElement(hub, hub.name);
    const end = work.linksWhere(
      (l) =>
        (l.kind === GOAL_END || l.kind === OBSTACLE_END) && l.source === hub.id,
    )[0];
    if (end) copyLink(end, { source: copy.id, target: parent });
    for (const { leg, child } of legs)
      copyLink(leg, { source: child!, target: copy.id });
  };

  const goals = new Map<string, string>();
  /** a goal with O false: itself when O doesn't reach it, else a copy */
  const goalWithout = (id: string): string => {
    if (o === null || !work.affects(id, o)) return id;
    if (goals.has(id)) return goals.get(id)!;
    const element = work.element(id)!;
    const copy = copyElement(element, unless(element.name, obstacle!));
    goals.set(id, copy.id);
    contentInto(id, copy.id);
    return copy.id;
  };

  /** `from`'s refinements and obstructions, with O false, onto `to` */
  const contentInto = (from: string, to: string) => {
    for (const hub of work.hubsOf(from))
      attachHub(
        hub,
        to,
        work.legsOf(hub.id).map((leg) => ({
          leg,
          child: goalWithout(leg.source),
        })),
      );
    for (const obstruction of work.obstructionsOf(from)) {
      const by = obstacleWithout(obstruction.source);
      if (by !== null) copyLink(obstruction, { source: by, target: to });
    }
  };

  // source's content, as it was, then onto target
  const ownHubs = work.hubsOf(source).map((hub) => hub.id);
  const ownObstructions = work.obstructionsOf(source).map((l) => l.id);
  contentInto(source, target);
  for (const hub of ownHubs)
    for (const end of work.linksWhere(
      (l) =>
        (l.kind === GOAL_END || l.kind === OBSTACLE_END) && l.source === hub,
    ))
      work.removeLink(end.id);
  for (const id of ownObstructions) work.removeLink(id);

  // what nothing uses any more goes: a hub refining nothing, a goal or an
  // obstacle used before and no more (unless a resolution names it)
  const removed = new Set<string>();
  const remove = (id: string) => {
    removed.add(id);
    work.elements.delete(id);
    for (const link of work.linksWhere(
      (l) => l.source === id || l.target === id,
    ))
      work.removeLink(link.id);
  };
  for (let changed = true; changed;) {
    changed = false;
    // a Map's iteration survives deleting what it has visited
    for (const element of work.elements.values()) {
      const hub = element.kind === GOAL_HUB || element.kind === OBSTACLE_HUB;
      const orphan = hub
        ? work.parentOfHub(element.id) === undefined
        : usedBefore.has(element.id) &&
          work.users(element.id) === 0 &&
          !work.resolves(element.id) &&
          element.id !== target;
      if (orphan) {
        remove(element.id);
        changed = true;
      }
    }
  }

  // a copy whose original went takes its id (and its name) back
  const renamed = new Map<string, string>();
  for (const [original, copy] of copies)
    if (
      (removed.has(original) || !work.links.has(original)) &&
      !work.elements.has(original) &&
      (work.elements.has(copy) || work.links.has(copy))
    )
      renamed.set(copy, original);
  const back = (id: string) => renamed.get(id) ?? id;
  const elements = [...work.elements.values()].map((element) => {
    const id = back(element.id);
    return id === element.id
      ? element
      : { ...element, id, name: names.get(element.id) ?? element.name };
  });
  const links = [...work.links.values()].map((link) => ({
    ...link,
    id: back(link.id),
    source: back(link.source),
    target: back(link.target),
  }));
  work.elements.clear();
  for (const element of elements) work.elements.set(element.id, element);
  work.links.clear();
  for (const link of links) work.links.set(link.id, link);
  return added
    .filter((id) => !renamed.has(id))
    .filter((id) => work.elements.has(id));
};

/** O cannot occur: a leaf's estimate 0, a refined one's every refinement's P(O|SO) 0 (RE'12's own slots). */
const eliminate = (work: Working, o: string) => {
  const element = work.element(o)!;
  const hubs = work.hubsOf(o);
  // open: the obstacle's keys as read (DSM3's, kaosprop's, an expert's
  // Probability[e1]); its estimates go, the rest stays
  const kept = Object.fromEntries(
    Object.entries(element.customProperties ?? {}).filter(
      ([key]) => key !== 'Beta' && !key.startsWith('Probability['),
    ),
  );
  work.addElement({
    ...element,
    customProperties: hubs.length ? kept : { ...kept, Probability: '0' },
  });
  for (const hub of hubs)
    work.addElement({
      ...hub,
      customProperties: { ...hub.customProperties, Probability: '0' },
    });
};

/** A new goal, as DSM3 creates one (its keys present and empty). */
const newGoal = (
  id: string,
  name: string,
  near: Element,
  properties: Readonly<Record<'Description', string>>,
): Element => ({
  id,
  kind: 'kaos.BehavioralGoal',
  name,
  x: near.x,
  y: near.y + 120,
  customProperties: {
    Type: '',
    Category: '',
    Source: '',
    Priority: '',
    Issue: '',
    FormalSpec: '',
    FitCriterion: '',
    Stability: '',
    ...properties,
  },
});

/** `goal` refined by `children`, one new hub (an AND, no tactic). */
const refine = (work: Working, goal: Element, children: readonly string[]) => {
  const hub = work.freshId(`${goal.id}-refinement`);
  work.addElement({
    id: hub,
    kind: GOAL_HUB,
    name: '',
    x: goal.x + 57,
    y: goal.y + 70,
    customProperties: { SysRef: '', Status: '', Tactic: '' },
  });
  work.addLink({
    id: work.freshId(`${hub}-end`),
    kind: GOAL_END,
    source: hub,
    target: goal.id,
  });
  children.forEach((child, i) =>
    work.addLink({
      id: work.freshId(`${hub}-${i + 1}`),
      kind: GOAL_LEG,
      source: child,
      target: hub,
    }),
  );
  return hub;
};

/**
 * `cg` in `replaced`'s place in every refinement it is a sub-goal of, in
 * the refinement's order: how many.
 */
const replaceIn = (work: Working, replaced: Element, cg: Element): string[] => {
  const legs = work.linksWhere(
    (l) => l.kind === GOAL_LEG && l.source === replaced.id,
  );
  if (!legs.length)
    throw new Refused(
      `${replaced.name.trim()} is no sub-goal: nothing to replace it in`,
    );
  for (const leg of legs) {
    const parent = work.parentOfHub(leg.target);
    if (parent !== undefined && work.isAbove(cg.id, parent))
      throw new Refused(`${cg.id} is ${parent} or above it`);
  }
  for (const leg of legs)
    if (work.legsOf(leg.target).some((other) => other.source === cg.id))
      work.removeLink(leg.id);
    else work.addLink({ ...leg, source: cg.id });
  return [
    ...new Set(legs.flatMap((leg) => work.parentOfHub(leg.target) ?? [])),
  ];
};

/**
 * The one goal O obstructs in the model as given (not as earlier
 * countermeasures left it: one that resolved O below that goal already
 * doesn't move it), for a countermeasure with no anchor.
 */
const obstructedGoal = (
  work: Working,
  origin: Working,
  countermeasure: Countermeasure,
) => {
  const goals = origin.obstructedBy(countermeasure.obstacle);
  if (goals.length !== 1)
    throw new Refused(
      goals.length
        ? `${countermeasure.obstacle} obstructs ${goals.length} goals (${goals.join(', ')}): set its Anchor`
        : `${countermeasure.obstacle} obstructs no goal: set its Anchor`,
    );
  const goal = work.element(goals[0]!);
  if (!goal) throw new Refused(`${goals[0]} is no longer in the model`);
  return goal;
};

/**
 * A strong mitigation's anchor when it has none: the obstructed goal's
 * parent, in the model as given (TSE'00 §6.3.2: "ensuring some parent goal
 * G' of G whenever the obstacle condition OC becomes true, in spite of G
 * being obstructed"); refused when that goal is a root or a sub-goal of
 * several.
 */
const parentOfObstructed = (
  work: Working,
  origin: Working,
  countermeasure: Countermeasure,
) => {
  const goal = obstructedGoal(origin, origin, countermeasure);
  const parents = origin.parentsOf(goal.id);
  if (parents.length !== 1)
    throw new Refused(
      `a strong mitigation ensures a parent goal of ${goal.id} (TSE'00 §6.3.2), and it has ${
        parents.length ? `${parents.length} (${parents.join(', ')})` : 'none'
      }: set its Anchor`,
    );
  const parent = work.element(parents[0]!);
  if (!parent) throw new Refused(`${parents[0]} is no longer in the model`);
  return parent;
};

const anchorOf = (work: Working, countermeasure: Countermeasure) => {
  if (countermeasure.anchor === null) return null;
  const anchor = work.goalNamed(countermeasure.anchor);
  if (!anchor)
    throw new Refused(`its Anchor ${countermeasure.anchor} names no goal`);
  return anchor;
};

/**
 * One countermeasure applied to the working model: what it did; `warn`
 * says what to know (applied all the same). `origin` is the model as
 * given.
 */
const apply = (
  work: Working,
  origin: Working,
  countermeasure: Countermeasure,
  scope: ResolutionScope,
  warn: (message: string) => void,
): AppliedCountermeasure => {
  const integration = integrationOf(countermeasure);
  if (!integration)
    throw new Refused(
      'it has no ResolutionType and no Form: nothing says what it does',
    );
  const cg = work.element(countermeasure.goal);
  const o = work.element(countermeasure.obstacle);
  if (!isGoal(cg)) throw new Refused(`${countermeasure.goal} is no goal`);
  if (o?.kind !== OBSTACLE)
    throw new Refused(`${countermeasure.obstacle} is no obstacle`);
  const done = (
    at: readonly string[],
    added: readonly string[],
    summary: string,
  ): AppliedCountermeasure => ({
    countermeasure,
    integration,
    at,
    added,
    summary,
  });
  const cgName = cg.name.trim();
  const oName = o.name.trim();

  switch (integration) {
    case 'record':
      return done([], [], `${oName} tolerated: nothing changes`);

    case 'eliminate':
      eliminate(work, o.id);
      return done([], [], `${oName} cannot occur (the domain changed)`);

    case 'substitute': {
      const anchor =
        anchorOf(work, countermeasure) ??
        (() => {
          const goal = obstructedGoal(work, origin, countermeasure);
          const parents = work.parentsOf(goal.id);
          if (parents.length !== 1)
            throw new Refused(
              `${goal.id} is a sub-goal of ${parents.length} goals: set its Anchor`,
            );
          return work.element(parents[0]!)!;
        })();
      const hubs = work.hubsOf(anchor.id);
      if (work.isAbove(cg.id, anchor.id))
        throw new Refused(`${cg.id} is ${anchor.id} or above it`);
      // the anchor is the obstructed goal itself, a leaf: CG, its weakened
      // or substituted version, takes its place (the thesis: "AG' replaces
      // AG"; KAOSTools refuses it, ANCHOR_NO_REFINEMENT)
      if (!hubs.length && work.affects(anchor.id, o.id)) {
        const parents = replaceIn(work, anchor, cg);
        return done(
          parents,
          [],
          `${cgName} replaces ${anchor.name.trim()} under ${parents.join(', ')}`,
        );
      }
      // KAOSTools' rule (SINGLE_REFINEMENT_ONLY, ANCHOR_NO_REFINEMENT)
      if (hubs.length !== 1)
        throw new Refused(
          `its anchor ${anchor.id} has ${hubs.length} refinements: it substitutes in one`,
        );
      const hub = hubs[0]!;
      const legs = work.legsOf(hub.id);
      const obstructed = legs.filter((leg) => work.affects(leg.source, o.id));
      // CG already substituted there, for another obstacle it resolves
      // (the flood model's Email, for Voice Network Overloaded and GSM
      // Network Down): nothing left to do
      if (!obstructed.length && legs.some((leg) => leg.source === cg.id))
        return done(
          [anchor.id],
          [],
          `${cgName} is already in ${anchor.name.trim()}'s refinement: ${oName} obstructs none of its sub-goals`,
        );
      if (!obstructed.length)
        throw new Refused(
          `${oName} obstructs no sub-goal of ${anchor.name.trim()}`,
        );
      for (const leg of obstructed) work.removeLink(leg.id);
      if (!legs.some((leg) => leg.source === cg.id))
        work.addLink({
          id: work.freshId(`${hub.id}-${cg.id}`),
          kind: GOAL_LEG,
          source: cg.id,
          target: hub.id,
        });
      return done(
        [anchor.id],
        [],
        `${cgName} substitutes ${obstructed
          .map((leg) => work.element(leg.source)?.name.trim() ?? leg.source)
          .join(', ')} in ${anchor.name.trim()}'s refinement`,
      );
    }

    case 'replace': {
      if (countermeasure.replaces === null)
        throw new Refused('replaces needs the goal it Replaces');
      const replaced = work.goalNamed(countermeasure.replaces);
      if (!replaced)
        throw new Refused(
          `its Replaces ${countermeasure.replaces} names no goal`,
        );
      if (replaced.id === cg.id) throw new Refused(`${cg.id} replaces itself`);
      const parents = replaceIn(work, replaced, cg);
      return done(
        parents,
        [],
        `${cgName} replaces ${replaced.name.trim()} under ${parents.join(', ')}`,
      );
    }

    case 'deidealize': {
      if (countermeasure.condition === null)
        throw new Refused(`${countermeasure.form} needs its Condition`);
      if (!work.affects(cg.id, o.id))
        throw new Refused(`${oName} doesn't obstruct ${cgName}`);
      const added = restrictInto(work, cg.id, cg.id, o.id);
      return done(
        [cg.id],
        added,
        `${cgName} deidealized (${countermeasure.form} ${countermeasure.condition}): ${oName} no longer obstructs it`,
      );
    }

    case 'anchor': {
      const anchor =
        anchorOf(work, countermeasure) ??
        (countermeasure.strategy === 'strong mitigation' && !countermeasure.form
          ? parentOfObstructed(work, origin, countermeasure)
          : obstructedGoal(work, origin, countermeasure));
      if (work.isAbove(cg.id, anchor.id))
        throw new Refused(`${cg.id} is ${anchor.id} or above it`);
      if (!origin.elements.has(anchor.id) || !origin.affects(anchor.id, o.id))
        warn(
          `${oName} obstructs nothing below ${anchor.name.trim()}: ${cgName} is added to it, nothing is resolved`,
        );
      const kept = newGoal(
        work.freshId(`${anchor.id}-unless-${o.id}`),
        unless(anchor.name, o),
        anchor,
        {
          Description: `${anchor.name.trim()}, while ${oName} does not occur: the obstructed goal conjoined with the obstacle's negation (SEAMS'17 §VI.A), beside ${cgName}`,
        },
      );
      // a leaf's estimate is its content's: K has it
      const esr = anchor.customProperties?.ESR;
      work.addElement(
        esr === undefined
          ? kept
          : {
              ...kept,
              customProperties: { ...kept.customProperties, ESR: esr },
            },
      );
      const added = restrictInto(
        work,
        anchor.id,
        kept.id,
        scope === 'anchor' ? o.id : null,
      );
      if (scope === 'model') eliminate(work, o.id);
      const hub = refine(work, work.element(anchor.id)!, [kept.id, cg.id]);
      return done(
        [anchor.id],
        [kept.id, hub, ...added],
        `${anchor.name.trim()} refined into ${kept.name} and ${cgName}${
          scope === 'model' ? `; ${oName} cannot occur` : ''
        }`,
      );
    }
  }
};

/**
 * The model with the countermeasures `selection` names (resolution link
 * ids) applied, in the model's order: the variant kaosprop propagates
 * (`propagateProbabilities(kaosresView(variant.model))`). A countermeasure
 * that can't be applied is left out, with an error saying why.
 */
export const applyCountermeasures = (
  model: KaosModel,
  selection: Iterable<string>,
  { scope = 'anchor' }: ApplyOptions = {},
): CountermeasureVariant => {
  const chosen = new Set(selection);
  const all = countermeasuresOf(model);
  const problems: CountermeasureProblem[] = [];
  for (const id of chosen)
    if (!all.some((c) => c.id === id))
      problems.push({
        countermeasure: id,
        severity: 'error',
        message: `${id} is no resolution of the model`,
      });
  const work = new Working(model);
  const origin = new Working(model);
  const applied: AppliedCountermeasure[] = [];
  for (const countermeasure of all.filter((c) => chosen.has(c.id))) {
    const snapshot = {
      elements: new Map(work.elements),
      links: new Map(work.links),
    };
    const warnings: string[] = [];
    try {
      applied.push(
        apply(work, origin, countermeasure, scope, (m) => warnings.push(m)),
      );
      for (const message of warnings)
        problems.push({
          countermeasure: countermeasure.id,
          severity: 'warning',
          message: `${countermeasure.goal} resolving ${countermeasure.obstacle}: ${message}`,
        });
    } catch (error) {
      if (!(error instanceof Refused)) throw error;
      // what it changed before it was refused goes back
      work.elements.clear();
      for (const [id, e] of snapshot.elements) work.elements.set(id, e);
      work.links.clear();
      for (const [id, l] of snapshot.links) work.links.set(id, l);
      problems.push({
        countermeasure: countermeasure.id,
        severity: 'error',
        message: `${countermeasure.goal} resolving ${countermeasure.obstacle} isn't applied: ${error.message}`,
      });
    }
  }
  return {
    model: work.model(model),
    applied,
    problems,
    cost: applied.reduce((sum, a) => sum + (a.countermeasure.cost ?? 0), 0),
  };
};

/**
 * A KAOS model as kaosres's analyses read it: every element and link, its
 * properties as written (kaosres's link keys too, which kaosprop's mapper
 * doesn't keep); what kaosprop propagates.
 */
export const kaosresView = <EK extends string, LK extends string>(
  model: IstarModel<EK, LK>,
): AnalysisModel => ({
  actors: [],
  elements: [...model.elements.values()].map((element) => ({
    id: element.id,
    kind: element.kind,
    name: element.name,
    properties: element.customProperties ?? {},
  })),
  links: [...model.links.values()].map((link) => ({
    id: link.id,
    kind: link.kind,
    source: link.source,
    target: link.target,
    ...(link.label !== undefined && { label: link.label }),
    properties: link.customProperties ?? {},
  })),
});

const isElementKind = (kind: string): kind is KaosElementKind =>
  elementKindDefinition(KAOS_OBSTACLES, kind) !== undefined;
const isLinkKind = (kind: string): kind is KaosLinkKind =>
  linkKindDefinition(KAOS_OBSTACLES, kind) !== undefined;

/**
 * A view as a KAOS model (an analysis is given the view, whose kinds are
 * text): its kinds narrowed to KAOS's, an error for any other; no
 * positions.
 */
export const kaosModelOfView = (view: AnalysisModel): KaosModel => {
  const elements = new Map<string, Element>();
  for (const { id, kind, name, properties } of view.elements) {
    if (!isElementKind(kind))
      throw new Error(`${id}: ${kind} is no KAOS element kind`);
    elements.set(id, {
      id,
      kind,
      name,
      x: 0,
      y: 0,
      customProperties: properties,
    });
  }
  const links = new Map<string, Link>();
  for (const { id, kind, source, target, label, properties } of view.links) {
    if (!isLinkKind(kind))
      throw new Error(`${id}: ${kind} is no KAOS link kind`);
    links.set(id, {
      id,
      kind,
      source,
      target,
      ...(label !== undefined && { label }),
      customProperties: properties,
    });
  }
  return withMetamodel({ elements, links }, KAOS_OBSTACLES);
};

/**
 * `applyCountermeasures` on an analysis's view (the selection's
 * enumeration, goal-controller#191 part B): the variant, and its view,
 * which `propagateProbabilities` reads.
 */
export const applyCountermeasuresToView = (
  view: AnalysisModel,
  selection: Iterable<string>,
  options?: ApplyOptions,
): CountermeasureVariant & { view: AnalysisModel } => {
  const variant = applyCountermeasures(
    kaosModelOfView(view),
    selection,
    options,
  );
  return { ...variant, view: kaosresView(variant.model) };
};

/**
 * Whether an obstacle obstructs a goal, or a goal below it (through the
 * obstacle trees it is in): what a countermeasure integrated at that goal
 * ends.
 */
export const obstructs = (
  model: KaosModel,
  goal: string,
  obstacle: string,
): boolean => new Working(model).affects(goal, obstacle);
