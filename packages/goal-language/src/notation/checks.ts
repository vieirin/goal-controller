/**
 * What an engine's named check is given (goal-controller#222): what a
 * mapper is given, the record of the element (or actor, or link) the
 * checked property is on, read against the dialect once (`props`, typed;
 * `raw`, as written; `kind`, what it is), and a context with the element,
 * the kinds of the others, and the model itself when the caller has it. The
 * definition names checks; the engine library implements them; the editors,
 * the language server and the engine's mapper run them with this.
 */
import { istarKindOf, type DefinitionContext } from '@goal-controller/dialect';
import {
  readProperties,
  type OwnerPropertiesOf,
  type PropertyDialect,
  type PropertyList,
  type PropertyOwner,
  type PropertyTexts,
  type PropertyValues,
} from './properties.js';

export type CheckContext = {
  /** the element's RT id */
  self: string;
  /**
   * Another element's kind, if the model has it: the dialect's, as an iStar
   * kind (`istar.Goal`, `istar.Quality`) or a framework's or an extension's
   * own (`kaos.Agent`).
   */
  kindOf: (id: string) => string | undefined;
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
  /**
   * A link by its piStar id (goal-controller#107): its kind, ends, label and
   * properties, in a dialect that gives links properties; a link property's
   * check gets the link's id as `self`.
   */
  readLink?: (
    linkId: string,
  ) => NonNullable<DefinitionContext['links']>[string] | undefined;
  /**
   * An element by its key, whatever its kind (an extension's too, its
   * properties declared by its kind: goal-controller#132), when the caller
   * has the model; a property's check gets its element's key as `self`.
   */
  readElement?: (
    key: string,
  ) => DefinitionContext['elements'][string] | undefined;
  /** An actor by its piStar id (goal-controller#107), in a dialect that gives actors properties. */
  readActor?: (
    actorId: string,
  ) => NonNullable<DefinitionContext['actors']>[string] | undefined;
};

/**
 * What a check is given of the element (or actor, or link) its property is
 * on: its properties as the dialect reads them (`readProperties`: a value
 * unset, or written with an error, is absent), as written, and its kind (an
 * element's as `kindOf` answers it, `istar.Goal`; an actor's or a link's).
 */
export type CheckInput<L extends PropertyList = PropertyList> = {
  props: PropertyValues<L>;
  raw: PropertyTexts<L>;
  kind: string;
};

/** A check's input, whatever the properties: what the checker builds. */
export type AnyCheckInput = {
  props: Readonly<Record<string, unknown>>;
  raw: Readonly<Record<string, string | undefined>>;
  kind: string;
};

/**
 * An engine's named check: what is wrong with the element's value, or null.
 * (A method's parameter, so that a check typed by its dialect's properties,
 * `CheckInput<L>`, is one.)
 */
export type NamedCheck = {
  check(input: AnyCheckInput, context: CheckContext): string | null;
}['check'];

/**
 * The input of the checks on an element's (`{ element: 'goal' }`), an
 * actor's or a link's properties: its stored strings read against the
 * dialect once, for every check on it. Typed by that owner's properties
 * (goal-controller#222); assignable to `AnyCheckInput` for a registry.
 */
export const checkInputOf = <
  const D extends PropertyDialect,
  const O extends PropertyOwner,
>(
  definition: D,
  owner: O,
  stored: Readonly<Record<string, string | undefined>>,
): CheckInput<OwnerPropertiesOf<D, O>> => {
  const { values, text } = readProperties(definition, owner, stored);
  return {
    props: values,
    raw: text,
    kind:
      'element' in owner
        ? istarKindOf(owner.element)
        : 'actor' in owner
          ? owner.actor
          : owner.link,
  };
};

/**
 * Whether a key's value reads as its type (unset reads): a check is run on a
 * key only then, so it never sees its own key unset for a value written; the
 * dialect's value check says what is wrong with one that doesn't.
 */
export const parses = (input: AnyCheckInput, key: string): boolean =>
  !(key in input.raw) || key in input.props;

/** A check's context in a model (the editors' and the language server's). */
export const checkContextOf = (
  model: DefinitionContext,
  self: string,
): CheckContext => ({
  self,
  kindOf: (id) => {
    const kind = model.elements[id]?.kind;
    return kind === undefined ? undefined : istarKindOf(kind);
  },
  elements: model.elements,
  readElement: (key) => model.elements[key],
  ...(model.projectResources && { projectResources: model.projectResources }),
  ...(model.links && { readLink: (id: string) => model.links?.[id] }),
  ...(model.actors && { readActor: (id: string) => model.actors?.[id] }),
});
