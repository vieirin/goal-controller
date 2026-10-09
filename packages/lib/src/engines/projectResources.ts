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

/** Where JSON.parse stopped, from its message (`at position 33`, `line 3 column 5`). */
const jsonErrorOffset = (text: string, message: string): number => {
  const position = /position (\d+)/.exec(message);
  if (position) return Number(position[1]);
  const lineColumn = /line (\d+) column (\d+)/.exec(message);
  if (lineColumn)
    return (
      text
        .split('\n')
        .slice(0, Number(lineColumn[1]) - 1)
        .reduce((sum, line) => sum + line.length + 1, 0) +
      Number(lineColumn[2]) -
      1
    );
  return 0;
};

/** A JSON resource's value (undefined when it isn't JSON, with why, where). */
export const readJson = (
  file: ResourceFile,
): { value: unknown; diagnostics: ResourceDiagnostic[] } => {
  try {
    return { value: JSON.parse(file.text), diagnostics: [] };
  } catch (error) {
    const message = (error as Error).message;
    const at = Math.min(jsonErrorOffset(file.text, message), file.text.length);
    return {
      value: undefined,
      diagnostics: [
        {
          path: file.path,
          severity: 'error',
          message: `Not valid JSON: ${message}`,
          from: Math.max(0, at - (at === file.text.length ? 1 : 0)),
          to: Math.min(file.text.length, at + 1),
        },
      ],
    };
  }
};

/** The offset of a key in a JSON text (its first `"key"`), to place a problem about its value. */
export const keyRange = (
  text: string,
  key: string,
): { from: number; to: number } => {
  const at = text.indexOf(JSON.stringify(key));
  return at < 0
    ? { from: 0, to: Math.min(1, text.length) }
    : { from: at, to: at + key.length + 2 };
};
