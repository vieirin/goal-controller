/**
 * What the agent changed in the open model (goal-controller#415's drawer runs
 * `beginAgentChanges`/`endAgentChanges` around each one): a content-hash
 * snapshot taken before the run, diffed against the model after, then folded
 * into what earlier runs already marked. Ids are the model's own (an
 * `IstarElement.id`/`IstarLink.id`, React Flow's `data-id` on the diagram) so
 * the canvas can badge a node or an edge directly; a link has no line of its
 * own in the notation views, so its change also marks the element whose line
 * carries it (`lineOwnerOf`).
 */
import type { AnyIstarModel, IstarElement, IstarLink } from '@istar-ts/core';
import type { LineMark } from './codemirror';
import { cssString } from './analysis';

/**
 * The three link kinds goal-tree's `linkRelation` (packages/goal-tree/src/
 * internal/roots.ts) turns into a parent/child pair, regardless of dialect:
 * the notation writes them on the parent's (`target`'s) line, as a bracket
 * in its children list (`document.ts`'s `node.children`), not under their
 * own `source` the way a link with writable properties is (`hasLinkLine`,
 * e.g. a Contribution's weight, a Dependency's or a Qualification's own
 * properties — under `source`, unaffected here).
 */
const RELATION_LINK_KINDS = new Set([
  'istar.AndRefinementLink',
  'istar.OrRefinementLink',
  'istar.NeededByLink',
]);

/** The element whose notation line a link's change shows up on. */
const lineOwnerOf = (
  link: Pick<IstarLink<string>, 'kind' | 'source' | 'target'>,
): string => (RELATION_LINK_KINDS.has(link.kind) ? link.target : link.source);

export type AgentChanges = {
  readonly added: ReadonlySet<string>;
  readonly edited: ReadonlySet<string>;
  readonly removed: ReadonlySet<string>;
};

export const EMPTY_AGENT_CHANGES: AgentChanges = {
  added: new Set(),
  edited: new Set(),
  removed: new Set(),
};

/** Taken by `beginAgentChanges`, read back by `endAgentChanges` (`diffModel`). */
export type AgentChangeSnapshot = {
  readonly elements: ReadonlyMap<string, string>;
  readonly links: ReadonlyMap<
    string,
    { readonly hash: string; readonly lineOwner: string }
  >;
};

/** `JSON.stringify` with object keys sorted, so two equal values hash the same regardless of insertion order. */
const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

const hashElement = (element: IstarElement<string>): string =>
  stableStringify(element);
const hashLink = (link: IstarLink<string>): string => stableStringify(link);

/** A snapshot of every element and link's content, before a run. */
export const snapshotModel = (model: AnyIstarModel): AgentChangeSnapshot => ({
  elements: new Map(
    [...model.elements].map(([id, element]) => [id, hashElement(element)]),
  ),
  links: new Map(
    [...model.links].map(([id, link]) => [
      id,
      { hash: hashLink(link), lineOwner: lineOwnerOf(link) },
    ]),
  ),
});

/** One run's changes against `snapshot`: not yet folded into what earlier runs found (`mergeAgentChanges`). */
export const diffModel = (
  snapshot: AgentChangeSnapshot,
  model: AnyIstarModel,
): AgentChanges => {
  const added = new Set<string>();
  const edited = new Set<string>();
  const removed = new Set<string>();

  for (const [id, element] of model.elements) {
    const prev = snapshot.elements.get(id);
    if (prev === undefined) added.add(id);
    else if (prev !== hashElement(element)) edited.add(id);
  }
  for (const id of snapshot.elements.keys())
    if (!model.elements.has(id)) removed.add(id);

  // a link's own id, for the canvas (every link is drawn as its own edge);
  // its line-owning element too, for the notation views (no line of their own for a link)
  const markLineOwner = (owner: string): void => {
    if (model.elements.has(owner) && !added.has(owner)) edited.add(owner);
  };
  for (const [id, link] of model.links) {
    const prev = snapshot.links.get(id);
    if (prev === undefined) {
      added.add(id);
      markLineOwner(lineOwnerOf(link));
    } else if (prev.hash !== hashLink(link)) {
      edited.add(id);
      // a re-pointed link (another source or target): both the line it now
      // shows up on and the one it no longer does
      markLineOwner(lineOwnerOf(link));
      markLineOwner(prev.lineOwner);
    }
  }
  for (const [id, prev] of snapshot.links)
    if (!model.links.has(id)) {
      removed.add(id);
      markLineOwner(prev.lineOwner);
    }

  return { added, edited, removed };
};

