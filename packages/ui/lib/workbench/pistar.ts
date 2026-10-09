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
  toPistar,
  updateDiagram,
  updateElement,
  withFileMetamodel,
  type IstarElement,
  type IstarLink,
  type IstarModel,
  type LinkKind,
  type ToPistarOptions,
} from '@istar-ts/core';
// types only: the view is computed in services/tree.ts
import type { GoalViewNode } from '@goal-controller/goal-tree';
import {
  isEmptyModelExtension,
  withModelEntries,
  type ModelExtension,
} from '@goal-controller/dialect';
import type { TransformEngine } from '@/lib/types';
import {
  ENGINE_DIALECTS,
  ENGINE_LABEL,
  isDialectEngine,
} from './engineDialects';
import {
  DIALECT_LABEL,
  DIALECTS,
  isDialectMode,
  metamodelOfMode,
  MODE_PROPERTY,
  parseModel,
  type DialectMode,
} from './dialects';

/** How a node refines its children: AND/OR refinement (Needed-By is not one) */
export type Relation = 'and' | 'or';

/** A new, empty piStar model. */
export const EMPTY_PISTAR_MODEL = `${toPistar(createEmptyModel(), { saveDate: '' })}\n`;

// ---------------------------------------------------------------------------
// View tree
// ---------------------------------------------------------------------------

