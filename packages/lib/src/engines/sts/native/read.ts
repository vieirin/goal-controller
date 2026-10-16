/**
 * STS-Tool's `.sts` into goal-controller (goal-controller#163 item 4,
 * #160 D-R4, D-R9): the native file's `read`, a piStar model in the `sts`
 * dialect, its dialect record and diagnostics. The format is EMF XMI, read
 * with the shared XMI reader; it is documented on #160 from the three
 * tutorial projects UniTN publishes, and nothing else.
 *
 * - Roles and agents → iStar's; goals and documents → each actor's goals
 *   and resources, by `actorOwner`. A GoalReference (a delegated goal in
 *   the delegatee) is a goal of its own, as is a DocumentReference (a
 *   transmitted document in the receiver): the delegation, or the
 *   transmission, links the original to it.
 * - Information and events → `sts.Information` and `sts.Event`, outside
 *   actors.
 * - Ids: the piStar ids are the file's (`id`); the texts are numbered by
 *   kind in the file's order, `G1: lot sold`, `R1: lot info`, `I1: …`,
 *   `E1: …`, so the writer, which writes each kind in its ids' order, reads
 *   back to the same model. Names are trimmed (the tool keeps a typed tab).
 * - Each relationship → its link (`sts.DelegatesLink`, …), its security
 *   needs → the link's properties (#160 D-R5); an AND/OR decomposition →
 *   iStar's refinement, child to parent; a play → `istar.ParticipatesInLink`.
 * - Positions: an actor's from its social view bound, its goals' and
 *   documents' relative to it; events' from the social view. Information
 *   is only drawn in the information view, another layout: the layout
 *   places it beside what it is linked to.
 * - Left out, with an info: notes; with a warning: a type or a need the
 *   mapping doesn't know.
 */
import {
  readXmi,
  type XmiNode,
  type XmiReader,
} from '@goal-controller/goal-language/formats';
import { layOut } from '../../../importers/layout';
import type { ImportDiagnostic, ImportResult } from '../../../importers/types';
import { stsMetamodelBlock } from '../extension';
import { ISTAR, STS_KEYS, STS_KINDS, STS_LINKS } from '../vocabulary';
import {
  AUTHORIZED,
  COD,
  FORBIDDEN,
  HEADER,
  NEED,
  NEED_PREFIX,
  NEED_TYPES,
  OPERATION_ATTRIBUTES,
  OR,
  STS_ROOT,
  TYPE,
  VIEW,
} from './vocabulary';

type Json = Record<string, unknown>;

const localType = (node: XmiNode) => node.type?.split(':').pop() ?? '';

/** The piStar kind of each node type, and its text's id prefix. */
const NODE_KINDS: Readonly<Record<string, { kind: string; prefix: string }>> = {
  [TYPE.goal]: { kind: ISTAR.goal, prefix: 'G' },
  [TYPE.goalReference]: { kind: ISTAR.goal, prefix: 'G' },
  [TYPE.document]: { kind: ISTAR.document, prefix: 'R' },
  [TYPE.documentReference]: { kind: ISTAR.document, prefix: 'R' },
  [TYPE.information]: { kind: STS_KINDS.information, prefix: 'I' },
  [TYPE.event]: { kind: STS_KINDS.event, prefix: 'E' },
};

/** The relationships' link objects, read through their relationship. */
const LINK_OBJECTS = new Set<string>([
  TYPE.delegationIn,
  TYPE.delegationOut,
  TYPE.transmissionIn,
  TYPE.transmissionOut,
  TYPE.authorizationIn,
  TYPE.authorizationOut,
]);

/** The types read as links, besides the relationships with link objects. */
const SIMPLE_LINKS: Readonly<Record<string, string>> = {
  [TYPE.read]: STS_LINKS.reads,
  [TYPE.modify]: STS_LINKS.modifies,
  [TYPE.produce]: STS_LINKS.produces,
  [TYPE.own]: STS_LINKS.owns,
  [TYPE.tangibleBy]: STS_LINKS.tangibleBy,
  [TYPE.partOf]: STS_LINKS.partOf,
  [TYPE.threat]: STS_LINKS.threatens,
  [TYPE.play]: ISTAR.plays,
};

export type StsContext = {
  /** the model's name when the file names none */
  modelName?: string;
  /** the file's name, so an `href` into it resolves */
  fileName?: string;
};

/** A bound's numbers, `x,y,w,h`. */
const boundOf = (
  node: XmiNode,
  view: string,
): { x: number; y: number } | undefined => {
  const constraint = node.children.find(
    (child) =>
      child.feature === 'graphicalConstraints' &&
      child.attributes.viewID === view,
  );
  const [x, y] = (constraint?.attributes.bound ?? '')
    .split(',')
    .map((n) => Number(n.trim()));
  return x !== undefined &&
    y !== undefined &&
    Number.isFinite(x) &&
    Number.isFinite(y)
    ? { x, y }
    : undefined;
};

