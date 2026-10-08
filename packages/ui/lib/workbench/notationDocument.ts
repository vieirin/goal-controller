/**
 * The Notation view's document for a model: the definition-driven document
 * (@goal-controller/definitions), its edits applied to the piStar text, the
 * element a line belongs to, and the context the text is checked against.
 */
import type { GoalView } from '@goal-controller/goal-tree';
import {
  contextFromView,
  lineId,
  nodeLine,
  type EngineDefinition,
  type NotationEdit,
} from '@goal-controller/definitions';
import type { SavedLines } from './languageSupport';
import { setNodeProperty, setNodeText } from './pistar';

export {
  contextFromView,
  notationDocument,
  notationEdits,
  type NotationEdit,
} from '@goal-controller/definitions';

/** The model text with a document's edits made (texts, then properties, in order). */
export const applyNotationEdits = (
  text: string,
  edits: readonly NotationEdit[],
): string =>
  edits.reduce(
    (model, edit) =>
      'key' in edit
        ? setNodeProperty(model, edit.iStarId, edit.key, edit.value)
        : setNodeText(model, edit.iStarId, edit.text),
    text,
  );

/** The id of the element a line belongs to: its own, or the element line above it. */
export const elementOfLine = (
  definition: EngineDefinition,
  lines: readonly string[],
  index: number,
): string | null => {
  for (let i = index; i >= 0; i--) {
    const id = lineId(definition, lines[i] ?? '');
    if (id) return id;
  }
  return null;
};

/** The workbench's context variables' names (what an assertion may read besides resources). */
export const contextOf = (
  definition: EngineDefinition,
  tree: GoalView,
  variables: ReadonlyArray<{ kind: string; name: string }>,
) =>
  contextFromView(
    definition,
    tree,
    variables.filter((v) => v.kind === 'context').map((v) => v.name),
  );

/** What the engine's grammar said of each saved element line. */
export const savedLines = (
  definition: EngineDefinition,
  tree: GoalView,
): SavedLines =>
  Object.fromEntries(
    [...tree.nodes.values()].map((node) => [
      node.id,
      { line: nodeLine(definition, node), error: node.notationError },
    ]),
  );
