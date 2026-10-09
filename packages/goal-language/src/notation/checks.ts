/**
 * What an engine's named check is given: the element's properties, and a
 * context with the element, the kinds of the others, and the model itself
 * when the caller has it. The definition names checks; the engine library
 * implements them; the editors, the language server and the engine's mapper
 * run them with this.
 */
import type { DefinitionContext } from '@goal-controller/dialect';

/** The kinds a check tells apart (a quality is a goal to no check). */
export type CheckKind = 'goal' | 'task' | 'resource';

export type CheckContext = {
  /** the element's RT id */
  self: string;
  /** another element's kind, if the model has it */
  kindOf: (id: string) => CheckKind | undefined;
  /**
   * The whole model, when the caller has it (an editor, the language
   * server): every element by RT id, with its kind, properties, children
   * and diagram position. A check that walks it (a variable declared by an
   * earlier goal) says nothing without it; the engine's template checks the
   * model as a whole.
   */
  elements?: DefinitionContext['elements'];
  /**
   * The project's resources, parsed, by kind, when the model has them (a
   * MutRoSe world): each with its symbols and the engine's own data, which
   * only the engine's checks read. Without them a check says nothing about
   * what they would tell.
   */
  projectResources?: DefinitionContext['projectResources'];
};

/** An engine's named check: what is wrong with the element's value, or null. */
export type NamedCheck = (
  properties: Readonly<Record<string, string>>,
  context: CheckContext,
) => string | null;

/** A check's context in a model (the editors' and the language server's). */
export const checkContextOf = (
  model: DefinitionContext,
  self: string,
): CheckContext => ({
  self,
  kindOf: (id) => {
    const kind = model.elements[id]?.kind;
    return kind === 'goal' || kind === 'task' || kind === 'resource'
      ? kind
      : undefined;
  },
  elements: model.elements,
  ...(model.projectResources && { projectResources: model.projectResources }),
});