/** A `.sts` text as an STS-ml model; null with error diagnostics when it isn't one. */
export const readSts = (
  text: string,
  { modelName = 'STS-ml model', fileName }: StsContext = {},
): ImportResult => {
  const { reader, diagnostics: xmi } = readXmi(text, {
    idAttribute: 'id',
    fileName,
  });
  const fail = (message: string): ImportResult => ({
    model: null,
    dialectRecord: null,
    diagnostics: [...xmi, { severity: 'error', message }],
  });
  if (!reader) return fail('Not XML');
  const root = reader.document.root;
  if (root.feature !== STS_ROOT)
    return fail(`<${root.feature}> is not ${STS_ROOT}: not an STS-Tool model`);
  const diagnostics: ImportDiagnostic[] = [];
  const model = toPistar(reader, modelName, diagnostics);
  return {
    model,
    dialectRecord: { engine: 'sts', projectResources: {} },
    diagnostics: [
      ...new Map(
        [...reader.diagnostics, ...diagnostics].map(({ severity, message }) => [
          message,
          { severity, message },
        ]),
      ).values(),
    ],
  };
};

const toPistar = (
  reader: XmiReader,
  modelName: string,
  diagnostics: ImportDiagnostic[],
): Json => {
  const elements = reader.children(reader.document.root, 'elements');
  const idOf = (node: XmiNode) => node.id ?? node.path;
  const nameOf = (node: XmiNode) => (node.attributes.name ?? '').trim();
  const one = (node: XmiNode, feature: string) =>
    reader.references(node, feature)[0];
  const ofType = (...types: string[]) =>
    elements.filter((node) => types.includes(localType(node)));

  // each node's text: its id, numbered by kind in the file's order, and its name
  const counts = new Map<string, number>();
  const texts = new Map<string, string>();
  for (const node of elements) {
    const kind = NODE_KINDS[localType(node)];
    if (!kind) continue;
    const n = (counts.get(kind.prefix) ?? 0) + 1;
    counts.set(kind.prefix, n);
    texts.set(idOf(node), `${kind.prefix}${n}: ${nameOf(node)}`);
  }
  /** a node's text id (`G3`), as refLists name it */
  const textIdOf = (node: XmiNode) =>
    texts.get(idOf(node))?.split(':')[0] ?? idOf(node);

  const known = new Set<string>([
    TYPE.role,
    TYPE.agent,
    ...Object.keys(NODE_KINDS),
    ...Object.keys(SIMPLE_LINKS),
    ...LINK_OBJECTS,
    TYPE.decomposition,
    TYPE.delegation,
    TYPE.transmission,
    TYPE.authorization,
    TYPE.duty,
  ]);
  for (const node of elements) {
    const type = localType(node);
    if (type === TYPE.note)
      diagnostics.push({
        severity: 'info',
        message: `Note "${nameOf(node)}": goal-controller has no notes; left out`,
      });
    else if (!known.has(type))
      diagnostics.push({
        severity: 'warning',
        message: `${node.type ?? node.feature} ${nameOf(node) || idOf(node)}: not in STS-ml's mapping; left out`,
      });
  }

  const links: Json[] = [];
  const link = (
    id: string,
    type: string,
    source: XmiNode | undefined,
    target: XmiNode | undefined,
    properties: Record<string, string> = {},
  ) => {
    if (!source || !target) {
      diagnostics.push({
        severity: 'warning',
        message: `${type.split('.')[1]} ${id}: an end is missing; left out`,
      });
      return;
    }
    links.push({
      id,
      type,
      source: idOf(source),
      target: idOf(target),
      ...(Object.keys(properties).length && { customProperties: properties }),
    });
  };

  for (const decomposition of ofType(TYPE.decomposition)) {
    const or = decomposition.attributes.type?.trim().toUpperCase() === OR;
    // the file's decomposition is parent → child; iStar's refinement child → parent
    link(
      idOf(decomposition),
      or ? ISTAR.or : ISTAR.and,
      one(decomposition, 'target'),
      one(decomposition, 'source'),
    );
  }
  for (const [type, kind] of Object.entries(SIMPLE_LINKS))
    for (const node of ofType(type))
      link(idOf(node), kind, one(node, 'source'), one(node, 'target'));
  for (const duty of ofType(TYPE.duty))
    link(
      idOf(duty),
      duty.attributes.type?.trim().toUpperCase() === COD
        ? STS_LINKS.combines
        : STS_LINKS.incompatible,
      one(duty, 'source'),
      one(duty, 'target'),
    );

  const needsOf = (node: XmiNode, where: string) =>
    node.children
      .filter((child) => child.feature === 'elementNeeds')
      .map((need) => {
        const id = need.attributes.elementNeedID ?? '';
        const values = Object.fromEntries(
          need.children
            .filter((child) => child.feature === 'properties')
            .map((p) => [p.attributes.name ?? '', p.attributes.value ?? '']),
        );
        return {
          need: id.startsWith(NEED_PREFIX) ? id.slice(NEED_PREFIX.length) : id,
          type: values.type,
          value: values.value,
          where,
        };
      });
  const typed = (
    need: { need: string; type?: string; where: string },
    allowed: readonly string[],
  ): string | undefined => {
    const option = need.type !== undefined ? NEED_TYPES[need.type] : undefined;
    if (option && allowed.includes(option)) return option;
    diagnostics.push({
      severity: 'warning',
      message: `${need.where}: ${need.need}'s type "${need.type ?? ''}" is none of ${allowed.join(', ')}; left out`,
    });
    return undefined;
  };
  const unknownNeed = (need: { need: string; where: string }) =>
    diagnostics.push({
      severity: 'warning',
      message: `${need.where}: security need ${need.need} is not one STS-ml has here; left out`,
    });

  for (const delegation of ofType(TYPE.delegation)) {
    const source = one(delegation, 'sourceGoal');
    const target = one(delegation, 'targetGoal');
    const where = `The delegation of ${source ? nameOf(source) : idOf(delegation)}`;
    const properties: Record<string, string> = {};
    for (const need of needsOf(delegation, where)) {
      const set = (key: string, value: string | undefined) => {
        if (value !== undefined) properties[key] = value;
      };
      switch (need.need) {
        case NEED.noDelegation:
          set(STS_KEYS.noRedelegation, 'true');
          break;
        case NEED.trustworthiness:
          set(STS_KEYS.trustworthiness, 'true');
          break;
        case NEED.availability:
          set(STS_KEYS.availability, need.value?.trim());
          break;
        case NEED.nonRepudiation:
          set(
            STS_KEYS.nonRepudiation,
            typed(need, ['acceptance', 'delegation', 'delegationAcceptance']),
          );
          break;
        case NEED.redundancy:
          set(
            STS_KEYS.redundancy,
            typed(need, [
              'trueSingleActor',
              'trueMultiActor',
              'fallbackSingleActor',
              'fallbackMultiActor',
            ]),
          );
          break;
        case NEED.delegationAuthentication:
          set(STS_KEYS.authentication, typed(need, ['delegator', 'delegatee']));
          break;
        default:
          unknownNeed(need);
      }
    }
    link(idOf(delegation), STS_LINKS.delegates, source, target, properties);
  }
  for (const transmission of ofType(TYPE.transmission)) {
    const source = one(transmission, 'sourceDocument');
    const target = one(transmission, 'targetDocument');
    const where = `The transmission of ${source ? nameOf(source) : idOf(transmission)}`;
    const properties: Record<string, string> = {};
    for (const need of needsOf(transmission, where)) {
      const set = (key: string, value: string | undefined) => {
        if (value !== undefined) properties[key] = value;
      };
      switch (need.need) {
        case NEED.integrity:
          set(
            STS_KEYS.integrity,
            typed(need, ['sender', 'receiver', 'system']),
          );
          break;
        case NEED.confidentiality:
          set(
            STS_KEYS.confidentiality,
            typed(need, ['sender', 'receiver', 'system']),
          );
          break;
        case NEED.availability:
          set(STS_KEYS.availability, need.value?.trim());
          break;
        case NEED.transmissionAuthentication:
          set(STS_KEYS.authentication, typed(need, ['sender', 'receiver']));
          break;
        case NEED.nonRepudiation:
          set(
            STS_KEYS.nonRepudiation,
            typed(need, ['transfer', 'acceptance', 'transferAcceptance']),
          );
          break;
        default:
          unknownNeed(need);
      }
    }
    link(idOf(transmission), STS_LINKS.transmits, source, target, properties);
  }
  for (const authorization of ofType(TYPE.authorization)) {
    const from = reader
      .references(authorization, 'incomingAuthorizationLink')
      .map((l) => one(l, 'source'))[0];
    const to = reader
      .references(authorization, 'outgoingAuthorizationLink')
      .map((l) => one(l, 'target'))[0];
    const where = `The authorisation from ${from ? nameOf(from) : '?'} to ${to ? nameOf(to) : '?'}`;
    const granted: string[] = [];
    const prohibited: string[] = [];
    for (const [operation, attribute] of Object.entries(OPERATION_ATTRIBUTES)) {
      const value = authorization.attributes[attribute]?.trim();
      if (value === AUTHORIZED) granted.push(operation);
      else if (value === FORBIDDEN) prohibited.push(operation);
      else if (value)
        diagnostics.push({
          severity: 'warning',
          message: `${where}: ${attribute}="${value}" is neither ${AUTHORIZED} nor ${FORBIDDEN}; read as unspecified`,
        });
    }
    const properties: Record<string, string> = {};
    if (granted.length) properties[STS_KEYS.granted] = granted.join(', ');
    if (prohibited.length)
      properties[STS_KEYS.prohibited] = prohibited.join(', ');
    const information = reader.references(authorization, 'informations');
    if (information.length)
      properties[STS_KEYS.information] = information.map(textIdOf).join(', ');
    const scope = reader.references(authorization, 'goals');
    if (scope.length)
      properties[STS_KEYS.scope] = scope.map(textIdOf).join(', ');
    for (const need of needsOf(authorization, where))
      if (need.need === NEED.noTransferability)
        properties[STS_KEYS.transferable] = 'false';
      else unknownNeed(need);
    link(idOf(authorization), STS_LINKS.authorises, from, to, properties);
  }

  // the actors, their goals and documents; information and events outside
  const actors = ofType(TYPE.role, TYPE.agent);
  const nodesOf = new Map<string, Json[]>(actors.map((a) => [idOf(a), []]));
  const orphans: Json[] = [];
  const positionOf = new Map<string, { x: number; y: number }>();
  for (const actor of actors) {
    const at = boundOf(actor, VIEW.social);
    if (at) positionOf.set(idOf(actor), at);
  }
  // by kind (goals, documents, events, information), each in the file's
  // order: as ./write writes them, so a model reads back the same
  const byKind = [
    ISTAR.goal,
    ISTAR.document,
    STS_KINDS.event,
    STS_KINDS.information,
  ].flatMap((kind) =>
    elements.filter((node) => NODE_KINDS[localType(node)]?.kind === kind),
  );
  for (const node of byKind) {
    const kind = NODE_KINDS[localType(node)]!;
    const description = node.attributes.description?.trim();
    const owner = one(node, 'actorOwner');
    const actorAt = owner && positionOf.get(idOf(owner));
    const bound = boundOf(node, VIEW.social);
    const at =
      kind.kind === STS_KINDS.information
        ? undefined
        : owner
          ? bound &&
            actorAt && { x: actorAt.x + bound.x, y: actorAt.y + bound.y }
          : bound;
    const pistar: Json = {
      id: idOf(node),
      text: texts.get(idOf(node)),
      type: kind.kind,
      ...at,
      customProperties: description
        ? { [STS_KEYS.description]: description }
        : {},
    };
    const list = owner && nodesOf.get(idOf(owner));
    if (list) list.push(pistar);
    else {
      if (kind.kind !== STS_KINDS.information && kind.kind !== STS_KINDS.event)
        diagnostics.push({
          severity: 'warning',
          message: `${texts.get(idOf(node))}: in no actor; kept outside them`,
        });
      orphans.push(pistar);
    }
  }

  const model: Json = {
    actors: actors.map((actor) => {
      const description = actor.attributes.description?.trim();
      return {
        id: idOf(actor),
        text: nameOf(actor),
        type: localType(actor) === TYPE.agent ? ISTAR.agent : ISTAR.role,
        ...positionOf.get(idOf(actor)),
        customProperties: description
          ? { [STS_KEYS.description]: description }
          : {},
        nodes: nodesOf.get(idOf(actor)) ?? [],
      };
    }),
    orphans,
    dependencies: [],
    links,
    display: {},
    tool: 'pistar.2.1.0',
    istar: '2.0',
  };
  const extent = layOut(model as Parameters<typeof layOut>[0]);
  const placed = [...positionOf.values()];
  const header = reader.document.root.attributes;
  return {
    ...model,
    diagram: {
      width: Math.max(
        1000,
        extent?.right ?? 0,
        ...placed.map((p) => p.x + 400),
      ),
      height: Math.max(
        700,
        extent?.bottom ?? 0,
        ...placed.map((p) => p.y + 400),
      ),
      name: header.name?.trim() || modelName,
      // the file's header, written back (./write)
      customProperties: {
        engine: 'sts',
        ...Object.fromEntries(
          HEADER.flatMap((key) =>
            header[key] !== undefined ? [[key, header[key]]] : [],
          ),
        ),
      },
    },
    metamodel: stsMetamodelBlock(),
  };
};
