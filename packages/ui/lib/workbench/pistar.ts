/**
 * piStar goal-model helpers for the workbench. Pure functions over the model
 * JSON text, parsed and written with @istar-ts/core: they never touch ids or
 * diagram layout, so an edited model can be exported and opened again in piStar.
 */
import {
  createEmptyModel,
  inheritSourceLayout,
  isActor,
  isNode,
  parsePistar,
  toPistar,
  updateDiagram,
  updateElement,
  type IstarElement,
  type IstarLink,
  type IstarModel,
  type LinkKind,
  type ToPistarOptions,
} from '@istar-ts/core';
import type { TransformEngine } from '@/lib/types';

export type NodeKind = 'goal' | 'task' | 'resource' | 'quality';
export type Relation = 'and' | 'or';

/** Execution construct written in a goal's RT notation */
export type Construct =
  | 'sequence'
  | 'anyOrder'
  | 'interleaved'
  | 'alternative'
  | 'choice'
  | 'degradation';

export type ViewNode = {
  /** RT id, e.g. "G3" (falls back to the piStar id when the text has none) */
  id: string;
  /** piStar node id (uuid) */
  iStarId: string;
  kind: NodeKind;
  name: string;
  /** raw text inside [...] */
  notation: string | null;
  construct: Construct | null;
  /** how this node refines its children (from the link types) */
  relation: Relation | null;
  children: string[];
  parent: string | null;
  properties: Record<string, string>;
  text: string;
  /** fill colour saved in the diagram (display.backgroundColor), if any */
  color: string | null;
};

export type ViewTree = {
  nodes: Map<string, ViewNode>;
  roots: string[];
  /** nodes by piStar id */
  byIStarId: Map<string, ViewNode>;
};

/** A new, empty piStar model. */
export const EMPTY_PISTAR_MODEL = `${toPistar(createEmptyModel(), { saveDate: '' })}\n`;

// ---------------------------------------------------------------------------
// Node text:  "G3: Prepare sample [T4@3->T5]"
// ---------------------------------------------------------------------------

const TEXT_RE =
  /^\s*([A-Za-z]+\d+[A-Za-z0-9.]*)\s*:\s*(.*?)\s*(?:\[(.*)\])?\s*$/s;

export const parseNodeText = (
  text: string,
): { id: string | null; name: string; notation: string | null } => {
  const match = TEXT_RE.exec(text);
  if (!match) {
    return { id: null, name: text.trim(), notation: null };
  }
  return {
    id: match[1] ?? null,
    name: (match[2] ?? '').trim(),
    notation: match[3] !== undefined ? match[3].trim() : null,
  };
};

export const composeNodeText = (
  id: string,
  name: string,
  notation: string | null,
): string => {
  const base = `${id}: ${name.trim()}`;
  return notation && notation.trim() ? `${base} [${notation.trim()}]` : base;
};

