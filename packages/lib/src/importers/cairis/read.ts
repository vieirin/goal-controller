/**
 * A CAIRIS model (./document.ts) as KAOS models, one per environment (D2 of
 * goal-controller#192): `<model>-<environment>`, the environment recorded on
 * the diagram. In an environment's model:
 *
 * - each goal situated in it (a `goal_environment`) is a `kaos.BehavioralGoal`
 *   with that environment's definition (`Description`), category (`Type`, the
 *   goal's pattern), priority (`Priority`), fit criterion, issue and
 *   concerns, and its originator (`Source`);
 * - each obstacle situated in it is a `kaos.Obstacle` with that environment's
 *   definition, category (`Category`) and probability (`Probability`,
 *   kaosprop's key) with its rationale (`Rationale`);
 * - each requirement is a `kaos.BehavioralGoal` leaf (D3), assigned to the
 *   role a `manual_association` names, its `type` and `priority` its
 *   `RequirementType` and `RequirementPriority` (text);
 * - each domain property a `kaos.DomainProperty` (`Kind` its type), each role
 *   a `kaos.Agent` (its type `RoleType`);
 * - each association of the environment its link: `and` one refinement of
 *   the goal (or obstacle) by all its `and` children, `or` one refinement per
 *   child (alternatives), `obstruct` an obstruction, `resolve` a resolution,
 *   `responsible` a responsibility assignment, `conflict` a conflict.
 *
 * Values are written as CAIRIS writes them (D1): the model records the
 * `cairis` vocabulary profile (dialects/kaos/profiles.ts), so they are
 * checked against goals.dtd's enumerations, not the `kaos` dialect's.
 *
 * A requirement, a domain property or a role is the project's, not an
 * environment's: it is in each environment whose associations name it (a
 * requirement also where its asset or environment is situated), and in every
 * environment when none does. Nothing is dropped silently: an association
 * with no KAOS link (a goal refined by a task or a use case, an obstacle by
 * a vulnerability, a role dependency, a manual association to a response) is
 * kept as written in the diagram's `cairisUnsupported` and said; what else
 * the file has (assets, threats, personas, use cases, countermeasures, …) is
 * counted and said. No writer (D4): the round trip is the model's JSON.
 */
import { parsePistar, toPistarObject } from '@istar-ts/core';
import type {
  PistarElementJson,
  PistarFile,
  PistarHubLinkJson,
  PistarLinkJson,
} from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import type { ImportDiagnostic, ImportResult } from '../types';
import { layOut, type LayoutNode } from '../layout';
import { identifierOf } from '../kaos';
import { KAOS_TYPES } from '../kaos/vocabulary';
import { VOCABULARY_KEY } from '../../dialects/kaos/profiles';
import {
  readCairisDocument,
  type CairisAssociation,
  type CairisDocument,
  type CairisEnd,
} from './document';

/** The engine a CAIRIS model is for: its obstacles' probabilities are kaosprop's. */
export const CAIRIS_ENGINE = 'kaosprop';

/** What a CAIRIS model's diagram records (its `customProperties`). */
export type CairisDiagramProperties = {
  Description: string;
  /** the vocabulary profile its values are checked against */
  [VOCABULARY_KEY]: 'cairis';
  /** the CAIRIS project's name (`project_settings`) */
  cairisProject: string;
  /** the environment the model is */
  cairisEnvironment: string;
  /** what has no KAOS link, as written, one item per paragraph */
  cairisUnsupported?: string;
};

/** The diagram's key that keeps what has no KAOS link, as written. */
export const CAIRIS_UNSUPPORTED_KEY = 'cairisUnsupported';

/** The diagram's key that names the model's environment. */
export const CAIRIS_ENVIRONMENT_KEY = 'cairisEnvironment';

/** The environment a model is of, as its diagram records it; null when it is no CAIRIS model. */
export const cairisEnvironmentOf = (model: {
  readonly diagram?: {
    readonly customProperties?: Readonly<Record<string, string>>;
  };
}): string | null =>
  model.diagram?.customProperties?.[CAIRIS_ENVIRONMENT_KEY] ?? null;