/**
 * Accumulates a run's diff into what came before: an id added in an earlier
 * run stays added even if a later run only edits it; a removed id drops out
 * of both (there is nothing left to badge).
 */
export const mergeAgentChanges = (
  accumulated: AgentChanges,
  diff: AgentChanges,
): AgentChanges => {
  const added = new Set(accumulated.added);
  const edited = new Set(accumulated.edited);
  const removed = new Set(accumulated.removed);

  for (const id of diff.removed) {
    added.delete(id);
    edited.delete(id);
    removed.add(id);
  }
  for (const id of diff.added) {
    removed.delete(id);
    edited.delete(id);
    added.add(id);
  }
  for (const id of diff.edited) {
    if (added.has(id)) continue;
    removed.delete(id);
    edited.add(id);
  }
  return { added, edited, removed };
};

/**
 * Which lines a notation editor marks NEW/EDITED: one `LineMark` per 1-based
 * line whose key (`keysOf`'s) resolves, through `iStarIdOf`, to a changed
 * element's id. `removed` ids have no line left to mark.
 */
export const agentLineMarks = (
  keys: readonly (string | null)[],
  iStarIdOf: (key: string) => string | undefined,
  changes: AgentChanges,
): LineMark[] => {
  const marks: LineMark[] = [];
  keys.forEach((key, index) => {
    const iStarId = key ? iStarIdOf(key) : undefined;
    if (!iStarId) return;
    if (changes.added.has(iStarId))
      marks.push({
        line: index + 1,
        className: 'cm-agent-new',
        attributes: { 'data-agent-badge': 'NEW' },
      });
    else if (changes.edited.has(iStarId))
      marks.push({
        line: index + 1,
        className: 'cm-agent-edited',
        attributes: { 'data-agent-badge': 'EDITED' },
      });
  });
  return marks;
};

/** The canvas container's attribute while `agentChangeStyle` has a stylesheet to show (goal-controller#107's `SELECTION_ATTRIBUTE` pattern). */
export const AGENT_CHANGE_ATTRIBUTE = 'data-agent-changes';

/** Mirrors tailwind.config.js's `added`/`caution` tokens: a plain string can't read the theme (see `selectionStyle`, which hardcodes its own values too). */
const ADDED_COLOR = '#1E8E3E';
const EDITED_COLOR = '#9A6B00';

const canvasRules = (ids: ReadonlySet<string>, color: string, badge: string) =>
  [...ids]
    .map((id) => {
      const node = `[${AGENT_CHANGE_ATTRIBUTE}] .react-flow__node[data-id=${cssString(id)}]`;
      const edge = `[${AGENT_CHANGE_ATTRIBUTE}] .react-flow__edge[data-id=${cssString(id)}] path`;
      return (
        // !important: a marked node stays visible even dimmed by a selection case (selectionStyle, goal-controller#152)
        `${node} { box-shadow: 0 0 0 2px ${color}; border-radius: 6px; opacity: 1 !important; }\n` +
        `${node}::after { content: "${badge}"; position: absolute; top: -9px; right: -6px; z-index: 20; ` +
        `font-size: 9px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; ` +
        `padding: 1px 5px; border-radius: 4px; color: #fff; background: ${color}; pointer-events: none; }\n` +
        `${edge} { stroke: ${color} !important; stroke-width: 2px !important; }`
      );
    })
    .join('\n');

/**
 * How the canvas badges NEW/EDITED marks: a stylesheet under the container's
 * `AGENT_CHANGE_ATTRIBUTE`, a ring and a corner pill on each changed node or
 * edge (React Flow's own `data-id`, an element or a link id alike). `removed`
 * ids draw nothing: there is no node or edge left to badge.
 */
export const agentChangeStyle = (changes: AgentChanges): string | null => {
  if (changes.added.size === 0 && changes.edited.size === 0) return null;
  return [
    canvasRules(changes.added, ADDED_COLOR, 'NEW'),
    canvasRules(changes.edited, EDITED_COLOR, 'EDITED'),
  ]
    .filter(Boolean)
    .join('\n');
};