/** Names may only use letters, spaces, hyphens and apostrophes (RT grammar). */
export const isValidName = (name: string): boolean =>
  /^[A-Za-z\- ']*$/.test(name);

/**
 * The construct a notation expresses, per engine grammar. Edge (legacy) uses a
 * standalone `+` for choice; EdgeV2 uses `A?B` for choice and `A+B` for any order.
 */
export const notationConstruct = (
  notation: string | null,
  engine: TransformEngine,
): Construct | null => {
  if (!notation) {
    return null;
  }
  const n = notation.replace(/\s+/g, '');
  if (n.includes('->')) return 'degradation';
  if (n.includes(';')) return 'sequence';
  if (n.includes('#')) return 'interleaved';
  if (n.includes('|')) return 'alternative';
  if (engine === 'edge') {
    return n === '+' ? 'choice' : null;
  }
  if (n.includes('?')) return 'choice';
  if (n.includes('+')) return 'anyOrder';
  return null;
};

/** Ids referenced by a notation, in order: "T4@3->T5" → ["T4", "T5"] */
export const notationIds = (notation: string | null): string[] =>
  notation
    ? Array.from(notation.matchAll(/[A-Za-z]+\d+[A-Za-z0-9]*/g), (m) => m[0])
    : [];

export const CONSTRUCT_LABEL: Record<Construct, string> = {
  sequence: 'Sequence',
  anyOrder: 'Any order',
  interleaved: 'Interleaved',
  alternative: 'Alternative',
  choice: 'Choice',
  degradation: 'Degradation',
};

export const CONSTRUCT_HELP: Record<Construct, string> = {
  sequence: 'does every child, one after another',
  anyOrder: 'does every child, one at a time, in any order',
  interleaved: 'does every child, possibly at the same time',
  alternative: 'needs one child; picks again after each failed attempt',
  choice: 'needs one child; picks once and keeps it',
  degradation: 'retries the first child, then falls back to any child',
};

// ---------------------------------------------------------------------------
// View tree
// ---------------------------------------------------------------------------

/** Colour family of a node chip: how a goal refines its children, or task. */
export const nodeTone = (
  node: ViewNode | undefined,
): 'and' | 'or' | 'task' | 'plain' =>
  !node
    ? 'plain'
    : node.kind === 'task'
      ? 'task'
      : node.kind === 'goal'
        ? node.relation === 'or'
          ? 'or'
          : node.relation === 'and'
            ? 'and'
            : 'plain'
        : 'plain';

const kindOf = (kind: IstarElement['kind']): NodeKind =>
  kind === 'istar.Task'
    ? 'task'
    : kind === 'istar.Resource'
      ? 'resource'
      : kind === 'istar.Quality'
        ? 'quality'
        : 'goal';

/** Intentional elements inside actors or on the paper (dependums are not part of the goal tree). */
const goalElements = (model: IstarModel): IstarElement[] =>
  [...model.elements.values()].filter(
    (element) => isNode(element) && !element.isDependum,
  );

/** Build the goal tree from the piStar JSON (engine independent). */
export const buildViewTree = (
  text: string,
  engine: TransformEngine,
): ViewTree => {
  const model = parsePistar(text);
  const nodes = new Map<string, ViewNode>();
  const byIStarId = new Map<string, ViewNode>();

  for (const raw of goalElements(model)) {
    const parsed = parseNodeText(raw.name);
    const node: ViewNode = {
      id: parsed.id ?? raw.id,
      iStarId: raw.id,
      kind: kindOf(raw.kind),
      name: parsed.name,
      notation: parsed.notation,
      construct: notationConstruct(parsed.notation, engine),
      relation: null,
      children: [],
      parent: null,
      properties: { ...raw.customProperties },
      text: raw.name,
      color:
        typeof raw.display?.backgroundColor === 'string'
          ? raw.display.backgroundColor
          : null,
    };
    byIStarId.set(raw.id, node);
    if (!nodes.has(node.id)) {
      nodes.set(node.id, node);
    }
  }

  for (const link of model.links.values()) {
    const child = byIStarId.get(link.source);
    const parent = byIStarId.get(link.target);
    if (!child || !parent) continue;
    if (
      link.kind === 'istar.AndRefinementLink' ||
      link.kind === 'istar.OrRefinementLink'
    ) {
      parent.relation = link.kind === 'istar.OrRefinementLink' ? 'or' : 'and';
    }
    if (!parent.children.includes(child.id)) {
      parent.children.push(child.id);
    }
    child.parent ??= parent.id;
  }

  // children in notation order (the priority), then any unlisted ones
  for (const node of nodes.values()) {
    const order = notationIds(node.notation);
    if (order.length > 0) {
      node.children.sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
      });
    }
  }

  const explicitRoots = [...nodes.values()].filter(
    (n) => n.properties.root === 'true',
  );
  const roots = (
    explicitRoots.length > 0
      ? explicitRoots
      : [...nodes.values()].filter((n) => !n.parent && n.kind !== 'resource')
  ).map((n) => n.id);
  // anything unreachable from the roots is shown as its own root
  const reachable = new Set<string>();
  const visit = (id: string): void => {
    if (reachable.has(id)) return;
    reachable.add(id);
    nodes.get(id)?.children.forEach(visit);
  };
  roots.forEach(visit);
  for (const node of nodes.values()) {
    if (!reachable.has(node.id) && !node.parent) {
      roots.push(node.id);
      visit(node.id);
    }
  }

  return { nodes, roots, byIStarId };
};

// ---------------------------------------------------------------------------
// Edits (text in, text out; formatting of the file is kept)
// ---------------------------------------------------------------------------

const detectIndent = (text: string): number | string => {
  const match = /\n([ \t]+)"/.exec(text);
  if (!match || !match[1]) {
    return 0;
  }
  return match[1].includes('\t') ? '\t' : match[1].length;
};

/**
 * Write a model back as piStar JSON, in the indentation and trailing newline
 * of `like` (the text it was read from). `toPistar` keeps piStar's key order.
 */
export const serializeModel = (
  model: IstarModel,
  like: string,
  options?: ToPistarOptions,
): string => {
  const indent = detectIndent(like);
  const pistar = toPistar(model, options);
  const json =
    indent === 2
      ? pistar
      : JSON.stringify(
          JSON.parse(pistar),
          null,
          indent === 0 ? undefined : indent,
        );
  return json + (like.endsWith('\n') ? '\n' : '');
};

const rewrite = (
  text: string,
  edit: (model: IstarModel) => IstarModel,
): string => serializeModel(edit(parsePistar(text)), text);

const findNode = (model: IstarModel, iStarId: string): IstarElement => {
  const node = model.elements.get(iStarId);
  if (!node || !isNode(node)) {
    throw new Error(`node ${iStarId} not found`);
  }
  return node;
};