/** An environment's model of a CAIRIS file. */
export type CairisEnvironmentModel = {
  environment: string;
  /** `<model>-<environment>` (D2) */
  name: string;
  result: ImportResult;
};

export type CairisReadOptions = {
  /** the file's name without its extension: the models are `<modelName>-<environment>` */
  modelName?: string;
};

/** The kinds a CAIRIS element is, by its dimension. */
type Dimension =
  | 'goal'
  | 'requirement'
  | 'obstacle'
  | 'domainproperty'
  | 'role';
const DIMENSIONS: readonly Dimension[] = [
  'goal',
  'requirement',
  'obstacle',
  'domainproperty',
  'role',
];
const isDimension = (dim: string): dim is Dimension =>
  (DIMENSIONS as readonly string[]).includes(dim);
const KIND: Readonly<
  Record<Dimension, (typeof KAOS_TYPES)[keyof typeof KAOS_TYPES]>
> = {
  goal: KAOS_TYPES.goal,
  requirement: KAOS_TYPES.goal,
  obstacle: KAOS_TYPES.obstacle,
  domainproperty: KAOS_TYPES.domainProperty,
  role: KAOS_TYPES.agent,
};
/** A goal-like end: a goal or a requirement (D3), both `kaos.BehavioralGoal`. */
const isGoalLike = (dim: string) => dim === 'goal' || dim === 'requirement';

/** An element of the file, its id unique over the file (the same in every environment's model). */
type Element = { dim: Dimension; name: string; id: string };

/** A link an association is, or why it is none. */
type Placed =
  | {
      kind: 'refinement';
      relation: 'and' | 'or';
      parent: Element;
      child: Element;
      association: CairisAssociation;
    }
  | {
      kind: 'obstruction';
      obstacle: Element;
      target: Element;
      association: CairisAssociation;
    }
  | {
      kind: 'resolution';
      goal: Element;
      obstacle: Element;
      association: CairisAssociation;
    }
  | { kind: 'assignment'; agent: Element; goal: Element; rationale: string }
  | { kind: 'conflict'; a: Element; b: Element; association: CairisAssociation }
  | { kind: 'none'; why: string };

/** The ids of the file's elements, by dimension and name: each name's identifier, unique over the file. */
const idsOf = (document: CairisDocument) => {
  const taken = new Set<string>();
  const ids = new Map<string, string>();
  const key = (dim: Dimension, name: string) => `${dim}\u0000${name}`;
  const add = (dim: Dimension, name: string) => {
    if (ids.has(key(dim, name))) return;
    const base = identifierOf(name, dim);
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
    taken.add(id);
    ids.set(key(dim, name), id);
  };
  for (const g of document.goals) add('goal', g.name);
  for (const r of document.requirements) add('requirement', r.name);
  for (const d of document.domainProperties) add('domainproperty', d.name);
  for (const o of document.obstacles) add('obstacle', o.name);
  for (const e of document.exceptions) add('obstacle', e.name);
  for (const r of document.roles) add('role', r.name);
  return (dim: Dimension, name: string) => ids.get(key(dim, name));
};

/**
 * Where the project's elements are (requirements, domain properties, roles):
 * by name, the environments that situate each; an element no environment
 * situates is in every one.
 */
const situated = (document: CairisDocument) => {
  const where = new Map<string, Set<string>>();
  const key = (dim: Dimension, name: string) => `${dim}\u0000${name}`;
  const at = (dim: Dimension, name: string, environment: string) => {
    const set = where.get(key(dim, name)) ?? new Set<string>();
    set.add(environment);
    where.set(key(dim, name), set);
  };
  for (const a of document.associations)
    for (const end of [a.goal, a.subgoal])
      if (
        end.dim === 'requirement' ||
        end.dim === 'domainproperty' ||
        end.dim === 'role'
      )
        at(end.dim, end.name, a.environment);
  const assets = new Map(document.assets.map((a) => [a.name, a.environments]));
  for (const r of document.requirements) {
    if (r.referenceType === 'environment')
      at('requirement', r.name, r.reference);
    if (r.referenceType === 'asset')
      for (const environment of assets.get(r.reference) ?? [])
        at('requirement', r.name, environment);
  }
  // a role a requirement is assigned to: where the requirement is
  for (const m of document.manualAssociations)
    if (m.from.dim === 'requirement' && m.to.dim === 'role')
      for (const environment of where.get(key('requirement', m.from.name)) ??
        [])
        at('role', m.to.name, environment);
  return {
    isIn: (dim: Dimension, name: string, environment: string): boolean => {
      const set = where.get(key(dim, name));
      return !set || set.has(environment);
    },
    nowhere: (dim: Dimension, name: string): boolean =>
      !where.has(key(dim, name)),
  };
};

