/**
 * An STS-ml model as STS-Tool's `.sts` (goal-controller#163 item 4, #160
 * D-R9): the native file's `write`, the inverse of ./read. EMF writes both
 * ends of each reference; so does this, as the tutorial projects have
 * them (#160's format notes). Unverified against STS-Tool: whether the
 * tool may be run is the owner's question (#160 D-R2).
 *
 * - Each kind in its ids' order (`G1`, `G2`, … then those without an id),
 *   so ./read numbers them back the same.
 * - A goal a delegation targets is a GoalReference, its `reference` the
 *   goal the delegations start from; a document a transmission targets, a
 *   DocumentReference.
 * - Positions: an actor's social view bound from its `x`, `y`; its goals'
 *   and documents' relative to it; events' in the social view, and
 *   information's in the information view, as they are.
 * - Not written, with a warning: iStar's tasks and qualities, and links
 *   STS-Tool's file has no type for (contributions, dependencies).
 */
import {
  writeXmi,
  type XmiDiagnostic,
  type XmiWriteNode,
} from '@goal-controller/goal-language/formats';
import { readEnumSet } from '@goal-controller/goal-language';
import {
  ISTAR,
  refListItems,
  STS_KEYS,
  STS_KINDS,
  STS_LINKS,
} from '../vocabulary';
import {
  AUTHORIZED,
  COD,
  FORBIDDEN,
  NEED,
  NEED_PREFIX,
  OPERATION_ATTRIBUTES,
  OR,
  STS_NAMESPACE,
  STS_PREFIX,
  STS_ROOT,
  TOOL_TYPES,
  TYPE,
  VIEW,
} from './vocabulary';

type PistarNode = {
  id: string;
  text?: string;
  type: string;
  x?: number;
  y?: number;
  customProperties?: Record<string, string>;
};
type PistarActor = PistarNode & { nodes?: PistarNode[] };
type PistarLink = {
  id: string;
  type: string;
  source: string;
  target: string;
  customProperties?: Record<string, string>;
};
type PistarModel = {
  actors?: PistarActor[];
  orphans?: PistarNode[];
  links?: PistarLink[];
  diagram?: { name?: string; customProperties?: Record<string, string> };
};

/** A node being written: its references filled in as the relations are. */
type Writing = XmiWriteNode & {
  references: Record<string, XmiWriteNode[]>;
  attributes: Record<string, string | undefined>;
  children: XmiWriteNode[];
};

/** A text's id and name: `G3: lot sold` → G, 3, `lot sold`. */
const parseText = (text: string | undefined) => {
  const match = /^([A-Z]{1,2})(\d+):\s*(.*)$/s.exec(text ?? '');
  return match
    ? { prefix: match[1]!, number: Number(match[2]), name: match[3]!.trim() }
    : { prefix: '', number: Infinity, name: (text ?? '').trim() };
};

/** The piStar kinds STS-Tool has nodes for, in the order the file lists them. */
const NODE_ORDER = [
  ISTAR.goal,
  ISTAR.document,
  STS_KINDS.event,
  STS_KINDS.information,
] as const;

const constraint = (
  view: string,
  bound?: string,
  compartment = false,
): XmiWriteNode => ({
  feature: 'graphicalConstraints',
  attributes: { viewID: view, ...(bound && { bound }) },
  ...(compartment && {
    children: [
      {
        feature: 'properties',
        attributes: { name: 'compartment', value: 'true' },
      },
      {
        feature: 'properties',
        attributes: { name: 'compartment_switch', value: '100,100' },
      },
    ],
  }),
});

/** A security need: `<elementNeeds>`, its type and value as properties. */
const needNode = (
  need: string,
  { type, value }: { type?: string; value?: string } = {},
): XmiWriteNode => ({
  feature: 'elementNeeds',
  attributes: { elementNeedID: `${NEED_PREFIX}${need}` },
  children: [
    ...(type !== undefined
      ? [{ feature: 'properties', attributes: { name: 'type', value: type } }]
      : []),
    ...(value !== undefined
      ? [{ feature: 'properties', attributes: { name: 'value', value } }]
      : []),
  ],
});

