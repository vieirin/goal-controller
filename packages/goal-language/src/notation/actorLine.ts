/**
 * An actor's properties in the goal language (goal-controller#109): a
 * property line with the key `actor` (ACTOR_LINE_KEY), its value the actor's
 * name in quotes (`#n` the n-th of several so named, in the model's order)
 * and one `{key = value}` per property:
 *
 *     actor "Patient" {importance = High} {importanceQuantitative = 50}
 *     G1: Deliver the medicine
 *
 * The Notation view writes every actor line at the top of the document; a
 * line names its actor wherever it is. It is a property line as the grammar
 * already reads it; a document without ids reads a line starting `actor "`
 * as one (`isPlainActorLine`). Its value is read as a link line's
 * (`readLinkLine`), its name resolved as a link's quoted target
 * (`targetKey`).
 */
import {
  ACTOR_LINE_KEY,
  actorPropertiesOf,
  type AnyDialect,
  type DocumentActor,
} from '@goal-controller/dialect';
import { propertyLine } from '../print.js';
import {
  isWritableLinkValue,
  quotedTarget,
  readLinkLine,
  type LinkLineReading,
} from './linkLine.js';

export { ACTOR_LINE_KEY };

/** An actor line's value, read: the actor as written (quoted) and its properties. */
export type ActorLineReading = LinkLineReading;

/** Reads an actor line's value; an error says where it stops reading. */
export const readActorLine = (
  value: string,
):
  | { value: ActorLineReading }
  | { error: { message: string; from: number; to: number } } => {
  if (!value.startsWith('"'))
    return {
      error: {
        message:
          'An actor line names its actor by its name, in quotes: actor "Name" {key = value}',
        from: 0,
        to: value.length,
      },
    };
  const read = readLinkLine(value);
  return 'error' in read && read.error.from === 0
    ? {
        error: {
          ...read.error,
          message:
            'An actor line names its actor by its name, in quotes: actor "Name" {key = value}',
        },
      }
    : read;
};

/** The actors' ids by their names, each list in the model's order (what an actor line names one by). */
export const actorNames = (
  actors: readonly Pick<DocumentActor, 'iStarId' | 'name'>[],
): Record<string, string[]> => {
  // no inherited keys: an actor may be named `constructor`
  const names: Record<string, string[]> = Object.create(null);
  for (const { iStarId, name } of actors)
    (names[name.trim()] ??= []).push(iStarId);
  return names;
};

/** The declared properties an actor has that a line can carry, in the declaration's order. */
const writableProperties = (
  definition: Pick<AnyDialect, 'actors'>,
  actor: Pick<DocumentActor, 'kind' | 'properties'>,
) =>
  actorPropertiesOf(definition, actor.kind).filter(({ key }) => {
    const value = actor.properties[key];
    return value !== undefined && isWritableLinkValue(value);
  });

/** Whether an actor has a line: the dialect gives actors properties, and some writable ones are set. */
export const hasActorLine = (
  definition: Pick<AnyDialect, 'actors'>,
  actor: Pick<DocumentActor, 'kind' | 'properties'>,
): boolean => writableProperties(definition, actor).length > 0;

/** An actor line, written: `actor "Ann" {importance = 50}`, `#n` when others share its name. */
export const actorLine = (
  definition: Pick<AnyDialect, 'actors'>,
  actor: Pick<DocumentActor, 'iStarId' | 'kind' | 'name' | 'properties'>,
  names: Readonly<Record<string, readonly string[]>>,
): string => {
  const same = names[actor.name.trim()] ?? [];
  const ordinal = same.length > 1 ? same.indexOf(actor.iStarId) + 1 : undefined;
  return propertyLine(
    ACTOR_LINE_KEY,
    [
      quotedTarget(actor.name.trim(), ordinal),
      ...writableProperties(definition, actor).map(
        ({ key }) => `{${key} = ${actor.properties[key]}}`,
      ),
    ].join(' '),
  );
};