/** The project's elements no environment situates: in every environment's model, said once. */
const everywhere = (
  document: CairisDocument,
  nowhere: (dim: Dimension, name: string) => boolean,
) => {
  if (document.environments.length < 2) return [];
  return [
    ...document.requirements
      .filter((r) => nowhere('requirement', r.name))
      .map((r) => `requirement "${r.name}"`),
    ...document.domainProperties
      .filter((d) => nowhere('domainproperty', d.name))
      .map((d) => `domain property "${d.name}"`),
    ...document.roles
      .filter((r) => nowhere('role', r.name))
      .map((r) => `role "${r.name}"`),
  ];
};

/** An element's or a link's custom properties, those set: piStar's open string map (each kind's keys are listed where it is made). */
const props = (
  entries: readonly (readonly [string, string | null | undefined])[],
): Record<string, string> =>
  Object.fromEntries(
    entries.flatMap(([key, value]) =>
      value === null || value === undefined ? [] : [[key, value]],
    ),
  );
const joined = (list: readonly string[]) =>
  list.length ? list.join(', ') : null;
const nonEmpty = (text: string) => (text ? text : null);

/** DSM3's node and a hub's size, as the `.kaos` reader places a hub. */
const NODE = { width: 135, height: 36 } as const;
const HUB = 20;