export const setNodeText = (
  text: string,
  iStarId: string,
  nodeText: string,
): string =>
  rewrite(text, (model) =>
    updateElement(model, findNode(model, iStarId).id, { name: nodeText }),
  );

/** Set (value) or remove (null) a custom property. */
/** Set (colour) or clear (null) an element's fill, kept in the diagram like piStar does. */
export const setNodeColor = (
  text: string,
  iStarId: string,
  color: string | null,
): string =>
  rewrite(text, (model) =>
    updateElement(model, findNode(model, iStarId).id, {
      // undefined removes the key
      display: { backgroundColor: color ?? undefined },
    }),
  );

export const setNodeProperty = (
  text: string,
  iStarId: string,
  key: string,
  value: string | null,
): string =>
  rewrite(text, (model) => {
    const node = findNode(model, iStarId);
    const properties = { ...node.customProperties };
    if (value === null) {
      delete properties[key];
    } else {
      properties[key] = value;
    }
    return updateElement(model, node.id, { customProperties: properties });
  });

/** Change how a node refines its children: rewrites the type of its child links. */
export const setRefinement = (
  text: string,
  iStarId: string,
  relation: Relation,
): string =>
  rewrite(text, (model) => {
    const kind: LinkKind =
      relation === 'or' ? 'istar.OrRefinementLink' : 'istar.AndRefinementLink';
    // a link's kind can't be patched, so the links are rebuilt in place (same ids and order)
    const links = new Map<string, IstarLink>(
      [...model.links].map(([id, link]): [string, IstarLink] =>
        link.target === iStarId &&
        (link.kind === 'istar.AndRefinementLink' ||
          link.kind === 'istar.OrRefinementLink')
          ? [id, { ...link, kind }]
          : [id, link],
      ),
    );
    return inheritSourceLayout(model, { ...model, links });
  });

// ---------------------------------------------------------------------------
// Source positions
// ---------------------------------------------------------------------------

