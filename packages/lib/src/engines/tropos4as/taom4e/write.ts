/**
 * A Tropos4AS (or GODA) model as TAOM4E's `.tropos` (goal-controller#144
 * item 3): the reader's inverse (./read), written with the shared XMI
 * writer as EMF writes a resource of two roots, in an `xmi:XMI`: the
 * `project` (its diagrams: a goal diagram per actor, and an actor diagram
 * for the dependums, at the model's positions) and the Formal Tropos
 * business model (actors, hard goals, softgoals, plans, resources;
 * decompositions, means-ends, contributions, dependencies), each with its
 * piStar id as its `xmi:id`.
 *
 * - A goal's conditions are Formal Tropos's attributes where it has one:
 *   `creation` → `creationProperty`, `achievement` → `fulfillmentProperty`,
 *   `maintain` → `invariantProperty`; a maintain-goal's `mode` is
 *   `MAINTAIN`, an achieve-goal with a condition's `ACHIEVE`. A GODA model
 *   writes `creationProperty` as it is, on goals and plans, as CRGMToPRISM
 *   reads it.
 * - A task OR-refining a goal is a means-end (Tropos's plan for a goal);
 *   any other refinement a decomposition. A GODA model's are all
 *   decompositions, as its files draw them.
 * - **What TAOM4E has no class or attribute for** goes in goal-controller's
 *   extension (`xmi:Extension extender="goal-controller"`, XMI 2.0's place
 *   for a tool's own data, which EMF and TAOM4E skip): Tropos4AS's kinds
 *   (artifacts, failures, errors, symptoms) and links, the conditions
 *   without a Formal Tropos slot (`failure`, `drop`, `target`,
 *   `onFailure`, `precondition`, a perform-goal's type), GODA's `selected`,
 *   the diagram's properties, each list's order and the dependencies'
 *   link ids. So the file reads back to its model (but for `lossy`), and
 *   TAOM4E would read its Tropos part only: no Tropos4AS metamodel survives
 *   to write them as TAOM4E's plug-ins did (#134).
 *
 * Unverified against TAOM4E: no tool can re-read it (#134).
 */
import type {
  NativeDiagnostic,
  NativeWriteResult,
  PistarJson,
} from '@goal-controller/dialect';
import {
  writeXmi,
  type XmiWriteNode,
} from '@goal-controller/goal-language/formats';
import {
  ACTOR_DIAGRAM,
  CLASS_OF_KIND,
  DEPENDUM_OF_KIND,
  EXTENDER,
  EXTENSION,
  FORMAL,
  FORMAL_CORE,
  GOAL_DIAGRAM,
  INFORMAL,
  METRICS,
  OWNER_OF_KIND,
  PROJECT,
  TAOM4E_NAMESPACES,
} from './vocabulary';

type Json = Record<string, any>;

/** a contribution's value → `FContribution.metric` */
const METRIC_OF_LABEL = Object.fromEntries(
  Object.entries(METRICS).map(([metric, label]) => [label, metric]),
);
const REFINEMENTS = new Set([
  'istar.AndRefinementLink',
  'istar.OrRefinementLink',
]);
/** the kinds a decomposition has as its root and its children */
const DECOMPOSED: Readonly<Record<string, { root: string; child: string }>> = {
  'istar.Goal': { root: 'rootGoal', child: 'targetGoal' },
  'istar.Task': { root: 'rootPlan', child: 'targetPlan' },
};

const node = (
  feature: string,
  type: string | null,
  id: string | null,
  attributes: XmiWriteNode['attributes'] = {},
  references: XmiWriteNode['references'] = {},
  children: XmiWriteNode[] = [],
): XmiWriteNode => ({
  feature,
  ...(type && { type }),
  ...(id !== null && { id }),
  attributes,
  references: Object.fromEntries(
    Object.entries(references).filter(([, targets]) => targets.length),
  ),
  children,
});

/** an extension element: plain attributes, no id (the document's ids are TAOM4E's) */
const plain = (
  feature: string,
  attributes: Record<string, string | number | undefined>,
  children: XmiWriteNode[] = [],
): XmiWriteNode => ({ feature, attributes, children });