/** One environment's model. */
const environmentModel = (
  document: CairisDocument,
  environment: string,
  name: string,
  idOf: (dim: Dimension, name: string) => string | undefined,
  isIn: (dim: Dimension, name: string, environment: string) => boolean,
): ImportResult => {
  const diagnostics: ImportDiagnostic[] = [];
  const kept: string[] = [];
  const nodes: PistarElementJson[] = [];
  const present = new Map<string, Element>();
  const node = (
    dim: Dimension,
    elementName: string,
    properties: Record<string, string>,
  ) => {
    const id = idOf(dim, elementName)!;
    const element: Element = { dim, name: elementName, id };
    present.set(`${dim}\u0000${elementName}`, element);
    nodes.push({
      id,
      text: elementName,
      type: KIND[dim],
      x: 0,
      y: 0,
      customProperties: properties,
    });
  };

  for (const goal of document.goals) {
    const here = goal.environments.find((e) => e.environment === environment);
    if (!here) continue;
    node(
      'goal',
      goal.name,
      props([
        ['Type', here.category],
        ['Category', ''],
        ['Source', goal.originator],
        ['Priority', here.priority],
        ['Issue', here.issue],
        ['FormalSpec', ''],
        ['FitCriterion', here.fitCriterion],
        ['Stability', ''],
        ['Description', here.definition],
        ['Concern', joined(here.concerns)],
        ['Tags', joined(goal.tags)],
      ]),
    );
  }
  for (const r of document.requirements) {
    if (!isIn('requirement', r.name, environment)) continue;
    node(
      'requirement',
      r.name,
      props([
        ['Type', ''],
        ['Category', ''],
        ['Source', r.originator],
        ['Priority', ''],
        ['Issue', ''],
        ['FormalSpec', ''],
        ['FitCriterion', r.fitCriterion],
        ['Stability', ''],
        ['Description', r.description],
        ['RequirementType', r.type],
        ['RequirementPriority', r.priority],
        ['Label', r.label],
        ['Reference', r.reference],
        ['ReferenceType', r.referenceType],
        ['Rationale', r.rationale],
      ]),
    );
  }
  for (const d of document.domainProperties) {
    if (!isIn('domainproperty', d.name, environment)) continue;
    node(
      'domainproperty',
      d.name,
      props([
        ['Kind', d.type],
        ['Description', d.definition],
        ['Source', d.originator],
        ['Tags', joined(d.tags)],
      ]),
    );
  }
  for (const obstacle of document.obstacles) {
    const here = obstacle.environments.find(
      (e) => e.environment === environment,
    );
    if (!here) continue;
    node(
      'obstacle',
      obstacle.name,
      props([
        ['Description', here.definition],
        ['FormalSpec', ''],
        ['Category', here.category],
        ['Probability', here.probability?.value],
        ['Rationale', here.probability?.rationale],
        ['Source', obstacle.originator],
        ['Concern', joined(here.concerns)],
        ['Tags', joined(obstacle.tags)],
      ]),
    );
  }
  // a use case step's exception against a goal: the obstacle CAIRIS makes of
  // it when none of its name is (its probability 0.0 and rationale `None`
  // are CAIRIS's defaults, not the file's: not written, kaosprop's default
  // for a leaf is 0)
  const derived = document.exceptions.filter(
    (e) => e.environment === environment,
  );
  for (const e of derived) {
    if (present.has(`obstacle\u0000${e.name}`)) continue;
    node(
      'obstacle',
      e.name,
      props([
        ['Description', e.definition],
        ['FormalSpec', ''],
        ['Category', e.category],
        ['Source', 'CAIRIS'],
      ]),
    );
    diagnostics.push({
      severity: 'info',
      message: `${environment}: use case "${e.usecase}"'s exception "${e.name}" is an obstacle obstructing ${e.dim} "${e.target}", as CAIRIS makes it on import`,
    });
  }
  for (const role of document.roles) {
    if (!isIn('role', role.name, environment)) continue;
    node(
      'role',
      role.name,
      props([
        ['Description', role.description],
        ['RoleType', role.type],
        ['ShortCode', role.shortCode],
      ]),
    );
  }

  /** An end as an element of this model, or why it isn't one. */
  const elementOf = (end: CairisEnd): Element | string => {
    if (!isDimension(end.dim))
      return `a ${end.dim} ("${end.name}") is no KAOS element`;
    const element = present.get(`${end.dim}\u0000${end.name}`);
    if (element) return element;
    return idOf(end.dim, end.name)
      ? `${end.dim} "${end.name}" is not in ${environment}`
      : `the file declares no ${end.dim} "${end.name}"`;
  };
  const place = (a: CairisAssociation): Placed => {
    if (a.refType === null)
      return {
        kind: 'none',
        why: `ref_type ${JSON.stringify(a.refTypeText)} is none of CAIRIS's`,
      };
    const parent = elementOf(a.goal);
    const sub = elementOf(a.subgoal);
    if (typeof parent === 'string') return { kind: 'none', why: parent };
    if (typeof sub === 'string') return { kind: 'none', why: sub };
    const none = (): Placed => ({
      kind: 'none',
      why: `an ${a.refType} association from a ${a.goal.dim} to a ${a.subgoal.dim} is no KAOS link`,
    });
    switch (a.refType) {
      case 'and':
      case 'or':
        if (
          (isGoalLike(parent.dim) &&
            (isGoalLike(sub.dim) || sub.dim === 'domainproperty')) ||
          (parent.dim === 'obstacle' &&
            (sub.dim === 'obstacle' || sub.dim === 'domainproperty'))
        )
          return {
            kind: 'refinement',
            relation: a.refType,
            parent,
            child: sub,
            association: a,
          };
        return none();
      case 'obstruct':
        return sub.dim === 'obstacle' &&
          (isGoalLike(parent.dim) || parent.dim === 'domainproperty')
          ? {
              kind: 'obstruction',
              obstacle: sub,
              target: parent,
              association: a,
            }
          : none();
      case 'resolve':
        return parent.dim === 'obstacle' && isGoalLike(sub.dim)
          ? { kind: 'resolution', goal: sub, obstacle: parent, association: a }
          : none();
      case 'responsible':
        return isGoalLike(parent.dim) && sub.dim === 'role'
          ? {
              kind: 'assignment',
              agent: sub,
              goal: parent,
              rationale: a.rationale,
            }
          : none();
      case 'conflict':
        return isGoalLike(parent.dim) && isGoalLike(sub.dim)
          ? { kind: 'conflict', a: parent, b: sub, association: a }
          : none();
    }
  };

  const linkIds = new Set<string>();
  const linkId = (base: string) => {
    let id = base;
    for (let n = 2; linkIds.has(id); n++) id = `${base}-${n}`;
    linkIds.add(id);
    return id;
  };
  const keep = (source: string, why: string) => {
    kept.push(source);
    diagnostics.push({
      severity: 'warning',
      message: `${environment}: ${why}; kept as written`,
    });
  };

  // refinements: per parent, its `and` children one hub, each `or` child its own
  type Hub = {
    parent: Element;
    obstacle: boolean;
    legs: { child: Element; association: CairisAssociation }[];
  };
  const hubs: Hub[] = [];
  const andHubs = new Map<string, Hub>();
  const links: (PistarLinkJson | PistarHubLinkJson)[] = [];
  const assignments: { agent: Element; goal: Element; rationale: string }[] =
    [];
  const below: { source: string; target: string }[] = [];
  const beside: { source: string; target: string }[] = [];
  const rationale = (text: string) => props([['Rationale', nonEmpty(text)]]);
  const withProperties = (properties: Record<string, string>) =>
    Object.keys(properties).length ? { customProperties: properties } : {};
  const seen = new Set<string>();
  for (const a of document.associations) {
    if (a.environment !== environment) continue;
    const placed = place(a);
    const twice = `${a.refTypeText}\u0000${a.goal.dim}\u0000${a.goal.name}\u0000${a.subgoal.dim}\u0000${a.subgoal.name}`;
    if (placed.kind !== 'none' && seen.has(twice)) {
      diagnostics.push({
        severity: 'info',
        message: `${environment}: the ${a.refTypeText} association from ${a.goal.dim} "${a.goal.name}" to ${a.subgoal.dim} "${a.subgoal.name}" is written twice; read once`,
      });
      continue;
    }
    seen.add(twice);
    switch (placed.kind) {
      case 'none':
        keep(a.source, placed.why);
        break;
      case 'refinement': {
        const obstacle = placed.parent.dim === 'obstacle';
        const leg = { child: placed.child, association: a };
        const open = andHubs.get(placed.parent.id);
        if (placed.relation === 'and' && open) open.legs.push(leg);
        else {
          const hub: Hub = { parent: placed.parent, obstacle, legs: [leg] };
          hubs.push(hub);
          if (placed.relation === 'and') andHubs.set(placed.parent.id, hub);
        }
        break;
      }
      case 'obstruction':
        links.push({
          id: linkId(`${placed.obstacle.id}-obstructs-${placed.target.id}`),
          type: KAOS_TYPES.obstruction,
          source: placed.obstacle.id,
          target: placed.target.id,
          ...withProperties(rationale(a.rationale)),
        });
        below.push({ source: placed.obstacle.id, target: placed.target.id });
        break;
      case 'resolution':
        links.push({
          id: linkId(`${placed.goal.id}-resolves-${placed.obstacle.id}`),
          type: KAOS_TYPES.resolution,
          source: placed.goal.id,
          target: placed.obstacle.id,
          customProperties: {
            ResolutionType: '',
            Anchor: '',
            ...rationale(a.rationale),
          },
        });
        below.push({ source: placed.goal.id, target: placed.obstacle.id });
        break;
      case 'assignment':
        assignments.push(placed);
        break;
      case 'conflict':
        links.push({
          id: linkId(`${placed.a.id}-conflicts-${placed.b.id}`),
          type: KAOS_TYPES.conflict,
          source: placed.a.id,
          target: placed.b.id,
          ...withProperties(rationale(a.rationale)),
        });
        break;
    }
  }
  // the exceptions' obstructions, as CAIRIS adds them (`Obstructs use case …`)
  for (const e of derived) {
    const obstacle = elementOf({ name: e.name, dim: 'obstacle' });
    const target = elementOf({ name: e.target, dim: e.dim });
    if (typeof obstacle === 'string' || typeof target === 'string') {
      diagnostics.push({
        severity: 'warning',
        message: `${environment}: use case "${e.usecase}"'s exception "${e.name}": ${typeof target === 'string' ? target : obstacle}; not read`,
      });
      continue;
    }
    links.push({
      id: linkId(`${obstacle.id}-obstructs-${target.id}`),
      type: KAOS_TYPES.obstruction,
      source: obstacle.id,
      target: target.id,
      customProperties: { Rationale: `Obstructs use case ${e.usecase}` },
    });
    below.push({ source: obstacle.id, target: target.id });
  }
  // a requirement's role (`manual_association`, no environment): wherever both are
  for (const m of document.manualAssociations) {
    if (m.from.dim === 'requirement' && m.to.dim === 'role') {
      const goal = elementOf(m.from);
      const agent = elementOf(m.to);
      if (typeof goal !== 'string' && typeof agent !== 'string')
        assignments.push({ agent, goal, rationale: '' });
      continue;
    }
    keep(
      m.source,
      `a manual association from a ${m.from.dim} to a ${m.to.dim} is no KAOS link`,
    );
  }
  for (const d of document.dependencies)
    if (d.environment === environment)
      keep(d.source, 'a dependency between roles is no KAOS link');

  const counts = new Map<string, number>();
  const hubLinks: {
    hub: PistarHubLinkJson['hub'];
    parent: string;
    children: string[];
  }[] = [];
  for (const hub of hubs) {
    const n = (counts.get(hub.parent.id) ?? 0) + 1;
    counts.set(hub.parent.id, n);
    const hubId = linkId(`${hub.parent.id}-refinement-${n}`);
    const hubJson: PistarHubLinkJson['hub'] = {
      id: hubId,
      type: hub.obstacle
        ? KAOS_TYPES.obstacleRefinementHub
        : KAOS_TYPES.refinementHub,
      x: 0,
      y: 0,
      ...(!hub.obstacle && {
        customProperties: { SysRef: '', Status: '', Tactic: '' },
      }),
    };
    hubLinks.push({
      hub: hubJson,
      parent: hub.parent.id,
      children: hub.legs.map((l) => l.child.id),
    });
    links.push({
      hub: hubJson,
      starts: hub.legs.map(({ child, association }, i) => ({
        id: linkId(`${hubId}-${i + 1}`),
        type: hub.obstacle
          ? KAOS_TYPES.obstacleRefinementLeg
          : KAOS_TYPES.refinementLeg,
        source: child.id,
        target: hubId,
        ...withProperties(
          props([
            ['Rationale', nonEmpty(association.rationale)],
            ['Alternative', association.alternative ? 'Yes' : null],
          ]),
        ),
      })),
      end: {
        id: linkId(`${hubId}-end`),
        type: hub.obstacle
          ? KAOS_TYPES.obstacleRefinementEnd
          : KAOS_TYPES.refinementEnd,
        source: hubId,
        target: hub.parent.id,
      },
    });
    for (const child of hub.legs)
      below.push({ source: child.child.id, target: hub.parent.id });
  }
  const assigned = new Set<string>();
  for (const { agent, goal, rationale: why } of assignments) {
    if (assigned.has(`${agent.id}\u0000${goal.id}`)) continue;
    assigned.add(`${agent.id}\u0000${goal.id}`);
    links.push({
      id: linkId(`${agent.id}-assigned-${goal.id}`),
      type: KAOS_TYPES.assignment,
      source: agent.id,
      target: goal.id,
      ...withProperties(rationale(why)),
    });
    beside.push({ source: agent.id, target: goal.id });
  }

  // positions (#118): a refinement's children below it, an obstacle below
  // what it obstructs, a resolving goal below its obstacle, an agent beside
  // its goal; a hub between its parent and its children
  const BELOW = 'below';
  const placed: LayoutNode[] = nodes.map((n) => ({ id: n.id }));
  const extent = layOut(
    {
      orphans: placed,
      links: [
        ...below.map((l) => ({ type: BELOW, ...l })),
        ...beside.map((l) => ({ type: 'beside', ...l })),
      ],
    },
    undefined,
    new Set([BELOW]),
  );
  const position = new Map(
    placed.map((p) => [p.id, { x: Number(p.x), y: Number(p.y) }]),
  );
  for (const n of nodes) Object.assign(n, position.get(n.id));
  for (const { hub, parent, children } of hubLinks) {
    const top = position.get(parent)!;
    const under = children.map((c) => position.get(c)!);
    const x = under.reduce((sum, p) => sum + p.x, 0) / under.length;
    const y = Math.min(...under.map((p) => p.y));
    hub.x = Math.round((top.x + x) / 2 + NODE.width / 2 - HUB / 2);
    hub.y = Math.round((top.y + NODE.height + y) / 2 - HUB / 2);
  }

  const definition =
    document.environments.find((e) => e.name === environment)?.definition ?? '';
  const diagram: CairisDiagramProperties = {
    Description: definition,
    [VOCABULARY_KEY]: 'cairis',
    cairisProject: document.project,
    cairisEnvironment: environment,
  };
  const json: PistarFile = {
    actors: [],
    orphans: nodes,
    dependencies: [],
    links,
    display: {},
    tool: 'dsm3-goals',
    metamodelVersion: '1.0',
    diagram: {
      width: Math.max(extent?.right ?? 0, 400) + NODE.width,
      height: Math.max(extent?.bottom ?? 0, 300) + NODE.height,
      name,
      customProperties: {
        ...diagram,
        ...(kept.length && { [CAIRIS_UNSUPPORTED_KEY]: kept.join('\n\n') }),
      },
    },
  };
  // in istar-ts's form, as the workbench writes a KAOS model
  const model = toPistarObject(
    parsePistar(json, { metamodel: KAOS_OBSTACLES }),
  );
  return {
    model,
    dialectRecord: { engine: CAIRIS_ENGINE, projectResources: {} },
    diagnostics,
  };
};

