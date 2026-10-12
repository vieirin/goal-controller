/**
 * What an engine makes of its project resources (goal-controller#25): each
 * kind its definition declares is parsed here, in the engine's library, into
 * data. Text in; out, the symbols completion reads (generic, by category),
 * the engine's own data (its checks' and templates'), and what is wrong with
 * the text, by position.
 */
import type {
  ProjectResourceKindOf,
  ResourceSymbol,
  ResourceSymbols,
} from '@goal-controller/dialect';

export type { ResourceSymbol, ResourceSymbols };

/** One file of a project resource (a `many` kind has several). */
export type ResourceFile = { path: string; text: string };

/** Something wrong in a resource's text: `from`/`to` are offsets in its file. */
export type ResourceDiagnostic = {
  path: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  from: number;
  to: number;
};

export type ParsedResource<T = unknown> = {
  symbols: ResourceSymbols;
  /** the engine's own reading: JSON data (it crosses to the language server) */
  data: T;
  diagnostics: ResourceDiagnostic[];
};

export type ProjectResourceParser<T = unknown> = (
  files: readonly ResourceFile[],
) => ParsedResource<T>;

/**
 * An engine's parsers, one per project-resource kind its definition
 * declares: a kind without one doesn't compile.
 */
export type ProjectResourceParsers<D> = {
  readonly [K in ProjectResourceKindOf<D>]: ProjectResourceParser;
};

/** Typed against the engine's definition: `projectResourceParsers(mutrose)({ world, … })`. */
export const projectResourceParsers =
  <D>(_definition: D) =>
  <P extends ProjectResourceParsers<D>>(parsers: P): P =>
    parsers;