/** Colour family of a node chip: how a goal refines its children, or task. */
export const nodeTone = (
  node: GoalViewNode | undefined,
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

/** `mode`: read for it (a dialect a file does not record yet); default, what the file records. */
const rewrite = (
  text: string,
  edit: (model: IstarModel) => IstarModel,
  mode?: ModelMode,
): string => serializeModel(edit(parseModel(text, mode)), text);

/**
 * A dialect's model text with what the model adds (none: no block), written
 * through istar-ts (its kinds checked against the dialect's, the elements
 * using them kept) and the dialect (its groupers, stereotypes and tagged
 * values). Throws why it cannot be.
 */
export const writeModelExtension = (
  text: string,
  mode: DialectMode,
  model: ModelExtension,
): string =>
  rewrite(
    text,
    (read) => {
      withModelEntries(DIALECTS[mode], model);
      return withFileMetamodel(
        read,
        isEmptyModelExtension(model) ? null : model,
      ) as unknown as IstarModel;
    },
    mode,
  );

/** The element an edit is for (any kind: a dialect's, an actor). */
const findNode = (model: IstarModel, iStarId: string): IstarElement => {
  const node = model.elements.get(iStarId);
  if (!node) {
    throw new Error(`element ${iStarId} not found`);
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

/**
 * What a model is for: one of the engines, a modelling dialect (no engine), or free
 * iStar modelling in piStar mode.
 */
export type ModelMode = TransformEngine | DialectMode | 'pistar';

const MODES: readonly ModelMode[] = [
  'edgev2',
  'edge',
  'sleec',
  'mutrose',
  'pistarext',
  'pistar',
];

/** Whether a mode is an engine's (it generates): not piStar's nor a dialect's. */
export const isEngineMode = (mode: ModelMode): mode is TransformEngine =>
  mode !== 'pistar' && !isDialectMode(mode);

/**
 * The mode is kept in the diagram's custom properties (MODE_PROPERTY): piStar keeps them
 * when it opens and saves a file (and shows them as ordinary properties), so the file
 * stays a plain piStar model. A model without it is a piStar model: piStar mode is never
 * written.
 */
export { MODE_PROPERTY };

const isMode = (value: unknown): value is ModelMode =>
  MODES.includes(value as ModelMode);

/** The engine recorded in the model; null when there is none (a piStar model, or an older file). */
export const modelMode = (model: IstarModel): ModelMode | null => {
  const value = model.diagram?.customProperties?.[MODE_PROPERTY];
  return isMode(value) ? value : null;
};

export const readModelMode = (text: string): ModelMode | null => {
  try {
    return modelMode(parseModel(text));
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
  rewrite(
    text,
    (model) => withMode(model, mode),
    isDialectMode(mode) ? mode : undefined,
  );

const RT_ID = /^\s*([A-Za-z]+)(\d+)\s*:/;
const PREFIX: Partial<Record<IstarElement['kind'], string>> = {
  'istar.Goal': 'G',
  // the engines read qualities as goals
  'istar.Quality': 'G',
  'istar.Task': 'T',
  'istar.Resource': 'R',
};
const FIRST: Record<string, number> = { G: 0, T: 1, R: 1 };

/**
 * Next free RT id ("G4", "T3", "R2") for an element kind, from the names in
 * the model: with the Edge engines' prefix for the kind, or the one given (an
 * engine's definition's: MutRoSe's tasks are `AT3`).
 */
export const nextRtId = (
  model: IstarModel,
  kind: IstarElement['kind'],
  prefix: string | undefined = PREFIX[kind],
): string | null => {
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

/** What an engine reads of an iStar model: the kinds a model converted to it may have. */
type Reads = { elements: ReadonlySet<string>; links: ReadonlySet<string> };
const EDGE_READS: Reads = {
  elements: new Set([
    'istar.Actor',
    'istar.Goal',
    'istar.Task',
    'istar.Resource',
  ]),
  links: new Set([
    'istar.AndRefinementLink',
    'istar.OrRefinementLink',
    'istar.NeededByLink',
  ]),
};
const ENGINE_READS: Partial<Record<TransformEngine, Reads>> = {
  edge: EDGE_READS,
  edgev2: EDGE_READS,
  // the decomposer reads one actor's goals and tasks, refined by AND/OR links
  mutrose: {
    elements: new Set(['istar.Actor', 'istar.Goal', 'istar.Task']),
    links: new Set(['istar.AndRefinementLink', 'istar.OrRefinementLink']),
  },
};

/** The id prefix a target gives a kind: its definition's, else the Edge engines'. */
const prefixIn = (
  target: ModelMode,
  kind: IstarElement['kind'],
): string | undefined => {
  if (!isEngineMode(target) || !isDialectEngine(target)) return PREFIX[kind];
  const elements: Readonly<Record<string, { prefix?: string } | undefined>> =
    ENGINE_DIALECTS[target].elements;
  const key = kind.replace(/^istar\./, '').toLowerCase();
  return key === 'quality' ? elements.goal?.prefix : elements[key]?.prefix;
};
const KIND_LABEL = (kind: string): string =>
  kind.replace(/^[^.]+\./, '').replace(/Link$/, ' link');
const MODE_LABEL = (mode: ModelMode): string =>
  isDialectMode(mode)
    ? DIALECT_LABEL[mode]
    : mode === 'pistar'
      ? 'piStar'
      : mode === 'edge' || mode === 'edgev2'
        ? 'the Edge engines'
        : ENGINE_LABEL[mode];
/** What a target engine reads, as its messages say it ("the Edge engines read …"). */
const engineSays = (target: ModelMode) => {
  const many = target === 'edge' || target === 'edgev2';
  const name = MODE_LABEL(target);
  return {
    reads: `${name} ${many ? 'read' : 'reads'}`,
    doesNotRead: `${name} ${many ? 'do' : 'does'} not read`,
  };
};
const plural = (label: string): string =>
  label.endsWith('y') ? `${label.slice(0, -1)}ies` : `${label}s`;

/**
 * Converts a model to a mode: fixes what can be fixed safely (RT ids on unnamed elements;
 * a type for Edge resources that have none) and lists what cannot (element and link kinds
 * the engine does not read, a second actor). Whether the result is valid for the engine
 * is for the engine to say.
 */
export const planConversion = (text: string, target: ModelMode): Conversion => {
  let model = (() => {
    try {
      return parseModel(text);
    } catch (error) {
      // a model with a dialect's kinds not recorded yet: read for that dialect
      if (isDialectMode(target)) return parseModel(text, target);
      throw error;
    }
  })();
  const changes: string[] = [];
  const blockers: string[] = [];
  if (isEngineMode(target)) {
    // RT ids: every goal, task and resource name starts with one
    for (const element of model.elements.values()) {
      if (!isNode(element) || element.isDependum || RT_ID.test(element.name))
        continue;
      const id = nextRtId(model, element.kind, prefixIn(target, element.kind));
      if (!id) continue;
      const name = `${id}: ${element.name.trim() || KIND_LABEL(element.kind)}`;
      model = updateElement(model, element.id, { name });
      changes.push(
        `"${element.name.trim() || KIND_LABEL(element.kind)}" is named ${name}`,
      );
    }
  }
  const reads = isEngineMode(target) ? ENGINE_READS[target] : undefined;
  if (!reads) {
    // the kinds the target's metamodel doesn't have (a dialect's, in another mode)
    const known = metamodelOfMode(target, text);
    const counts = new Map<string, number>();
    for (const element of model.elements.values())
      if (!known.elements.has(element.kind))
        counts.set(element.kind, (counts.get(element.kind) ?? 0) + 1);
    for (const link of model.links.values())
      if (!known.links.has(link.kind))
        counts.set(link.kind, (counts.get(link.kind) ?? 0) + 1);
    for (const [kind, count] of counts) {
      const label = KIND_LABEL(kind);
      blockers.push(
        `${count} ${count > 1 ? plural(label) : label}: ${MODE_LABEL(target)} has no ${plural(label)}`,
      );
    }
  }
  if (reads) {
    const counts = new Map<string, number>();
    for (const element of model.elements.values()) {
      if (!reads.elements.has(element.kind))
        counts.set(element.kind, (counts.get(element.kind) ?? 0) + 1);
      if (isNode(element) && !element.isDependum && !element.parent) {
        blockers.push(
          `${element.name} is outside any actor: ${engineSays(target).reads} the elements inside the actor`,
        );
      }
      if (
        reads === EDGE_READS &&
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
      if (!reads.links.has(link.kind))
        counts.set(link.kind, (counts.get(link.kind) ?? 0) + 1);
    }
    for (const [kind, count] of counts) {
      const label = KIND_LABEL(kind);
      blockers.push(
        `${count} ${count > 1 ? plural(label) : label}: ${engineSays(target).doesNotRead} ${plural(label)}`,
      );
    }
    const actors = [...model.elements.values()].filter(isActor).length;
    if (actors > 1)
      blockers.push(
        `${actors} actors: ${engineSays(target).reads} a single actor`,
      );
  }
  return {
    text: serializeModel(withMode(model, target), text),
    changes,
    blockers,
  };
};