/** An environment's name as a file name's part: lower case, `-` between words. */
export const environmentSlug = (environment: string) =>
  environment
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * A CAIRIS model file as KAOS models, one per environment (in the file's
 * order); none, with errors, when the text isn't one. `diagnostics`: what
 * is the file's (what it has that isn't read, what is in every environment);
 * each model's are its environment's.
 */
export const readCairis = (
  text: string,
  { modelName = 'cairis' }: CairisReadOptions = {},
): { models: CairisEnvironmentModel[]; diagnostics: ImportDiagnostic[] } => {
  const { document, diagnostics } = readCairisDocument(text);
  if (!document) return { models: [], diagnostics };
  for (const { element, count } of document.unread)
    diagnostics.push({
      severity: 'info',
      message: `${count} <${element}> not read: no part of KAOS's goal and obstacle model`,
    });
  const where = situated(document);
  const common = everywhere(document, where.nowhere);
  if (common.length)
    diagnostics.push({
      severity: 'info',
      message: `situated in no environment, so in every environment's model: ${common.join(', ')}`,
    });
  if (!document.environments.length)
    diagnostics.push({
      severity: 'error',
      message: 'The model has no environment: there is no model to make',
    });
  const idOf = idsOf(document);
  return {
    models: document.environments.map(({ name: environment }) => {
      const name = `${modelName}-${environment}`;
      return {
        environment,
        name,
        result: environmentModel(document, environment, name, idOf, where.isIn),
      };
    }),
    diagnostics,
  };
};

/** One environment's model of a CAIRIS file (the first when none is named): as an importer's result. */
export const importCairis = (
  text: string,
  {
    modelName = 'cairis',
    environment,
  }: CairisReadOptions & { environment?: string } = {},
): ImportResult => {
  const { models, diagnostics } = readCairis(text, { modelName });
  const found =
    environment === undefined
      ? models[0]
      : models.find((m) => m.environment === environment);
  if (!found)
    return {
      model: null,
      dialectRecord: null,
      diagnostics: [
        ...diagnostics,
        ...(models.length
          ? [
              {
                severity: 'error' as const,
                message: `The model has no environment ${environment}: ${models.map((m) => m.environment).join(', ')}`,
              },
            ]
          : []),
      ],
    };
  return {
    ...found.result,
    diagnostics: [...diagnostics, ...found.result.diagnostics],
  };
};
