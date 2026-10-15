/**
 * TAOM4E's `.tropos` (EMF XMI of its base Tropos metamodel,
 * `reference/TAOM4E-MM.ecore`) into goal-controller (goal-controller#136
 * item 4), read with the shared XMI reader (#137): the native file's
 * `read` (#143, #144 item 3), a piStar model, its dialect record and
 * diagnostics.
 *
 * Unverified against TAOM4E: no `.tropos` file survives (#134), so the
 * fixtures are written by hand against the ecore. The mapping is #134's
 * (item 4's D):
 *
 * - actors, hard goals, softgoals, plans and resources → iStar's actor,
 *   goal, quality, task and resource; an element is its actor's by its
 *   `wanter`, `capableOf` or `use` (or the actor's `wanted`, `plans`,
 *   `resources`); a dependum is in no actor;
 * - an AND/OR `BooleanDecomposition` → AND/OR refinements, child to root;
 *   a means-end → an OR-refinement of its end (iStar 2.0 has no means-end
 *   link, as the seeds write it); a contribution → iStar's, `metric` `++`,
 *   `+`, `-`, `--` → make, help, hurt, break; a dependency → its dependum,
 *   linked from the depender and to the dependee. A link's id is its
 *   relation's (`xmi:id`), else `<source>-<Kind>-<target>`;
 * - positions from the `diagram` package: a diagram node's `x`, `y` (as
 *   written, not relative to its container), its `width` and `height`; what
 *   no diagram places is laid out (`importers/layout.ts`);
 * - Formal Tropos's attributes on a hard goal: `creationProperty` →
 *   `creation`, `fulfillmentProperty` → `achievement`, `invariantProperty`
 *   → `maintain`; `mode` `MAINTAIN` → `type: maintain`, `ACHIEVEMAINTAIN`
 *   → maintain (a warning: its achieve phase is lost), `AVOID` kept as
 *   `mode` (a warning); `attribute`, and the other elements' and the
 *   actors' formal attributes, kept as written. A condition the goal
 *   language can't read (Formal Tropos writes LTL) is kept as written: the
 *   checks report it.
 * - **GODA-shaped**: when every hard goal's name is CRGMToPRISM's `G1: …`
 *   and every plan's `T1.1: …`, and no Tropos4AS attribute is set (a
 *   fulfillment or invariant property, a mode but ACHIEVE), the model is
 *   GODA's: `creationProperty` stays `creationProperty` on goals and plans
 *   (CRGMToPRISM reads GODA's context there), and the one root goal is
 *   `selected` (CRGMToPRISM generates from the root goals).
 * - **goal-controller's extension** (`xmi:Extension extender="goal-controller"`,
 *   which ./write writes): what TAOM4E has no class for, read back as
 *   written (./write says what). A file with it names its engine there, so
 *   it is neither guessed nor its root goal selected.
 */
import type {
  DialectRecord,
  ImportDiagnostic,
  ImportResult,
} from '../../../importers/types';
import { layOut } from '../../../importers/layout';
import {
  readXmi,
  type XmiNode,
  type XmiReader,
} from '@goal-controller/goal-language/formats';
import { tropos4asMetamodelBlock } from '../extension';
import {
  ACTORS,
  CONDITIONS,
  EXTENDER,
  EXTENSION,
  FORMAL,
  GODA_LABEL,
  METRICS,
  NODE_KINDS,
  RELATIONS,
} from './vocabulary';

type Json = Record<string, unknown>;

const localType = (node: XmiNode) => node.type?.split(':').pop() ?? '';

export type Taom4eContext = {
  /** the model's name when the file names none (its file's, without `.tropos`) */
  modelName?: string;
  /** the file's name, so an `href` into it resolves */
  fileName?: string;
};

