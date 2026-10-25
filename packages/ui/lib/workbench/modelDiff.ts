/**
 * Diffs two models into the istar-ts operations that turn one into the other
 * (goal-controller#411): how SourceView and the mode/framework writes in
 * WorkbenchContext and ModelSettingsModal turn a text edit into dispatched
 * actions instead of a host-side `store.replace`.
 *
 * `null` means the difference isn't expressible yet: a kind change istar-ts
 * has no action for (an element's, or a link's into or out of a dependency
 * kind — `createEdge`'s `dependum` arg is more than a plain diff can set up
 * safely), or a change to a key istar-ts doesn't model at all (`model.extra`,
 * `diagram.extra`, an element's or link's `extra`, or the root `tool`,
 * `istar`, `saveDate`). The caller falls back to a host-side replace for
 * those; `applyTextThroughActions` does.
 */
import {
  FILE_METAMODEL_KEY,
  fileMetamodelOf,
  isDependencyLinkKind,
  type CustomProperties,
  type IstarElement,
  type IstarLink,
  type ModelStore,
} from '@istar-ts/core';
import type { ActionDispatcher, IstarOperation } from '@istar-ts/actions';
import type { AnyModel } from '@goal-controller/lib';
import { emptyModel, parseModel } from './dialects';
import { serializeModel } from './pistar';

type Ops = IstarOperation<string, string>[];

const sameJson = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** `model.extra`, minus the file metamodel block: that one's handled separately (`fileMetamodelOf`/`istar.setFileMetamodel`), but a model read with `fileMetamodel: true` keeps it in `extra` too. */
const otherExtra = (
  model: AnyModel,
): Readonly<Record<string, unknown>> | undefined => {
  if (!model.extra) return undefined;
  if (!(FILE_METAMODEL_KEY in model.extra)) return model.extra;
  const { [FILE_METAMODEL_KEY]: _metamodel, ...rest } = model.extra;
  return Object.keys(rest).length > 0 ? rest : undefined;
};

/** `{ key: value | null }`: value differs, null removes a key `before` had and `after` doesn't. */
const diffProperties = (
  before: CustomProperties | undefined,
  after: CustomProperties | undefined,
): Record<string, string | null> | undefined => {
  const from = before ?? {};
  const to = after ?? {};
  const patch: Record<string, string | null> = {};
  for (const key of Object.keys(from)) if (!(key in to)) patch[key] = null;
  for (const [key, value] of Object.entries(to))
    if (from[key] !== value) patch[key] = value;
  return Object.keys(patch).length > 0 ? patch : undefined;
};

/** Like `diffProperties`, but a removed key is `undefined` (`UpdateDisplayOperation`'s marker), and `exclude` skips keys handled elsewhere (`changeBounds`' width/height). */
const diffDisplay = (
  before: Readonly<Record<string, unknown>> | undefined,
  after: Readonly<Record<string, unknown>> | undefined,
  exclude: readonly string[],
): Record<string, unknown> | undefined => {
  const from = before ?? {};
  const to = after ?? {};
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(from))
    if (!exclude.includes(key) && !(key in to)) patch[key] = undefined;
  for (const [key, value] of Object.entries(to))
    if (!exclude.includes(key) && !sameJson(from[key], value))
      patch[key] = value;
  return Object.keys(patch).length > 0 ? patch : undefined;
};

const diffElement = (
  id: string,
  before: IstarElement<string>,
  after: IstarElement<string>,
): Ops | null => {
  if (before.extra || after.extra) return null;
  if (before.kind !== after.kind) return null;
  if (!!before.isDependum !== !!after.isDependum) return null;
  const ops: Ops = [];
  if (before.name !== after.name)
    ops.push({ kind: 'applyLabelEdit', labelId: id, text: after.name });
  // position only: width/height go through istar.updateDisplay below, whose
  // merge semantics (a key set to `undefined` is removed) can clear a size
  // ChangeBoundsOperation's newSize cannot
  if (before.x !== after.x || before.y !== after.y)
    ops.push({
      kind: 'changeBounds',
      newBounds: [{ elementId: id, newPosition: { x: after.x, y: after.y } }],
    });
  if ((before.parent ?? null) !== (after.parent ?? null))
    ops.push({
      kind: 'changeContainer',
      elementId: id,
      targetContainerId: after.parent ?? null,
      location: { x: after.x, y: after.y },
    });
  const properties = diffProperties(
    before.customProperties,
    after.customProperties,
  );
  if (properties)
    ops.push({ kind: 'istar.updateProperties', elementId: id, properties });
  const display = diffDisplay(before.display, after.display, []);
  if (display)
    ops.push({ kind: 'istar.updateDisplay', elementId: id, patch: display });
  return ops;
};

const diffLink = (
  id: string,
  before: IstarLink<string>,
  after: IstarLink<string>,
  changeKind: Map<string, string[]>,
): Ops | null => {
  if (before.extra || after.extra) return null;
  if (
    before.kind !== after.kind &&
    (isDependencyLinkKind(before.kind) || isDependencyLinkKind(after.kind))
  )
    return null;
  const ops: Ops = [];
  if (before.kind !== after.kind) {
    const group = changeKind.get(after.kind) ?? [];
    group.push(id);
    changeKind.set(after.kind, group);
  }
  if (before.source !== after.source || before.target !== after.target)
    ops.push({
      kind: 'reconnectEdge',
      edgeElementId: id,
      sourceElementId: after.source,
      targetElementId: after.target,
    });
  if ((before.name ?? '') !== (after.name ?? ''))
    ops.push({ kind: 'applyLabelEdit', labelId: id, text: after.name ?? '' });
  if ((before.label ?? null) !== (after.label ?? null))
    ops.push({
      kind: 'istar.setLinkValue',
      linkId: id,
      value: after.label ?? null,
    });
  const properties = diffProperties(
    before.customProperties,
    after.customProperties,
  );
  if (properties)
    ops.push({ kind: 'istar.updateProperties', elementId: id, properties });
  const display = diffDisplay(before.display, after.display, []);
  if (display)
    ops.push({ kind: 'istar.updateLinkDisplay', linkId: id, patch: display });
  return ops;
};

