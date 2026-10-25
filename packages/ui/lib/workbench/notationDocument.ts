/**
 * The Notation view's document for a model: the definition-driven document
 * (@goal-controller/goal-language), its edits applied to the piStar text, the
 * element a line belongs to, and the context the text is checked against.
 */
import type { GoalView } from '@goal-controller/goal-tree';
import type {
  DefinitionContext,
  DialectDefinition,
} from '@goal-controller/dialect';
import {
  contextFromView,
  lineId,
  lineScope,
  nodeLine,
  type NotationEdit,
} from '@goal-controller/goal-language';
import type { IstarOperation } from '@istar-ts/actions';
import type { SavedLines } from './languageSupport';
import { setLinkProperty, setNodeProperty, setNodeText } from './pistar';

export {
  contextFromView,
  notationDocument,
  notationEdits,
  type NotationEdit,
} from '@goal-controller/goal-language';

/**
 * The model text with a document's edits made (texts, then properties, in
 * order). Non-UI callers only (goal-controller#411): tests under
 * packages/lib and the pool document's own text output. The live editors
 * dispatch `notationEditOperations` instead.
 */
export const applyNotationEdits = (
  text: string,
  edits: readonly NotationEdit[],
): string =>
  edits.reduce(
    (model, edit) =>
      'link' in edit
        ? setLinkProperty(model, edit.link, edit.key, edit.value)
        : // an actor's properties are its element's (goal-controller#109)
          'actor' in edit
          ? setNodeProperty(model, edit.actor, edit.key, edit.value)
          : 'key' in edit
            ? setNodeProperty(model, edit.iStarId, edit.key, edit.value)
            : setNodeText(model, edit.iStarId, edit.text),
    text,
  );

/**
 * A document's edits as operations against the live model (goal-controller#411):
 * an element's or actor's text, an `applyLabelEdit`; a property (an
 * element's, an actor's or a link's) an `istar.updateProperties`. One user
 * edit's operations go as one `compound` (`useEditModel`), so it is one
 * undo step.
 */
export const notationEditOperations = (
  edits: readonly NotationEdit[],
): IstarOperation<string, string>[] =>
  edits.map((edit) =>
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
          : { kind: 'applyLabelEdit', labelId: edit.iStarId, text: edit.text },
  );

/** The id of the element a line belongs to: its own, or the element line above it. */
/**
 * Each line's element key, null on a line that names none: its id, or, for a
 * repeated scoped id (`idScope: 'ancestorGoal'`), the element's under the goal
 * above it (`has` says which keys the model has).
 */
export const lineKeys = (
  definition: DialectDefinition,
  lines: readonly string[],
  has: (key: string) => boolean = () => false,
): (string | null)[] => {
  const scope = lineScope(definition);
  return lines.map((written) => {
    const id = lineId(definition, written);
    if (!id) return null;
    const indent = written.length - written.trimStart().length;
    return scope.keyOf(scope.enter(indent, id), id, has);
  });
};

export const elementOfLine = (
  definition: DialectDefinition,
  lines: readonly string[],
  index: number,
  has?: (key: string) => boolean,
): string | null =>
  lineKeys(definition, lines.slice(0, index + 1), has)
    .filter((key): key is string => key !== null)
    .at(-1) ?? null;

/**
 * What the language checks a model against: its elements, the workbench's
 * context variables' names (what an assertion may read besides resources),
 * and the project's resources, parsed (a MutRoSe world), when it has them.
 */
export const contextOf = (
  definition: DialectDefinition,
  tree: GoalView,
  variables: ReadonlyArray<{ kind: string; name: string }>,
  projectResources?: DefinitionContext['projectResources'],
): DefinitionContext => ({
  ...contextFromView(
    definition,
    tree,
    variables.filter((v) => v.kind === 'context').map((v) => v.name),
  ),
  ...(projectResources &&
    Object.keys(projectResources).length > 0 && { projectResources }),
});

/** What the engine's grammar said of each saved element line. */
export const savedLines = (
  definition: DialectDefinition,
  tree: GoalView,
): SavedLines =>
  Object.fromEntries(
    [...tree.nodes.entries()].map(([key, node]) => [
      key,
      { line: nodeLine(definition, node), error: node.notationError },
    ]),
  );
