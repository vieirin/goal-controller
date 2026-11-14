/**
 * The Notation view's document for a model: the definition-driven document
 * (@goal-controller/goal-language), its edits applied to the piStar text or
 * dispatched against the live model, the element a line belongs to.
 */
import {
  hasIds,
  type DefinitionContext,
  type DialectDefinition,
  type DocumentTree,
} from '@goal-controller/dialect';
import {
  identifiedOfContext,
  lineId,
  lineIdentities,
  lineScope,
  readHead,
  readLine,
  type CreatedElement,
  type Identified,
  type NotationEdit,
} from '@goal-controller/goal-language';
import type { AnyModel } from '@goal-controller/lib';
import type { IstarOperation } from '@istar-ts/actions';
import {
  addElement,
  elementKindDefinition,
  fileMetamodelOf,
  isActorKindIn,
  metamodelOf,
  suggestPosition,
  toPistarObject,
  type PistarElementJson,
  type PistarFile,
  type Point,
  type Size,
} from '@istar-ts/core';
import { parseModel } from './dialects';
import {
  serializeModel,
  setLinkProperty,
  setNodeProperty,
  setNodeText,
} from './pistar';

export {
  contextFromView,
  notationDocument,
  notationEdits,
  type NotationEdit,
} from '@goal-controller/goal-language';

/** An edit of an element that is in the model: its text or a property. */
type ElementEdit = Exclude<
  NotationEdit,
  { create: unknown } | { remove: unknown }
>;

const isElementEdit = (edit: NotationEdit): edit is ElementEdit =>
  !('create' in edit) && !('remove' in edit);

/**
 * The model's piStar file without `removed` (goal-controller#518): every
 * link kept, one whose end is gone an orphan (`parsePistar` reads it, and
 * the document reports it); an inner element of a removed actor that stays
 * goes on the paper; the file's metamodel block, extra keys and layout as
 * the model has them.
 */
export const withoutElements = (
  model: AnyModel,
  removed: ReadonlySet<string>,
): PistarFile => {
  const file = toPistarObject(model);
  const kept = (element: { id: string }) => !removed.has(element.id);
  const freed: PistarElementJson[] = [];
  const actors = file.actors.filter((actor) => {
    if (kept(actor)) return true;
    freed.push(...actor.nodes.filter(kept));
    return false;
  });
  return {
    ...file,
    actors: actors.map((actor) => ({
      ...actor,
      nodes: actor.nodes.filter(kept),
    })),
    ...(file.orphans && {
      orphans: [...file.orphans.filter(kept), ...freed],
    }),
    ...(!file.orphans && freed.length > 0 && { orphans: freed }),
    ...(file.dependencies && {
      dependencies: file.dependencies.filter(kept),
    }),
    ...(file.display && {
      display: Object.fromEntries(
        Object.entries(file.display).filter(([id]) => !removed.has(id)),
      ),
    }),
  };
};

/** The metamodel's size of a kind (`suggestPosition` reads it so, as `actorBounds` does). */
const sizeOf =
  (model: AnyModel) =>
  (kind: string): Size =>
    elementKindDefinition(metamodelOf(model), kind)?.size ?? {
      width: 0,
      height: 0,
    };

/** Where an element a line creates goes: its actor, and a free spot in it (or on the paper). */
type Placement = { containerId?: string; location: Point };

/**
 * A created element's place (goal-controller#518): in the actor of the
 * element whose line is above its line (that element itself when it is an
 * actor), on the paper when none is, or that one is on the paper; a kind
 * that cannot be on the paper goes in the model's first actor instead. An
 * actor is never in one. Its spot is `suggestPosition`'s (deterministic,
 * overlapping nothing in `model`).
 */
const placementOf = (
  model: AnyModel,
  tree: DocumentTree | null,
  create: CreatedElement,
): Placement => {
  const metamodel = metamodelOf(model);
  const isActor = (kind: string) => isActorKindIn(metamodel, kind);
  const above =
    create.after === null
      ? undefined
      : model.elements.get(
          tree?.nodes.get(create.after)?.iStarId ?? create.after,
        );
  const actorOf = (element: typeof above) =>
    !element
      ? undefined
      : isActor(element.kind)
        ? element.id
        : element.parent !== undefined && model.elements.has(element.parent)
          ? element.parent
          : undefined;
  const canBeOnPaper = !!elementKindDefinition(metamodel, create.kind)?.info
    ?.canBeOnPaper;
  const containerId = isActor(create.kind)
    ? undefined
    : (actorOf(above) ??
      (canBeOnPaper
        ? undefined
        : [...model.elements.values()].find((e) => isActor(e.kind))?.id));
  return {
    ...(containerId !== undefined && { containerId }),
    location: suggestPosition(model, {
      kind: create.kind,
      ...(containerId !== undefined && { containerId }),
      defaultSizeOf: sizeOf(model),
    }),
  };
};

/**
 * Each created element's placement, in order: each one's spot leaves the
 * ones before it theirs (they are added to the model it is placed in).
 */