/** [from, to) of the JSON object of each node, keyed by piStar id. */
export const nodeRanges = (
  text: string,
  iStarIds: Iterable<string>,
): Map<string, [number, number]> => {
  const ranges = new Map<string, [number, number]>();
  for (const iStarId of iStarIds) {
    const at = text.search(
      new RegExp(
        `"id"\\s*:\\s*"${iStarId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
      ),
    );
    if (at < 0) continue;
    const from = text.lastIndexOf('{', at);
    const to = matchingBrace(text, from);
    if (from >= 0 && to > from) {
      ranges.set(iStarId, [from, to + 1]);
    }
  }
  return ranges;
};

const matchingBrace = (text: string, open: number): number => {
  let depth = 0;
  let inString = false;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i += 1;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
};

/** Line/column (1-based) of a JSON.parse error, when the message carries it. */
export const jsonErrorPosition = (
  text: string,
  message: string,
): { line: number; column: number; offset: number } | null => {
  const lineCol = /line (\d+) column (\d+)/.exec(message);
  if (lineCol) {
    const line = Number(lineCol[1]);
    const column = Number(lineCol[2]);
    const offset =
      text
        .split('\n')
        .slice(0, line - 1)
        .reduce((sum, l) => sum + l.length + 1, 0) +
      column -
      1;
    return { line, column, offset };
  }
  const position = /position (\d+)/.exec(message);
  if (position) {
    const offset = Number(position[1]);
    const before = text.slice(0, offset);
    const line = before.split('\n').length;
    return { line, column: offset - before.lastIndexOf('\n'), offset };
  }
  return null;
};

// ---------------------------------------------------------------------------
// Model mode (which engine the model is for) and conversion between modes
// ---------------------------------------------------------------------------

/** What a model is for: one of the engines, or free iStar modelling in piStar mode. */
export type ModelMode = TransformEngine | 'pistar';

const MODES: readonly ModelMode[] = ['edgev2', 'edge', 'sleec', 'pistar'];

/**
 * The engine is kept in the diagram's custom properties: piStar keeps them when it opens
 * and saves a file (and shows them as ordinary properties), so the file stays a plain
 * piStar model. A model without it is a piStar model: piStar mode is never written.
 */
export const MODE_PROPERTY = 'engine';

const isMode = (value: unknown): value is ModelMode =>
  MODES.includes(value as ModelMode);

/** The engine recorded in the model; null when there is none (a piStar model, or an older file). */
export const modelMode = (model: IstarModel): ModelMode | null => {
  const value = model.diagram?.customProperties?.[MODE_PROPERTY];
  return isMode(value) ? value : null;
};

export const readModelMode = (text: string): ModelMode | null => {
  try {
    return modelMode(parsePistar(text));
  } catch {
    return null;
  }
};

const withMode = (model: IstarModel, mode: ModelMode): IstarModel => {
  const { [MODE_PROPERTY]: _previous, ...rest } =
    model.diagram?.customProperties ?? {};
  // piStar mode is the absence of an engine
  return updateDiagram(model, {
    customProperties:
      mode === 'pistar' ? rest : { ...rest, [MODE_PROPERTY]: mode },
  });
};

/** Record the mode in the model text (formatting kept). */
export const writeModelMode = (text: string, mode: ModelMode): string =>
  rewrite(text, (model) => withMode(model, mode));

const RT_ID = /^\s*([A-Za-z]+)(\d+)\s*:/;
const PREFIX: Partial<Record<IstarElement['kind'], string>> = {
  'istar.Goal': 'G',
  // the engines read qualities as goals
  'istar.Quality': 'G',
  'istar.Task': 'T',
  'istar.Resource': 'R',
};
const FIRST: Record<string, number> = { G: 0, T: 1, R: 1 };

/** Next free RT id ("G4", "T3", "R2") for an element kind, from the names in the model. */
export const nextRtId = (
  model: IstarModel,
  kind: IstarElement['kind'],
): string | null => {
  const prefix = PREFIX[kind];
  if (!prefix) return null;
  let max = (FIRST[prefix] ?? 1) - 1;
  for (const element of model.elements.values()) {
    const match = RT_ID.exec(element.name);
    if (match && match[1] === prefix) max = Math.max(max, Number(match[2]));
  }
  return `${prefix}${max + 1}`;
};

export type Conversion = {
  /** the model text converted to the target mode (automatic fixes applied, mode recorded) */
  text: string;
  /** what the conversion changes by itself */
  changes: string[];
  /** what has to be fixed by hand before the model can be converted */
  blockers: string[];
};

const EDGE_ELEMENTS = new Set([
  'istar.Actor',
  'istar.Goal',
  'istar.Task',
  'istar.Resource',
]);
const EDGE_LINKS = new Set([
  'istar.AndRefinementLink',
  'istar.OrRefinementLink',
  'istar.NeededByLink',
]);
const KIND_LABEL = (kind: string): string =>
  kind.replace(/^istar\./, '').replace(/Link$/, ' link');
const plural = (label: string): string =>
  label.endsWith('y') ? `${label.slice(0, -1)}ies` : `${label}s`;

/**
 * Converts a model to a mode: fixes what can be fixed safely (RT ids on unnamed elements;
 * a type for Edge resources that have none) and lists what cannot (element and link kinds
 * the engine does not read, a second actor). Whether the result is valid for the engine
 * is for the engine to say.
 */
export const planConversion = (text: string, target: ModelMode): Conversion => {
  let model = parsePistar(text);
  const changes: string[] = [];
  const blockers: string[] = [];
  if (target !== 'pistar') {
    // RT ids: every goal, task and resource name starts with one
    for (const element of model.elements.values()) {
      if (!isNode(element) || element.isDependum || RT_ID.test(element.name))
        continue;
      const id = nextRtId(model, element.kind);
      if (!id) continue;
      const name = `${id}: ${element.name.trim() || KIND_LABEL(element.kind)}`;
      model = updateElement(model, element.id, { name });
      changes.push(
        `"${element.name.trim() || KIND_LABEL(element.kind)}" is named ${name}`,
      );
    }
  }
  if (target === 'edge' || target === 'edgev2') {
    const counts = new Map<string, number>();
    for (const element of model.elements.values()) {
      if (!EDGE_ELEMENTS.has(element.kind))
        counts.set(element.kind, (counts.get(element.kind) ?? 0) + 1);
      if (isNode(element) && !element.isDependum && !element.parent) {
        blockers.push(
          `${element.name} is outside any actor: the Edge engines read the elements inside the actor`,
        );
      }
      if (
        element.kind === 'istar.Resource' &&
        !element.customProperties?.type
      ) {
        model = updateElement(model, element.id, {
          customProperties: {
            ...element.customProperties,
            type: 'bool',
            initialValue: 'true',
          },
        });
        changes.push(
          `${element.name} becomes a Boolean resource (type bool, initial value true)`,
        );
      }
    }
    for (const link of model.links.values()) {
      if (!EDGE_LINKS.has(link.kind))
        counts.set(link.kind, (counts.get(link.kind) ?? 0) + 1);
    }
    for (const [kind, count] of counts) {
      const label = KIND_LABEL(kind);
      blockers.push(
        `${count} ${count > 1 ? plural(label) : label}: the Edge engines do not read ${plural(label)}`,
      );
    }
    const actors = [...model.elements.values()].filter(isActor).length;
    if (actors > 1)
      blockers.push(`${actors} actors: the Edge engines read a single actor`);
  }
  return {
    text: serializeModel(withMode(model, target), text),
    changes,
    blockers,
  };
};