/** A piStar model's JSON as a `.sts`; diagnostics say what it couldn't write. */
export const writeSts = (
  json: Readonly<Record<string, unknown>>,
): { text: string | null; diagnostics: XmiDiagnostic[] } => {
  const model = json as PistarModel;
  const diagnostics: XmiDiagnostic[] = [];
  const warn = (message: string) =>
    diagnostics.push({ severity: 'warning', message });

  const actors = model.actors ?? [];
  const links = model.links ?? [];
  const actorOf = new Map<string, PistarActor>();
  const nodes: PistarNode[] = [];
  for (const actor of actors)
    for (const node of actor.nodes ?? []) {
      actorOf.set(node.id, actor);
      nodes.push(node);
    }
  nodes.push(...(model.orphans ?? []));

  const delegatedFrom = new Map<string, string>();
  const transmittedFrom = new Map<string, string>();
  for (const link of links)
    if (link.type === STS_LINKS.delegates)
      delegatedFrom.set(link.target, link.source);
    else if (link.type === STS_LINKS.transmits)
      transmittedFrom.set(link.target, link.source);
  /** the original a copy is of: up its delegations, or transmissions */
  const originalOf = (id: string, from: Map<string, string>) => {
    const seen = new Set([id]);
    let at = id;
    while (from.has(at) && !seen.has(from.get(at)!)) {
      at = from.get(at)!;
      seen.add(at);
    }
    return at;
  };

  const written = new Map<string, Writing>();
  const elements: Writing[] = [];
  const add = (
    type: string,
    id: string,
    attributes: Record<string, string | undefined> = {},
  ): Writing => {
    const node: Writing = {
      feature: 'elements',
      type: `${STS_PREFIX}:${type}`,
      attributes: { id, ...attributes },
      references: {},
      children: [],
    };
    elements.push(node);
    return node;
  };
  const ref = (from: Writing, feature: string, to: XmiWriteNode) =>
    (from.references[feature] ??= []).push(to);

  // actors
  for (const actor of actors) {
    if (actor.type !== ISTAR.role && actor.type !== ISTAR.agent) {
      warn(
        `${actor.text}: STS-Tool has roles and agents, not ${actor.type}; written as a role`,
      );
    }
    const node = add(
      actor.type === ISTAR.agent ? TYPE.agent : TYPE.role,
      actor.id,
      {
        name: (actor.text ?? '').trim(),
        description: actor.customProperties?.[STS_KEYS.description],
      },
    );
    const x = Math.round(actor.x ?? 0);
    const y = Math.round(actor.y ?? 0);
    const inside = (actor.nodes ?? []).map((n) => ({
      x: (n.x ?? x) - x,
      y: (n.y ?? y) - y,
    }));
    const width = Math.max(200, ...inside.map((p) => p.x + 140));
    const height = Math.max(150, ...inside.map((p) => p.y + 90));
    const bound = `${x},${y},${width},${height}`;
    node.children.push(
      constraint(VIEW.social, bound, true),
      constraint(VIEW.information, bound, true),
      constraint(VIEW.authorization, `${x},${y},100,100`),
    );
    written.set(actor.id, node);
  }

  // goals, documents, events, information: each kind in its ids' order
  for (const kind of NODE_ORDER) {
    const ofKind = nodes
      .filter((n) => n.type === kind)
      .map((n, index) => ({ n, index, text: parseText(n.text) }))
      .sort((a, b) => a.text.number - b.text.number || a.index - b.index);
    for (const { n, text } of ofKind) {
      const actor = actorOf.get(n.id);
      const copy =
        kind === ISTAR.goal
          ? delegatedFrom.has(n.id)
          : kind === ISTAR.document && transmittedFrom.has(n.id);
      const type =
        kind === ISTAR.goal
          ? copy
            ? TYPE.goalReference
            : TYPE.goal
          : kind === ISTAR.document
            ? copy
              ? TYPE.documentReference
              : TYPE.document
            : kind === STS_KINDS.event
              ? TYPE.event
              : TYPE.information;
      const node = add(type, n.id, {
        name: text.name,
        description: n.customProperties?.[STS_KEYS.description],
      });
      if (actor) {
        const owner = written.get(actor.id)!;
        ref(node, 'actorOwner', owner);
        ref(owner, kind === ISTAR.goal ? 'goals' : 'documents', node);
        const bound = `${Math.round((n.x ?? actor.x ?? 0) - (actor.x ?? 0))},${Math.round((n.y ?? actor.y ?? 0) - (actor.y ?? 0))},100,50`;
        node.children.push(constraint(VIEW.social, bound));
        if (kind === ISTAR.document)
          node.children.push(constraint(VIEW.information, bound));
      } else if (kind === STS_KINDS.event || kind === STS_KINDS.information) {
        const bound = `${Math.round(n.x ?? 0)},${Math.round(n.y ?? 0)},100,50`;
        node.children.push(
          constraint(
            kind === STS_KINDS.event ? VIEW.social : VIEW.information,
            bound,
          ),
        );
      } else
        warn(
          `${n.text}: in no actor; STS-Tool keeps goals and documents in actors`,
        );
      written.set(n.id, node);
    }
  }
  for (const n of nodes)
    if (!written.has(n.id))
      warn(`${n.text}: STS-Tool has no ${n.type.split('.')[1]}; not written`);
  // a copy's reference: the original its delegations or transmissions start from
  for (const [copies, feature] of [
    [delegatedFrom, 'reference'],
    [transmittedFrom, 'reference'],
  ] as const)
    for (const copy of copies.keys()) {
      const node = written.get(copy);
      const original = written.get(originalOf(copy, copies));
      if (node && original && original !== node) {
        ref(node, feature, original);
        ref(original, 'references', node);
      }
    }

  /** The text ids of a refList, as written nodes. */
  const byTextId = new Map<string, Writing>();
  for (const n of nodes) {
    const node = written.get(n.id);
    const { prefix, number } = parseText(n.text);
    if (node && prefix) byTextId.set(`${prefix}${number}`, node);
    if (node) byTextId.set(n.id, node);
  }
  const listed = (text: string | undefined, where: string) => {
    const ids = refListItems(text);
    if (!ids) warn(`${where}: "${text}" is not a list of ids; left out`);
    return (ids ?? []).flatMap((id) => {
      const node = byTextId.get(id);
      if (!node) warn(`${where}: ${id} names nothing in the model; left out`);
      return node ? [node] : [];
    });
  };

  const relation = (
    link: PistarLink,
    type: string,
    sourceFeature: string,
    targetFeature: string,
    attributes: Record<string, string | undefined> = {},
  ) => {
    const source = written.get(link.source);
    const target = written.get(link.target);
    if (!source || !target) {
      warn(
        `${link.type.split('.')[1]} ${link.id}: an end isn't written; left out`,
      );
      return null;
    }
    const node = add(type, link.id, attributes);
    ref(node, 'source', source);
    ref(node, 'target', target);
    ref(source, sourceFeature, node);
    ref(target, targetFeature, node);
    return node;
  };
  /** a relationship through its two link objects: actor → it → actor */
  const throughLinks = (
    node: Writing,
    from: Writing,
    to: Writing,
    [inType, outType]: readonly [string, string],
    [inFeature, outFeature]: readonly [string, string],
    [fromFeature, toFeature]: readonly [string, string],
  ) => {
    const inbound = add(inType, `${node.attributes.id}-in`);
    const outbound = add(outType, `${node.attributes.id}-out`);
    ref(inbound, 'source', from);
    ref(inbound, 'target', node);
    ref(outbound, 'source', node);
    ref(outbound, 'target', to);
    ref(node, inFeature, inbound);
    ref(node, outFeature, outbound);
    ref(from, fromFeature, inbound);
    ref(to, toFeature, outbound);
  };
  const actorOfNode = (id: string) => {
    const actor = actorOf.get(id);
    return actor && written.get(actor.id);
  };

  const ofType = (...types: string[]) =>
    links.filter((link) => types.includes(link.type));
  for (const link of ofType(ISTAR.and, ISTAR.or)) {
    // iStar's refinement child → parent; the file's decomposition parent → child
    const parent = written.get(link.target);
    const child = written.get(link.source);
    if (!parent || !child) {
      warn(`refinement ${link.id}: an end isn't written; left out`);
      continue;
    }
    const node = add(TYPE.decomposition, link.id, {
      type: link.type === ISTAR.or ? OR : undefined,
    });
    ref(node, 'source', parent);
    ref(node, 'target', child);
    ref(parent, 'outgoingDecompositions', node);
    ref(child, 'incomingDecompositions', node);
  }
  for (const [kind, type, goalSide, documentSide] of [
    [STS_LINKS.reads, TYPE.read, 'resourceReaded', 'goalsReading'],
    [STS_LINKS.modifies, TYPE.modify, 'resourcesModified', 'goalsModifing'],
    [STS_LINKS.produces, TYPE.produce, 'resourcesProduced', 'goalsProducing'],
  ] as const)
    for (const link of ofType(kind))
      relation(link, type, goalSide, documentSide);

  for (const link of ofType(STS_LINKS.delegates)) {
    const source = written.get(link.source);
    const target = written.get(link.target);
    const from = actorOfNode(link.source);
    const to = actorOfNode(link.target);
    if (!source || !target || !from || !to) {
      warn(
        `delegation ${link.id}: its goals and their actors aren't all written; left out`,
      );
      continue;
    }
    const p = link.customProperties ?? {};
    const node = add(TYPE.delegation, link.id, {
      name: source.attributes.name,
    });
    ref(node, 'sourceGoal', source);
    ref(node, 'targetGoal', target);
    ref(source, 'delegatedTo', node);
    ref(target, 'delegatedFrom', node);
    throughLinks(
      node,
      from,
      to,
      [TYPE.delegationIn, TYPE.delegationOut],
      ['incomingDelegationLink', 'outgoingDelegationLink'],
      ['outgoingDelegations', 'incomingDelegations'],
    );
    const type = (key: string) =>
      p[key]?.trim() ? TOOL_TYPES[p[key]!.trim()] : undefined;
    if (p[STS_KEYS.noRedelegation]?.trim() === 'true')
      node.children.push(needNode(NEED.noDelegation));
    if (type(STS_KEYS.nonRepudiation))
      node.children.push(
        needNode(NEED.nonRepudiation, { type: type(STS_KEYS.nonRepudiation) }),
      );
    if (type(STS_KEYS.redundancy))
      node.children.push(
        needNode(NEED.redundancy, { type: type(STS_KEYS.redundancy) }),
      );
    if (p[STS_KEYS.trustworthiness]?.trim() === 'true')
      node.children.push(needNode(NEED.trustworthiness));
    if (p[STS_KEYS.availability]?.trim())
      node.children.push(
        needNode(NEED.availability, {
          value: p[STS_KEYS.availability]!.trim(),
        }),
      );
    if (type(STS_KEYS.authentication))
      node.children.push(
        needNode(NEED.delegationAuthentication, {
          type: type(STS_KEYS.authentication),
        }),
      );
    if (p[STS_KEYS.threatenedBy]?.trim())
      warn(
        `delegation ${link.id}: STS-Tool's file has no events on delegations; threatenedBy not written`,
      );
  }
  for (const link of ofType(STS_LINKS.transmits)) {
    const source = written.get(link.source);
    const target = written.get(link.target);
    const from = actorOfNode(link.source);
    const to = actorOfNode(link.target);
    if (!source || !target || !from || !to) {
      warn(
        `transmission ${link.id}: its documents and their actors aren't all written; left out`,
      );
      continue;
    }
    const p = link.customProperties ?? {};
    const node = add(TYPE.transmission, link.id, {
      name: source.attributes.name,
    });
    ref(node, 'sourceDocument', source);
    ref(node, 'targetDocument', target);
    ref(source, 'TransmittedTo', node);
    ref(target, 'transmittedFrom', node);
    throughLinks(
      node,
      from,
      to,
      [TYPE.transmissionIn, TYPE.transmissionOut],
      ['incomingTransmissionLink', 'outgoingTransmissionLink'],
      ['outgoingTransmissions', 'incomingTransmissions'],
    );
    const type = (key: string) =>
      p[key]?.trim() ? TOOL_TYPES[p[key]!.trim()] : undefined;
    if (p[STS_KEYS.availability]?.trim())
      node.children.push(
        needNode(NEED.availability, {
          value: p[STS_KEYS.availability]!.trim(),
        }),
      );
    for (const [key, need] of [
      [STS_KEYS.integrity, NEED.integrity],
      [STS_KEYS.confidentiality, NEED.confidentiality],
      [STS_KEYS.authentication, NEED.transmissionAuthentication],
      [STS_KEYS.nonRepudiation, NEED.nonRepudiation],
    ] as const)
      if (type(key)) node.children.push(needNode(need, { type: type(key) }));
    if (p[STS_KEYS.threatenedBy]?.trim())
      warn(
        `transmission ${link.id}: STS-Tool's file has no events on transmissions; threatenedBy not written`,
      );
  }
  for (const link of ofType(ISTAR.plays))
    relation(link, TYPE.play, 'playedRoles', 'playedBy');
  for (const link of ofType(STS_LINKS.incompatible, STS_LINKS.combines))
    relation(link, TYPE.duty, 'outgoingDuties', 'incomingDuties', {
      type: link.type === STS_LINKS.combines ? COD : undefined,
    });
  for (const link of ofType(STS_LINKS.threatens))
    relation(link, TYPE.threat, 'threatedElements', 'threatedBy');
  for (const link of ofType(STS_LINKS.owns))
    relation(link, TYPE.own, 'informations', 'owners');
  for (const link of ofType(STS_LINKS.tangibleBy))
    relation(link, TYPE.tangibleBy, 'tangibleElements', 'intangibleElements');
  // part → whole: the part's `partsOf`, the whole's `subParts`
  for (const link of ofType(STS_LINKS.partOf))
    relation(link, TYPE.partOf, 'partsOf', 'subParts');

  for (const link of ofType(STS_LINKS.authorises)) {
    const from = written.get(link.source);
    const to = written.get(link.target);
    if (!from || !to) {
      warn(`authorisation ${link.id}: an actor isn't written; left out`);
      continue;
    }
    const p = link.customProperties ?? {};
    const granted = readEnumSet(p[STS_KEYS.granted] ?? '') ?? [];
    const prohibited = readEnumSet(p[STS_KEYS.prohibited] ?? '') ?? [];
    const node = add(
      TYPE.authorization,
      link.id,
      Object.fromEntries(
        Object.entries(OPERATION_ATTRIBUTES).map(([operation, attribute]) => [
          attribute,
          granted.includes(operation)
            ? AUTHORIZED
            : prohibited.includes(operation)
              ? FORBIDDEN
              : undefined,
        ]),
      ),
    );
    throughLinks(
      node,
      from,
      to,
      [TYPE.authorizationIn, TYPE.authorizationOut],
      ['incomingAuthorizationLink', 'outgoingAuthorizationLink'],
      ['outgoingAuthorizations', 'incomingAuthorizations'],
    );
    const where = `authorisation ${link.id}`;
    for (const information of listed(p[STS_KEYS.information], where)) {
      ref(node, 'informations', information);
      ref(information as Writing, 'authorizations', node);
    }
    for (const goal of listed(p[STS_KEYS.scope], where)) {
      ref(node, 'goals', goal);
      ref(goal as Writing, 'authorizations', node);
    }
    if (p[STS_KEYS.transferable]?.trim() === 'false')
      node.children.push(needNode(NEED.noTransferability));
  }
  const writable = new Set<string>([
    ISTAR.and,
    ISTAR.or,
    ISTAR.plays,
    ...Object.values(STS_LINKS),
  ]);
  for (const link of links)
    if (!writable.has(link.type))
      warn(
        `${link.type} ${link.id}: STS-Tool's file has no such relationship; not written`,
      );

  const header = model.diagram?.customProperties ?? {};
  const { text, diagnostics: xmi } = writeXmi(
    {
      feature: STS_ROOT,
      attributes: {
        name: model.diagram?.name ?? '',
        author: header.author,
        revision: header.revision,
        version: header.version,
        company: header.company,
      },
      children: [
        { feature: 'graphicalConstraint', attributes: { viewID: VIEW.social } },
        ...elements,
      ],
    },
    {
      namespaces: { [STS_PREFIX]: STS_NAMESPACE },
      xmiVersion: null,
      encoding: 'ASCII',
      order: ['id', 'name'],
    },
  );
  return { text, diagnostics: [...diagnostics, ...xmi] };
};