const propertyNodes = (properties: Record<string, unknown>): XmiWriteNode[] =>
  Object.entries(properties).map(([key, value]) =>
    plain('property', { key, value: String(value) }),
  );

/**
 * A model as a `.tropos`, with what TAOM4E couldn't carry kept in the
 * extension (an info says how much). Never without a text: every model is
 * one file.
 */
export const writeTaom4e = (
  pistar: PistarJson,
): NativeWriteResult & { text: string } => {
  const model = pistar as Json;
  const diagnostics: NativeDiagnostic[] = [];
  const engine =
    model.diagram?.customProperties?.engine === 'goda' ? 'goda' : 'tropos4as';
  const goda = engine === 'goda';
  const actors: Json[] = model.actors ?? [];
  const links: Json[] = model.links ?? [];
  const display: Json = model.display ?? {};

  // what TAOM4E has a class for: its kinds, and a dependum with its two links
  const isNative = (n: Json) => n.type in CLASS_OF_KIND;
  const kindOf = new Map<string, string>();
  for (const actor of actors) kindOf.set(actor.id, 'actor');
  const consumed = new Set<Json>();
  const dependencyLinks = new Map<string, { depender: Json; dependee: Json }>();
  for (const dependum of model.dependencies ?? []) {
    if (!isNative(dependum)) continue;
    const depender = links.find(
      (l) =>
        l.type === 'istar.DependencyLink' &&
        !consumed.has(l) &&
        l.source === dependum.source &&
        l.target === dependum.id,
    );
    const dependee = links.find(
      (l) =>
        l.type === 'istar.DependencyLink' &&
        !consumed.has(l) &&
        l.source === dependum.id &&
        l.target === dependum.target,
    );
    if (
      !depender ||
      !dependee ||
      kindOf.get(dependum.source) !== 'actor' ||
      kindOf.get(dependum.target) !== 'actor'
    )
      continue;
    consumed.add(depender);
    consumed.add(dependee);
    dependencyLinks.set(dependum.id, { depender, dependee });
  }
  const nativeDependums = (model.dependencies ?? []).filter((d: Json) =>
    dependencyLinks.has(d.id),
  );
  const actorOfNode = new Map<string, Json>();
  for (const actor of actors)
    for (const n of actor.nodes ?? [])
      if (isNative(n)) actorOfNode.set(n.id, actor);
  const nativeOrphans = (model.orphans ?? []).filter(isNative);
  for (const n of [
    ...actors.flatMap((a) => (a.nodes ?? []).filter(isNative)),
    ...nativeOrphans,
    ...nativeDependums,
  ])
    kindOf.set(n.id, n.type);

  // the extension: what TAOM4E has no place for
  const extension: XmiWriteNode[] = [];
  const keep = (n: XmiWriteNode) => extension.push(n);
  const keepProperties = (of: string, properties: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(properties))
      keep(plain('property', { of, key, value: String(value) }));
  };

  // an element's attributes, Formal Tropos's; the rest kept
  const attributesOf = (n: Json): Record<string, string> => {
    const properties: Record<string, string> = {
      ...n.customProperties,
    };
    const attributes: Record<string, string> = {};
    const take = (key: string, attribute: string) => {
      if (properties[key] === undefined || properties[key] === '') return;
      attributes[attribute] = properties[key]!;
      delete properties[key];
    };
    if (goda) {
      if (n.type !== 'istar.Quality')
        take('creationProperty', 'creationProperty');
      take('attribute', 'attribute');
    } else if (n.type === 'istar.Goal') {
      const maintain = properties.type === 'maintain';
      if (maintain) delete properties.type;
      const mode = properties.mode;
      if (
        !maintain &&
        mode &&
        !['ACHIEVE', 'MAINTAIN', 'ACHIEVEMAINTAIN'].includes(mode.toUpperCase())
      )
        take('mode', 'mode');
      take('creation', 'creationProperty');
      take('maintain', 'invariantProperty');
      take('achievement', 'fulfillmentProperty');
      take('attribute', 'attribute');
      if (maintain) attributes.mode = 'MAINTAIN';
      else if (
        !attributes.mode &&
        properties.type !== 'perform' &&
        (attributes.creationProperty || attributes.fulfillmentProperty)
      )
        attributes.mode = 'ACHIEVE';
    } else for (const key of FORMAL) take(key, key);
    keepProperties(n.id, properties);
    return attributes;
  };

  // the business model's classes: actors first, then their elements, the
  // orphans', the dependums'
  const classes = new Map<string, XmiWriteNode>();
  const actorNodes = actors.map((actor) => {
    const properties: Record<string, string> = {
      ...actor.customProperties,
    };
    const attributes: Record<string, string> = {};
    for (const key of FORMAL)
      if (properties[key]) {
        attributes[key] = properties[key]!;
        delete properties[key];
      }
    keepProperties(actor.id, properties);
    if (actor.type !== 'istar.Actor')
      keep(plain('actor', { of: actor.id, type: actor.type }));
    const written = node('TroposClasses', FORMAL_CORE('FActor'), actor.id, {
      name: actor.text ?? '',
      ...attributes,
    });
    classes.set(actor.id, written);
    return written;
  });
  const elementNode = (n: Json, owner: Json | undefined) => {
    const written = node(
      'TroposClasses',
      FORMAL_CORE(CLASS_OF_KIND[n.type]!.type),
      n.id,
      { name: n.text ?? '', ...attributesOf(n) },
    );
    classes.set(n.id, written);
    if (owner)
      (written.references as Record<string, XmiWriteNode[]>)[
        OWNER_OF_KIND[n.type]!.element
      ] = [classes.get(owner.id)!];
    return written;
  };
  const elementNodes = [
    ...actors.flatMap((actor) =>
      (actor.nodes ?? [])
        .filter(isNative)
        .map((n: Json) => elementNode(n, actor)),
    ),
    ...nativeOrphans.map((n: Json) => elementNode(n, undefined)),
    ...nativeDependums.map((n: Json) => elementNode(n, undefined)),
  ];
  // an actor lists its elements, as EMF writes both ends
  for (const actor of actors) {
    const owned = (actor.nodes ?? []).filter(isNative);
    const references = classes.get(actor.id)!.references as Record<
      string,
      XmiWriteNode[]
    >;
    for (const n of owned) {
      const feature = OWNER_OF_KIND[n.type]!.actor;
      (references[feature] ??= []).push(classes.get(n.id)!);
    }
  }

  // relations: decompositions by their root, means-ends, contributions, dependencies
  const relations: XmiWriteNode[] = [];
  const ids = new Set<string>([...kindOf.keys(), ...links.map((l) => l.id)]);
  const fresh = (base: string) => {
    let id = base;
    for (let i = 2; ids.has(id); i++) id = `${base}-${i}`;
    ids.add(id);
    return id;
  };
  const meansEnd = (l: Json) =>
    !goda &&
    l.type === 'istar.OrRefinementLink' &&
    kindOf.get(l.source) === 'istar.Task' &&
    kindOf.get(l.target) === 'istar.Goal';
  const refinements = links.filter(
    (l) =>
      REFINEMENTS.has(l.type) &&
      DECOMPOSED[kindOf.get(l.source) ?? ''] &&
      DECOMPOSED[kindOf.get(l.target) ?? ''] &&
      !Object.keys(l.customProperties ?? {}).length,
  );
  const parents = [...new Set(refinements.map((l) => l.target as string))];
  const means: Json[] = [];
  for (const parent of parents) {
    const own = refinements.filter((l) => l.target === parent);
    means.push(...own.filter(meansEnd));
    for (const type of ['istar.AndRefinementLink', 'istar.OrRefinementLink']) {
      const decomposed = own.filter((l) => l.type === type && !meansEnd(l));
      if (!decomposed.length) continue;
      const and = type === 'istar.AndRefinementLink';
      const owner = actorOfNode.get(parent);
      const decomposition = node(
        'TroposRelations',
        INFORMAL('BooleanDecomposition'),
        fresh(`${parent}-${and ? 'and' : 'or'}`),
        { type: and ? 'AND' : 'OR' },
        {
          [DECOMPOSED[kindOf.get(parent)!]!.root]: [classes.get(parent)!],
          ...(owner && { actorDecPointOfView: [classes.get(owner.id)!] }),
        },
      );
      const decLinks = decomposed.map((l) =>
        node(
          'TroposRelations',
          INFORMAL(and ? 'AndDecLink' : 'OrDecLink'),
          l.id,
          {},
          {
            BooleanDecomposition: [decomposition],
            [DECOMPOSED[kindOf.get(l.source)!]!.child]: [
              classes.get(l.source)!,
            ],
          },
        ),
      );
      (
        decomposition.references as Record<string, XmiWriteNode[]>
      ).BooleanDecLink = decLinks;
      // its links name it before it is listed: references resolve by node
      relations.push(decomposition, ...decLinks);
      for (const l of decomposed) consumed.add(l);
    }
  }
  for (const l of means) {
    const owner = actorOfNode.get(l.target);
    relations.push(
      node(
        'TroposRelations',
        INFORMAL('MeansEnd'),
        l.id,
        {},
        {
          meansPlan: [classes.get(l.source)!],
          end: [classes.get(l.target)!],
          ...(owner && { actorMeansEndPointOfView: [classes.get(owner.id)!] }),
        },
      ),
    );
    consumed.add(l);
  }
  for (const l of links)
    if (
      l.type === 'istar.ContributionLink' &&
      kindOf.get(l.target) === 'istar.Quality' &&
      kindOf.has(l.source) &&
      kindOf.get(l.source) !== 'actor' &&
      METRIC_OF_LABEL[l.label] &&
      !Object.keys(l.customProperties ?? {}).length
    ) {
      relations.push(
        node(
          'TroposRelations',
          FORMAL_CORE('FContribution'),
          l.id,
          { metric: METRIC_OF_LABEL[l.label] },
          {
            contributer: [classes.get(l.source)!],
            contributed: [classes.get(l.target)!],
          },
        ),
      );
      consumed.add(l);
    }
  for (const dependum of nativeDependums) {
    const id = fresh(`${dependum.id}-dependency`);
    const { depender, dependee } = dependencyLinks.get(dependum.id)!;
    relations.push(
      node(
        'TroposRelations',
        INFORMAL('Dependency'),
        id,
        {},
        {
          depender: [classes.get(dependum.source)!],
          dependee: [classes.get(dependum.target)!],
          [DEPENDUM_OF_KIND[dependum.type]!]: [classes.get(dependum.id)!],
        },
      ),
    );
    keep(
      plain('dependency', {
        of: id,
        depender: depender.id,
        dependee: dependee.id,
      }),
    );
    for (const l of [depender, dependee])
      if (Object.keys(l.customProperties ?? {}).length)
        keepProperties(l.id, l.customProperties);
  }

  // the rest in the extension: nodes, then links
  const keptNodes = (list: Json[], where: string, actor?: string) => {
    for (const n of list.filter((n) => !kindOf.has(n.id)))
      keep(
        plain(
          'node',
          {
            id: n.id,
            type: n.type,
            text: n.text ?? '',
            where,
            actor,
            x: n.x,
            y: n.y,
            source: n.source,
            target: n.target,
          },
          propertyNodes(n.customProperties ?? {}),
        ),
      );
  };
  for (const actor of actors) keptNodes(actor.nodes ?? [], 'actor', actor.id);
  keptNodes(model.orphans ?? [], 'orphan');
  keptNodes(model.dependencies ?? [], 'dependum');
  const keptLinks = links.filter((l) => !consumed.has(l));
  for (const l of keptLinks)
    keep(
      plain(
        'link',
        {
          id: l.id,
          type: l.type,
          source: l.source,
          target: l.target,
          label: l.label,
        },
        propertyNodes(l.customProperties ?? {}),
      ),
    );
  // each list's order, the diagram's properties
  for (const actor of actors)
    keep(
      plain('order', {
        of: actor.id,
        ids: (actor.nodes ?? []).map((n: Json) => n.id).join(' '),
      }),
    );
  keep(
    plain('order', {
      of: '',
      ids: (model.orphans ?? []).map((n: Json) => n.id).join(' '),
    }),
  );
  const { engine: _engine, ...diagramProperties } =
    model.diagram?.customProperties ?? {};
  keep(plain('diagram', {}, propertyNodes(diagramProperties)));

  // the diagrams: a goal diagram per actor, an actor diagram for what is in none
  const figure = (
    ui: string,
    n: Json,
    container?: XmiWriteNode,
  ): XmiWriteNode =>
    node(
      'DiagramNodes',
      ui,
      fresh(`${n.id}-figure`),
      {
        x: n.x,
        y: n.y,
        width: display[n.id]?.width,
        height: display[n.id]?.height,
      },
      {
        core: [classes.get(n.id)!],
        ...(container && { container: [container] }),
      },
    );
  const diagrams = actors.map((actor) => {
    const box = node(
      'DiagramNodes',
      GOAL_DIAGRAM('GD_ActorUI'),
      fresh(`${actor.id}-figure`),
      { x: actor.x, y: actor.y },
      { core: [classes.get(actor.id)!] },
    );
    const inside = (actor.nodes ?? [])
      .filter(isNative)
      .map((n: Json) =>
        figure(GOAL_DIAGRAM(CLASS_OF_KIND[n.type]!.goalUI), n, box),
      );
    if (inside.length)
      (box.references as Record<string, XmiWriteNode[]>).children = inside;
    return node(
      'Diagram',
      GOAL_DIAGRAM('GoalDiagram'),
      fresh(`${actor.id}-diagram`),
      { name: actor.text ?? '', phase: 'LR' },
      { Actor: [classes.get(actor.id)!] },
      [box, ...inside],
    );
  });
  if (nativeDependums.length || nativeOrphans.length)
    diagrams.push(
      node(
        'Diagram',
        ACTOR_DIAGRAM('ActorDiagram'),
        fresh('actor-diagram'),
        { name: 'Actor diagram', phase: 'ER' },
        {},
        [
          ...actors.map((actor) =>
            node(
              'DiagramNodes',
              ACTOR_DIAGRAM('AD_ActorUI'),
              fresh(`${actor.id}-actor-figure`),
              { x: actor.x, y: actor.y },
              { core: [classes.get(actor.id)!] },
            ),
          ),
          ...[...nativeDependums, ...nativeOrphans].map((n: Json) =>
            figure(ACTOR_DIAGRAM(CLASS_OF_KIND[n.type]!.actorUI), n),
          ),
        ],
      ),
    );

  const name = model.diagram?.name ?? '';
  const business = node(
    FORMAL_CORE('FormalBusinessModel'),
    null,
    fresh('business-model'),
    { name },
    {},
    [...actorNodes, ...elementNodes, ...relations],
  );
  const project = node(
    PROJECT('Project'),
    null,
    null,
    { name },
    { BusinessModel: [business] },
    diagrams,
  );
  const root: XmiWriteNode = {
    feature: 'xmi:XMI',
    children: [
      project,
      business,
      plain(EXTENSION, { extender: EXTENDER, engine }, extension),
    ],
  };
  const { text, diagnostics: xmi } = writeXmi(root, {
    namespaces: TAOM4E_NAMESPACES,
    order: ['name'],
  });
  diagnostics.push(...xmi);
  const keptCount =
    extension.filter((n) => n.feature === 'node').length + keptLinks.length;
  if (keptCount)
    diagnostics.push({
      severity: 'info',
      message: `TAOM4E has no class for ${keptCount} node(s) and link(s) (Tropos4AS's own, or not iStar's as Tropos has them): kept in goal-controller's extension, which TAOM4E skips`,
    });
  return { text, diagnostics };
};
