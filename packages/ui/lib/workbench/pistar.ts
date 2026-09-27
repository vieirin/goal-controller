/**
 * piStar goal-model helpers for the workbench. Pure functions over the model
 * JSON text: they never touch ids or diagram layout, so an edited model can be
 * exported and opened again in piStar.
 */
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
};

export type ViewTree = {
  nodes: Map<string, ViewNode>;
  roots: string[];
  /** nodes by piStar id */
  byIStarId: Map<string, ViewNode>;
};

type PiStarNode = {
  id: string;
  text: string;
  type: string;
  customProperties?: Record<string, string>;
  [key: string]: unknown;
};
type PiStarLink = { id: string; type: string; source: string; target: string };
type PiStarModel = {
  actors?: Array<{ nodes?: PiStarNode[] }>;
  orphans?: PiStarNode[];
  links?: PiStarLink[];
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Node text:  "G3: Prepare sample [T4@3->T5]"
// ---------------------------------------------------------------------------

const TEXT_RE = /^\s*([A-Za-z]+\d+[A-Za-z0-9.]*)\s*:\s*(.*?)\s*(?:\[(.*)\])?\s*$/s;

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
export const isValidName = (name: string): boolean => /^[A-Za-z\- ']*$/.test(name);

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
  notation ? Array.from(notation.matchAll(/[A-Za-z]+\d+[A-Za-z0-9]*/g), (m) => m[0]) : [];

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

const kindOf = (type: string): NodeKind =>
  type === 'istar.Task'
    ? 'task'
    : type === 'istar.Resource'
      ? 'resource'
      : type === 'istar.Quality'
        ? 'quality'
        : 'goal';

const allNodes = (model: PiStarModel): PiStarNode[] => [
  ...(model.actors ?? []).flatMap((actor) => actor.nodes ?? []),
  ...(model.orphans ?? []),
];

export const parseModel = (text: string): PiStarModel => JSON.parse(text) as PiStarModel;

/** Build the goal tree from the piStar JSON (engine independent). */
export const buildViewTree = (text: string, engine: TransformEngine): ViewTree => {
  const model = parseModel(text);
  const nodes = new Map<string, ViewNode>();
  const byIStarId = new Map<string, ViewNode>();

  for (const raw of allNodes(model)) {
    const parsed = parseNodeText(raw.text ?? '');
    const node: ViewNode = {
      id: parsed.id ?? raw.id,
      iStarId: raw.id,
      kind: kindOf(raw.type),
      name: parsed.name,
      notation: parsed.notation,
      construct: notationConstruct(parsed.notation, engine),
      relation: null,
      children: [],
      parent: null,
      properties: { ...(raw.customProperties ?? {}) },
      text: raw.text ?? '',
    };
    byIStarId.set(raw.id, node);
    if (!nodes.has(node.id)) {
      nodes.set(node.id, node);
    }
  }

  for (const link of model.links ?? []) {
    const child = byIStarId.get(link.source);
    const parent = byIStarId.get(link.target);
    if (!child || !parent) continue;
    if (link.type === 'istar.AndRefinementLink' || link.type === 'istar.OrRefinementLink') {
      parent.relation = link.type === 'istar.OrRefinementLink' ? 'or' : 'and';
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

  const explicitRoots = [...nodes.values()].filter((n) => n.properties.root === 'true');
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

const rewrite = (text: string, mutate: (model: PiStarModel) => void): string => {
  const model = parseModel(text);
  mutate(model);
  const indent = detectIndent(text);
  return JSON.stringify(model, null, indent === 0 ? undefined : indent) + (text.endsWith('\n') ? '\n' : '');
};

const findNode = (model: PiStarModel, iStarId: string): PiStarNode => {
  const node = allNodes(model).find((n) => n.id === iStarId);
  if (!node) {
    throw new Error(`node ${iStarId} not found`);
  }
  return node;
};

export const setNodeText = (text: string, iStarId: string, nodeText: string): string =>
  rewrite(text, (model) => {
    findNode(model, iStarId).text = nodeText;
  });

/** Set (value) or remove (null) a custom property. */
export const setNodeProperty = (
  text: string,
  iStarId: string,
  key: string,
  value: string | null,
): string =>
  rewrite(text, (model) => {
    const node = findNode(model, iStarId);
    const properties = { ...(node.customProperties ?? {}) };
    if (value === null) {
      delete properties[key];
    } else {
      properties[key] = value;
    }
    node.customProperties = properties;
  });

/** Change how a node refines its children: rewrites the type of its child links. */
export const setRefinement = (text: string, iStarId: string, relation: Relation): string =>
  rewrite(text, (model) => {
    for (const link of model.links ?? []) {
      if (
        link.target === iStarId &&
        (link.type === 'istar.AndRefinementLink' || link.type === 'istar.OrRefinementLink')
      ) {
        link.type = relation === 'or' ? 'istar.OrRefinementLink' : 'istar.AndRefinementLink';
      }
    }
  });

// ---------------------------------------------------------------------------
// Source positions
// ---------------------------------------------------------------------------

/** [from, to) of the JSON object of each node, keyed by piStar id. */
export const nodeRanges = (text: string, iStarIds: Iterable<string>): Map<string, [number, number]> => {
  const ranges = new Map<string, [number, number]>();
  for (const iStarId of iStarIds) {
    const at = text.search(new RegExp(`"id"\\s*:\\s*"${iStarId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
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
    const offset = text.split('\n').slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0) + column - 1;
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