const placements = (
  model: AnyModel,
  tree: DocumentTree | null,
  creates: readonly CreatedElement[],
): Placement[] =>
  creates.map((create) => {
    const placement = placementOf(model, tree, create);
    try {
      model = addElement(model, {
        kind: create.kind,
        id: create.iStarId,
        name: create.text,
        x: placement.location.x,
        y: placement.location.y,
        ...(placement.containerId !== undefined && {
          parent: placement.containerId,
        }),
      }).model;
    } catch {
      // placed where it is: the dispatcher is the one to refuse it
    }
    return placement;
  });

const createsOf = (edits: readonly NotationEdit[]): CreatedElement[] =>
  edits.flatMap((edit) => ('create' in edit ? [edit.create] : []));

const removedOf = (edits: readonly NotationEdit[]): Set<string> =>
  new Set(edits.flatMap((edit) => ('remove' in edit ? [edit.remove] : [])));

/** An element or property edit made in a model's text. */
const applyElementEdit = (text: string, edit: ElementEdit): string =>
  'link' in edit
    ? setLinkProperty(text, edit.link, edit.key, edit.value)
    : // an actor's properties are its element's (goal-controller#109)
      'actor' in edit
      ? setNodeProperty(text, edit.actor, edit.key, edit.value)
      : 'key' in edit
        ? setNodeProperty(text, edit.iStarId, edit.key, edit.value)
        : setNodeText(text, edit.iStarId, edit.text);

/**
 * The model text with a document's edits made: the elements whose lines
 * are gone removed (their links kept), texts and properties set in order,
 * the elements new lines add created (`tree`: the one the document was read
 * against, which `after` keys name). Non-UI callers only
 * (goal-controller#411): tests under packages/lib and the pool document's
 * own text output. The live editors dispatch `notationEditOperations`
 * instead.
 */
export const applyNotationEdits = (
  text: string,
  edits: readonly NotationEdit[],
  tree: DocumentTree | null = null,
): string => {
  const removed = removedOf(edits);
  let next = text;
  if (removed.size) {
    const file = withoutElements(parseModel(next), removed);
    next = serializeModel(parseModel(JSON.stringify(file)), next);
  }
  next = edits.filter(isElementEdit).reduce(applyElementEdit, next);
  const creates = createsOf(edits);
  if (!creates.length) return next;
  let model = parseModel(next);
  const placed = placements(model, tree, creates);
  creates.forEach((create, i) => {
    const { containerId, location } = placed[i]!;
    model = addElement(model, {
      kind: create.kind,
      id: create.iStarId,
      name: create.text,
      x: location.x,
      y: location.y,
      ...(containerId !== undefined && { parent: containerId }),
      ...(Object.keys(create.properties).length > 0 && {
        customProperties: { ...create.properties },
      }),
    }).model;
  });
  return serializeModel(model, next);
};

/** One element or property edit as an operation. */
const elementOperation = (edit: ElementEdit): IstarOperation<string, string> =>
  'link' in edit
    ? {
        kind: 'istar.updateProperties',
        elementId: edit.link,
        properties: { [edit.key]: edit.value },
      }
    : // an actor's properties are its element's (goal-controller#109)
      'actor' in edit
      ? {
          kind: 'istar.updateProperties',
          elementId: edit.actor,
          properties: { [edit.key]: edit.value },
        }
      : 'key' in edit
        ? {
            kind: 'istar.updateProperties',
            elementId: edit.iStarId,
            properties: { [edit.key]: edit.value },
          }
        : { kind: 'applyLabelEdit', labelId: edit.iStarId, text: edit.text };

/** What a create or remove edit is dispatched against: the live model, and the tree the document was read against. */
export type NotationEditTarget = {
  model: AnyModel;
  tree: DocumentTree | null;
};

/**
 * A document's edits as operations against the live model (goal-controller#411):
 * an element's or actor's text, an `applyLabelEdit`; a property (an
 * element's, an actor's or a link's) an `istar.updateProperties`. The
 * elements whose lines are gone go first, as one `istar.replaceModel` of
 * the model without them (`deleteElement` would take their links too: they
 * stay, as orphans, goal-controller#518); an element a new line adds is a
 * `createNode` last, with its id, name and properties, in its place
 * (`placementOf`). One user edit's operations go as one `compound`
 * (`useEditModel`), so it is one undo step. `target`: required when the
 * edits create or remove an element.
 */
export const notationEditOperations = (
  edits: readonly NotationEdit[],
  target?: NotationEditTarget,
): IstarOperation<string, string>[] => {
  const removed = removedOf(edits);
  const creates = createsOf(edits);
  if ((removed.size || creates.length) && !target)
    throw new Error('creating or removing an element needs the live model');
  const operations: IstarOperation<string, string>[] = [];
  if (removed.size && target)
    operations.push({
      kind: 'istar.replaceModel',
      model: withoutElements(target.model, removed),
      fileMetamodel: fileMetamodelOf(target.model) !== undefined,
    });
  operations.push(...edits.filter(isElementEdit).map(elementOperation));
  if (creates.length && target) {
    const placed = placements(target.model, target.tree, creates);
    creates.forEach((create, i) => {
      const { containerId, location } = placed[i]!;
      operations.push({
        kind: 'createNode',
        elementTypeId: create.kind,
        ...(containerId !== undefined && { containerId }),
        location,
        args: {
          id: create.iStarId,
          name: create.text,
          ...(Object.keys(create.properties).length > 0 && {
            customProperties: { ...create.properties },
          }),
        },
      });
    });
  }
  return operations;
};