/** A `.tropos` text as a Tropos4AS (or GODA) model; null with error diagnostics when it isn't one. */
export const readTaom4e = (
  text: string,
  { modelName = 'TAOM4E model', fileName }: Taom4eContext = {},
): ImportResult => {
  const { reader, diagnostics: xmi } = readXmi(text, { fileName });
  // the reader's (its references' too, as they are resolved), then ours
  // (a reference read twice is reported once)
  const read = (): ImportDiagnostic[] => [
    ...new Map(
      (reader?.diagnostics ?? xmi).map(({ severity, message }) => [
        message,
        { severity, message },
      ]),
    ).values(),
  ];
  const diagnostics: ImportDiagnostic[] = [];
  const fail = (message: string): ImportResult => ({
    model: null,
    dialectRecord: null,
    diagnostics: [...read(), { severity: 'error', message }],
  });
  if (!reader) return fail('Not XML');
  const nodes = reader.document.nodes;
  const actors = nodes.filter((n) => ACTORS.has(localType(n)));
  const elements = nodes.filter((n) => NODE_KINDS[localType(n)]);
  const extension =
    nodes.find(
      (n) => n.feature === EXTENSION && n.attributes.extender === EXTENDER,
    ) ?? null;
  if (!actors.length && !elements.length && !extension)
    return fail('No Tropos actor or element: not a TAOM4E model');
  for (const node of nodes)
    if (
      (node.feature === 'TroposClasses' ||
        node.feature === 'TroposRelations') &&
      !ACTORS.has(localType(node)) &&
      !NODE_KINDS[localType(node)] &&
      !RELATIONS.has(localType(node))
    )
      diagnostics.push({
        severity: 'info',
        message: `${node.type ?? node.feature} ${node.attributes.name ?? node.id ?? node.path}: not in the base metamodel's mapping; left out`,
      });
  const { model, dialectRecord } = toPistar(
    reader,
    actors,
    elements,
    extension,
    modelName,
    diagnostics,
  );
  return { model, dialectRecord, diagnostics: [...read(), ...diagnostics] };
};

/** An extension element's `<property key value/>` children, as properties. */
const propertiesIn = (node: XmiNode): Record<string, string> =>
  Object.fromEntries(
    node.children
      .filter((child) => child.feature === 'property')
      .map((child) => [
        child.attributes.key ?? '',
        child.attributes.value ?? '',
      ]),
  );

const numberOr = (value: string | undefined) => {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n)
    ? n
    : undefined;
};

