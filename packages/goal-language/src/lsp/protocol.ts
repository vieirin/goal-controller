/**
 * What a goal language server and its client agree on, besides LSP (no
 * parser here: the client imports it from `/light`).
 *
 * - `goal/context` tells the server which dialect a document is written in
 *   and what model it is checked against. Without one, the server reports
 *   syntax errors only. It may carry the engine's errors on the saved lines.
 * - An inspector field is a document of its own: `file:///fields/<id>/<key>.goal`,
 *   read with the property's value type.
 */
import type { AnyDialect, DefinitionContext } from '@goal-controller/dialect';

export const GOAL_CONTEXT_NOTIFICATION = 'goal/context';

export type GoalContextParams = {
  /** the document it is for; without one, every document without its own */
  uri?: string;
  /** the dialect, as data (its definition) */
  dialect: AnyDialect;
  /** the model's elements and the workbench's variables */
  context: DefinitionContext;
  /**
   * What the engine's grammar said of each saved element line, by id: its
   * error is shown while the line still reads as saved
   */
  saved?: Readonly<Record<string, { line: string; error: string | null }>>;
};

/** An inspector field's document: one element's property value. */
export const fieldUri = (id: string, key: string): string =>
  `file:///fields/${encodeURIComponent(id)}/${encodeURIComponent(key)}.goal`;

/** The element and key of a field's document, if the URI is one. */
export const readFieldUri = (
  uri: string,
): { id: string; key: string } | null => {
  const match = /\/fields\/([^/]+)\/([^/]+)\.goal$/.exec(uri);
  return match
    ? {
        id: decodeURIComponent(match[1]!),
        key: decodeURIComponent(match[2]!),
      }
    : null;
};