/**
 * The operations that turn `before` into `after`, as one list (the caller
 * wraps it in a `compound` when there is more than one); `null` when a
 * difference has no operation (see module doc); `[]` when the models are
 * otherwise identical (the caller still falls back, to keep the exact bytes
 * of a non-semantic text change: different indentation, key order, element
 * or link order).
 */
export const diffModels = (before: AnyModel, after: AnyModel): Ops | null => {
  if (!sameJson(otherExtra(before), otherExtra(after))) return null;
  if (!sameJson(before.diagram?.extra, after.diagram?.extra)) return null;
  // no action writes these root fields either
  if (
    before.tool !== after.tool ||
    before.istar !== after.istar ||
    before.saveDate !== after.saveDate
  )
    return null;

  const ops: Ops = [];

  const beforeBlock = fileMetamodelOf(before) ?? null;
  const afterBlock = fileMetamodelOf(after) ?? null;
  if (!sameJson(beforeBlock, afterBlock))
    ops.push({ kind: 'istar.setFileMetamodel', block: afterBlock });

  if (
    before.diagram?.name !== after.diagram?.name ||
    before.diagram?.width !== after.diagram?.width ||
    before.diagram?.height !== after.diagram?.height ||
    !sameJson(before.diagram?.customProperties, after.diagram?.customProperties)
  )
    ops.push({
      kind: 'istar.updateDiagram',
      diagram: {
        name: after.diagram?.name,
        width: after.diagram?.width,
        height: after.diagram?.height,
        customProperties: after.diagram?.customProperties,
      },
    });

  const removedIds: string[] = [];
  const created: Ops = [];
  const changed: Ops = [];

  for (const id of before.elements.keys())
    if (!after.elements.has(id)) removedIds.push(id);
  for (const [id, element] of after.elements) {
    if (element.extra) return null;
    const prior = before.elements.get(id);
    if (!prior) {
      if (element.isDependum) return null;
      created.push({
        kind: 'createNode',
        elementTypeId: element.kind,
        location: { x: element.x, y: element.y },
        containerId: element.parent,
        args: {
          id,
          name: element.name,
          customProperties: element.customProperties,
        },
      });
      continue;
    }
    const diff = diffElement(id, prior, element);
    if (diff === null) return null;
    changed.push(...diff);
  }

  const changeKind = new Map<string, string[]>();
  for (const id of before.links.keys())
    if (!after.links.has(id)) removedIds.push(id);
  for (const [id, link] of after.links) {
    if (link.extra) return null;
    const prior = before.links.get(id);
    if (!prior) {
      if (isDependencyLinkKind(link.kind)) return null;
      created.push({
        kind: 'createEdge',
        elementTypeId: link.kind,
        sourceElementId: link.source,
        targetElementId: link.target,
        args: {
          id,
          name: link.name,
          value: link.label,
          customProperties: link.customProperties,
        },
      });
      continue;
    }
    const diff = diffLink(id, prior, link, changeKind);
    if (diff === null) return null;
    changed.push(...diff);
  }

  if (removedIds.length > 0)
    ops.push({ kind: 'deleteElement', elementIds: removedIds });
  ops.push(...created, ...changed);
  for (const [elementTypeId, linkIds] of changeKind)
    ops.push({ kind: 'istar.changeLinkKind', linkIds, elementTypeId });

  return ops;
};

/**
 * Turns a text edit into one dispatched action against the live model:
 * parses `text`, diffs it against the store's model (`diffModels`), and
 * dispatches the difference as one operation, or one `compound` of several,
 * through `dispatcher`. Falls back to `fallback()` (the old host-side
 * replace) when the text doesn't parse, the diff can't express the
 * difference (`null`), there is no difference to dispatch (`[]`, which would
 * leave `text`'s exact bytes undelivered), the dispatch is rejected, or —
 * `diffModels` doesn't keep element and link order — applying it didn't
 * reproduce `text`'s exact bytes; that dispatch is undone first, so it
 * doesn't sit on the history as one more step the fallback's replace adds to.
 */
export const applyTextThroughActions = async (
  dispatcher: ActionDispatcher<string, string>,
  store: ModelStore<string, string>,
  text: string,
  fallback: () => void,
): Promise<void> => {
  let after: AnyModel;
  try {
    after = text.trim() ? parseModel(text) : emptyModel();
  } catch {
    fallback();
    return;
  }
  const ops = diffModels(store.getModel(), after);
  if (!ops || ops.length === 0) {
    fallback();
    return;
  }
  const [first, ...rest] = ops;
  const result = await dispatcher.dispatch(
    rest.length === 0 && first
      ? first
      : { kind: 'compound', operationList: ops },
  );
  if (!result.ok) {
    fallback();
    return;
  }
  if (serializeModel(store.getModel(), text) !== text) {
    await dispatcher.dispatch({ kind: 'glspUndo' });
    fallback();
  }
};