const toPistar = (
  reader: XmiReader,
  actors: readonly XmiNode[],
  elements: readonly XmiNode[],
  extension: XmiNode | null,
  modelName: string,
  diagnostics: ImportDiagnostic[],
): { model: Json; dialectRecord: DialectRecord } => {
  const idOf = (node: XmiNode) => node.id ?? node.path;
  const nameOf = (node: XmiNode) => node.attributes.name ?? '';
  const kindOf = (node: XmiNode) => NODE_KINDS[localType(node)]!;
  const one = (node: XmiNode, feature: string) =>
    reader.references(node, feature)[0];
  const relations = (...types: string[]) =>
    reader.document.nodes.filter((n) => types.includes(localType(n)));
  const extended = (feature: string) =>
    extension?.children.filter((child) => child.feature === feature) ?? [];

  // GODA-shaped: CRGMToPRISM's labels, no Tropos4AS attribute; a file
  // goal-controller wrote names its engine
  const labelled = elements.filter((n) => GODA_LABEL[kindOf(n)]);
  const goda = extension
    ? extension.attributes.engine === 'goda'
    : labelled.length > 0 &&
      labelled.every((n) => GODA_LABEL[kindOf(n)]!.test(nameOf(n))) &&
      elements.every(
        (n) =>
          !n.attributes.fulfillmentProperty?.trim() &&
          !n.attributes.invariantProperty?.trim() &&
          [undefined, '', 'ACHIEVE'].includes(n.attributes.mode?.trim()),
      );

  // links, child to parent: a relation's id, else as the seeds name them
  const links: Json[] = [];
  const linkIds = new Set<string>();
  const link = (
    type: string,
    source: string,
    target: string,
    { id, ...extra }: Json & { id?: string | null } = {},
  ) => {
    const base = id ?? `${source}-${type.replace('istar.', '')}-${target}`;
    let unique = base;
    for (let i = 2; linkIds.has(unique); i++) unique = `${base}-${i}`;
    linkIds.add(unique);
    links.push({ id: unique, type, source, target, ...extra });
  };
  const elementIds = new Set(elements.map(idOf));
  const children = new Set<string>();

  // AND/OR decomposition: the links each decomposition lists, or that name it
  for (const decomposition of relations('BooleanDecomposition')) {
    const root =
      one(decomposition, 'rootGoal') ?? one(decomposition, 'rootPlan');
    if (!root) {
      diagnostics.push({
        severity: 'warning',
        message: `A decomposition (${idOf(decomposition)}) without a root goal or plan: left out`,
      });
      continue;
    }
    const decLinks = new Set([
      ...reader.references(decomposition, 'BooleanDecLink'),
      ...relations('AndDecLink', 'OrDecLink').filter(
        (l) => one(l, 'BooleanDecomposition') === decomposition,
      ),
    ]);
    const type = decomposition.attributes.type?.trim().toUpperCase();
    for (const decLink of decLinks) {
      const child = one(decLink, 'targetGoal') ?? one(decLink, 'targetPlan');
      if (!child) continue;
      const and = localType(decLink) === 'AndDecLink';
      if (type && type !== (and ? 'AND' : 'OR'))
        diagnostics.push({
          severity: 'warning',
          message: `${nameOf(root)}'s ${type} decomposition has an ${and ? 'AND' : 'OR'} link to ${nameOf(child)}: read as its link says`,
        });
      link(
        and ? 'istar.AndRefinementLink' : 'istar.OrRefinementLink',
        idOf(child),
        idOf(root),
        { id: decLink.id },
      );
      children.add(idOf(child));
    }
  }
  // means-end: an OR-refinement of its end
  for (const meansEnd of relations('MeansEnd')) {
    const end = one(meansEnd, 'end');
    const means =
      one(meansEnd, 'meansPlan') ??
      one(meansEnd, 'meansGoal') ??
      one(meansEnd, 'meansResource');
    if (!end || !means) continue;
    if (kindOf(means) === 'istar.Resource') {
      diagnostics.push({
        severity: 'warning',
        message: `${nameOf(means)} is a resource, the means to ${nameOf(end)}: iStar 2.0 refines with goals and tasks only; left out`,
      });
      continue;
    }
    link('istar.OrRefinementLink', idOf(means), idOf(end), {
      id: meansEnd.id,
    });
    children.add(idOf(means));
  }
  // contributions: to a softgoal, valued by their metric
  for (const contribution of relations('Contribution', 'FContribution')) {
    const from = one(contribution, 'contributer');
    const to = one(contribution, 'contributed');
    if (!from || !to) continue;
    if (kindOf(to) !== 'istar.Quality') {
      diagnostics.push({
        severity: 'warning',
        message: `${nameOf(from)} contributes to ${nameOf(to)}, not a softgoal: iStar 2.0 contributes to qualities only; left out`,
      });
      continue;
    }
    const metric = contribution.attributes.metric?.trim() ?? '';
    const label = METRICS[metric];
    if (!label)
      diagnostics.push({
        severity: 'warning',
        message: `${nameOf(from)} → ${nameOf(to)}: metric ${metric ? `"${metric}"` : 'none'} is not ++, +, - or --; read as unknown`,
      });
    link('istar.ContributionLink', idOf(from), idOf(to), {
      id: contribution.id,
      label: label ?? 'unknown',
    });
  }
  // dependencies: their dependums, outside every actor; their two links'
  // ids the extension's, when it has them
  const dependencyLinks = new Map(
    extended('dependency').map((d) => [d.attributes.of ?? '', d.attributes]),
  );
  const dependums = new Map<string, { depender: string; dependee: string }>();
  for (const dependency of relations('Dependency', 'FDependency')) {
    const depender = one(dependency, 'depender');
    const dependee = one(dependency, 'dependee');
    const dependum =
      one(dependency, 'goalDependum') ??
      one(dependency, 'planDependum') ??
      one(dependency, 'resourceDependum');
    if (!depender || !dependee || !dependum) {
      diagnostics.push({
        severity: 'warning',
        message: `A dependency (${idOf(dependency)}) without its depender, dependee or dependum: left out`,
      });
      continue;
    }
    dependums.set(idOf(dependum), {
      depender: idOf(depender),
      dependee: idOf(dependee),
    });
    const ids = dependencyLinks.get(idOf(dependency));
    link('istar.DependencyLink', idOf(depender), idOf(dependum), {
      id: ids?.depender,
    });
    link('istar.DependencyLink', idOf(dependum), idOf(dependee), {
      id: ids?.dependee,
    });
    if (FORMAL.some((key) => dependency.attributes[key]?.trim()))
      diagnostics.push({
        severity: 'info',
        message: `The dependency on ${nameOf(dependum)}: its formal attributes are not read`,
      });
  }

  // the one root goal GODA generates from (a file goal-controller wrote
  // says which itself)
  const roots =
    goda && !extension
      ? elements.filter(
          (n) =>
            kindOf(n) === 'istar.Goal' &&
            !children.has(idOf(n)) &&
            !dependums.has(idOf(n)),
        )
      : [];
  if (goda && !extension && roots.length !== 1)
    diagnostics.push({
      severity: 'warning',
      message: `GODA-shaped, with ${roots.length} root goals: select the one to generate from`,
    });

  // the extension's properties, by what they are of
  const extra = new Map<string, Record<string, string>>();
  for (const property of extended('property')) {
    const of = property.attributes.of ?? '';
    extra.set(of, {
      ...extra.get(of),
      [property.attributes.key ?? '']: property.attributes.value ?? '',
    });
  }

  const propertiesOf = (node: XmiNode): Record<string, string> => {
    const kind = kindOf(node);
    const properties: Record<string, string> = {};
    for (const key of FORMAL) {
      const value = node.attributes[key]?.trim();
      if (!value) continue;
      if (goda) {
        if (key === 'creationProperty' && kind !== 'istar.Quality')
          properties.creationProperty = value;
        else if (key !== 'mode') properties[key] = value;
        continue;
      }
      if (kind !== 'istar.Goal') {
        properties[key] = value;
        continue;
      }
      if (key === 'mode') {
        const mode = value.toUpperCase();
        if (mode === 'MAINTAIN') properties.type = 'maintain';
        else if (mode === 'ACHIEVEMAINTAIN') {
          properties.type = 'maintain';
          diagnostics.push({
            severity: 'warning',
            message: `${nameOf(node)}: mode ACHIEVEMAINTAIN read as maintain; its achieve phase is lost`,
          });
        } else if (mode !== 'ACHIEVE') {
          properties.mode = value;
          diagnostics.push({
            severity: 'warning',
            message: `${nameOf(node)}: mode ${value} has no Tropos4AS goal type; kept as mode`,
          });
        }
      } else properties[CONDITIONS[key] ?? key] = value;
    }
    if (roots.length === 1 && roots[0] === node) properties.selected = 'true';
    return { ...properties, ...extra.get(idOf(node)) };
  };

  // positions: the first diagram node that draws each element or actor
  const placed = new Map<
    string,
    { x: number; y: number; width?: number; height?: number }
  >();
  for (const node of reader.document.nodes) {
    if (node.attributes.core === undefined || node.attributes.x === undefined)
      continue;
    const x = Number(node.attributes.x);
    const y = Number(node.attributes.y ?? 0);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const width = Number(node.attributes.width);
    const height = Number(node.attributes.height);
    for (const core of reader.references(node, 'core'))
      if (!placed.has(idOf(core)))
        placed.set(idOf(core), {
          x,
          y,
          ...(width > 0 && { width }),
          ...(height > 0 && { height }),
        });
  }
  const at = (id: string) => {
    const p = placed.get(id);
    return p ? { x: p.x, y: p.y } : {};
  };

  // each element's actor
  const actorOf = new Map<string, string>();
  for (const actor of actors) {
    for (const feature of ['wanted', 'plans', 'resources'])
      for (const element of reader.references(actor, feature))
        if (!actorOf.has(idOf(element)))
          actorOf.set(idOf(element), idOf(actor));
  }
  for (const element of elements)
    for (const feature of ['wanter', 'capableOf', 'use']) {
      const actor = one(element, feature);
      if (actor) actorOf.set(idOf(element), idOf(actor));
    }

  const pistarNode = (node: XmiNode): Json => ({
    id: idOf(node),
    text: nameOf(node),
    type: kindOf(node),
    ...at(idOf(node)),
    customProperties: propertiesOf(node),
  });
  const dependencies: Json[] = [];
  const orphans: Json[] = [];
  const nodesOf = new Map<string, Json[]>(actors.map((a) => [idOf(a), []]));
  for (const element of elements) {
    const id = idOf(element);
    const dependum = dependums.get(id);
    if (dependum) {
      if (actorOf.has(id))
        diagnostics.push({
          severity: 'warning',
          message: `${nameOf(element)} is a dependum and an actor's element: read as the dependum`,
        });
      dependencies.push({
        ...pistarNode(element),
        source: dependum.depender,
        target: dependum.dependee,
      });
    } else {
      const actor = actorOf.get(id);
      (actor !== undefined && nodesOf.get(actor)
        ? nodesOf.get(actor)!
        : orphans
      ).push(pistarNode(element));
    }
  }
  if (orphans.length && !extension)
    diagnostics.push({
      severity: 'info',
      message: `In no actor, kept outside them: ${orphans.map((n) => n.text).join(', ')}`,
    });
  for (const id of elementIds)
    if (!placed.has(id))
      diagnostics.push({
        severity: 'info',
        message: `${nameOf(reader.document.byId.get(id) ?? reader.document.byPath.get(id)!)}: no diagram places it; laid out`,
      });

  // what the extension keeps: nodes TAOM4E has no class for, their links
  for (const node of extended('node')) {
    const a = node.attributes;
    const x = numberOr(a.x);
    const y = numberOr(a.y);
    const written: Json = {
      id: a.id ?? '',
      text: a.text ?? '',
      type: a.type ?? '',
      ...(x !== undefined && { x }),
      ...(y !== undefined && { y }),
      customProperties: propertiesIn(node),
    };
    if (a.where === 'dependum')
      dependencies.push({ ...written, source: a.source, target: a.target });
    else if (a.actor !== undefined && nodesOf.has(a.actor))
      nodesOf.get(a.actor)!.push(written);
    else orphans.push(written);
  }
  for (const written of extended('link')) {
    const a = written.attributes;
    const properties = propertiesIn(written);
    link(a.type ?? '', a.source ?? '', a.target ?? '', {
      id: a.id,
      ...(a.label !== undefined && { label: a.label }),
      ...(Object.keys(properties).length && { customProperties: properties }),
    });
  }
  // a link's properties, by its id
  for (const written of links) {
    const properties = extra.get(written.id as string);
    if (properties && !written.customProperties)
      written.customProperties = properties;
  }
  // each list in the model's order
  const order = new Map(
    extended('order').map((o) => [
      o.attributes.of ?? '',
      (o.attributes.ids ?? '').split(' ').filter(Boolean),
    ]),
  );
  const inOrder = (list: Json[], of: string) => {
    const ids = order.get(of);
    if (!ids) return list;
    const rank = (node: Json) => {
      const i = ids.indexOf(node.id as string);
      return i < 0 ? ids.length : i;
    };
    return [...list].sort((a, b) => rank(a) - rank(b));
  };

  const display: Record<string, Json> = {};
  for (const [id, { width, height }] of placed)
    if (elementIds.has(id) && width && height) display[id] = { width, height };

  const actorTypes = new Map(
    extended('actor').map((a) => [a.attributes.of ?? '', a.attributes.type]),
  );
  const model: Json = {
    actors: actors.map((actor) => ({
      id: idOf(actor),
      text: nameOf(actor),
      type: actorTypes.get(idOf(actor)) ?? 'istar.Actor',
      ...at(idOf(actor)),
      customProperties: {
        ...Object.fromEntries(
          FORMAL.flatMap((key) => {
            const value = actor.attributes[key]?.trim();
            return value ? [[key, value]] : [];
          }),
        ),
        ...extra.get(idOf(actor)),
      },
      nodes: inOrder(nodesOf.get(idOf(actor)) ?? [], idOf(actor)),
    })),
    orphans: inOrder(orphans, ''),
    dependencies,
    links,
    display,
    tool: 'pistar.2.1.0',
    istar: '2.0',
  };
  const extent = layOut(model as Parameters<typeof layOut>[0]);
  const right = Math.max(
    extent?.right ?? 0,
    ...[...placed.values()].map((p) => p.x + (p.width ?? 100) + 40),
  );
  const bottom = Math.max(
    extent?.bottom ?? 0,
    ...[...placed.values()].map((p) => p.y + (p.height ?? 60) + 40),
  );
  const project =
    reader.document.nodes.find(
      (n) => localType(n) === 'Project' || n.feature.endsWith(':Project'),
    ) ??
    reader.document.nodes.find((n) =>
      (localType(n) || n.feature).endsWith('BusinessModel'),
    );
  const engine = goda ? 'goda' : 'tropos4as';
  return {
    model: {
      ...model,
      diagram: {
        width: Math.max(1000, right),
        height: Math.max(700, bottom),
        name: project?.attributes.name?.trim() || modelName,
        customProperties: {
          engine,
          ...propertiesIn(
            extended('diagram')[0] ?? ({ children: [] } as never),
          ),
        },
      },
      ...(!goda && { metamodel: tropos4asMetamodelBlock() }),
    },
    dialectRecord: { engine, projectResources: {} },
  };
};