/**
 * The ids an editor writes on the lines that created their elements without
 * one (goal-controller#518, `create.writeId`): `writeId: ` before the
 * line's name (`goal Deliver` → `goal 7857cb00: Deliver`), so the line names
 * its element from now on, and typing on renames it rather than creating
 * another. `read`: the text the edits were read from; `now`: the editor's
 * (typed on since, maybe): each line is found in it as it was, the nearest
 * to where it was; one changed since gets none.
 */
export const writtenIdChanges = (
  definition: DialectDefinition,
  read: string,
  now: string,
  edits: readonly NotationEdit[],
): { from: number; insert: string }[] => {
  const was = read.split('\n');
  const lines = now.split('\n');
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  const taken = new Set<number>();
  const changes: { from: number; insert: string }[] = [];
  for (const { writeId, line } of createsOf(edits)) {
    const text = was[line];
    if (writeId === null || text === undefined) continue;
    const at = lines
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate, index }) => candidate === text && !taken.has(index))
      .sort(
        (a, b) => Math.abs(a.index - line) - Math.abs(b.index - line),
      )[0]?.index;
    const head = readHead(definition, text);
    if (at === undefined || !head || head.id !== null) continue;
    taken.add(at);
    const gap = /^[ \t]*/.exec(text.slice(head.wordSpan.to))![0].length;
    changes.push(
      gap > 0
        ? {
            from: starts[at]! + head.wordSpan.to + gap,
            insert: `${writeId}: `,
          }
        : { from: starts[at]! + head.wordSpan.to, insert: ` ${writeId}: ` },
    );
  }
  return changes.sort((a, b) => a.from - b.from);
};

/**
 * The elements a document's lines may name: a tree's or a context's (by
 * key, with their ids), or only whether a key is one (written ids alone).
 */
export type LineElements =
  | DocumentTree
  | Pick<DefinitionContext, 'elements'>
  | ((key: string) => boolean);

const identifiedOf = (
  elements: Exclude<LineElements, (key: string) => boolean>,
): Identified[] =>
  'nodes' in elements
    ? [...elements.nodes].map(([key, node]) => ({
        key,
        id: node.id,
        iStarId: node.iStarId,
        ...(node.hasId !== undefined && { hasId: node.hasId }),
      }))
    : identifiedOfContext(elements);

/** Each line: whether it is an element line, and the key of the element it names (null: none). */
const lineReadings = (
  definition: DialectDefinition,
  lines: readonly string[],
  elements: LineElements,
): { element: boolean; key: string | null }[] => {
  if (typeof elements === 'function') {
    const scope = lineScope(definition);
    return lines.map((written) => {
      const id = lineId(definition, written);
      if (!id) return { element: false, key: null };
      const indent = written.length - written.trimStart().length;
      return {
        element: true,
        key: scope.keyOf(scope.enter(indent, id), id, elements),
      };
    });
  }
  const identities = lineIdentities(definition, identifiedOf(elements));
  return lines.map((written) => {
    const read = readLine(definition, written);
    // an element line: a word or an id starts it (as notationEdits reads it)
    if (
      read.kind !== 'element' ||
      !(read.word || read.id !== null || !hasIds(definition))
    )
      return { element: false, key: null };
    const indent = written.length - written.trimStart().length;
    const identity = identities.resolve(indent, read.id);
    return {
      element: true,
      key: identity && 'key' in identity ? identity.key : null,
    };
  });
};

/**
 * Each line's element key, null on a line that names none: the element its
 * id names (goal-controller#518: a written id, or the first characters of
 * the piStar id of an element without one; never the line's position), a
 * repeated scoped id's (`idScope: 'ancestorGoal'`) under the goal above it.
 * Given only whether a key is an element's, a line names it by its written
 * id.
 */
export const lineKeys = (
  definition: DialectDefinition,
  lines: readonly string[],
  elements: LineElements = () => false,
): (string | null)[] =>
  lineReadings(definition, lines, elements).map(({ key }) => key);

/**
 * Each line's element: the one it names, or the one the element line above
 * it names (null: none, or a line that names none, a new one, is above it).
 */
export const lineOwners = (
  definition: DialectDefinition,
  lines: readonly string[],
  elements: LineElements = () => false,
): (string | null)[] => {
  let owner: string | null = null;
  return lineReadings(definition, lines, elements).map(({ element, key }) =>
    element ? (owner = key) : owner,
  );
};

/** The key of the element a line belongs to: its own, or the element line's above it. */
export const elementOfLine = (
  definition: DialectDefinition,
  lines: readonly string[],
  index: number,
  elements?: LineElements,
): string | null =>
  lineOwners(definition, lines.slice(0, index + 1), elements)[index] ?? null;
