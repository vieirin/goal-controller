/**
 * What an importer returns (packages/dialect/docs/importers.md): the piStar
 * model, what its dialect needs beside it, and what was read differently or
 * left out.
 */

export type ImportDiagnostic = {
  severity: 'error' | 'warning' | 'info';
  message: string;
};

/** What a model's dialect needs beside the model: its engine, its resources' files and its options. */
export type DialectRecord = {
  /** the engine the model records (`diagram.customProperties.engine`) */
  engine: string;
  /** each project resource kind's files, by path in the project */
  projectResources: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** the engine's options the source sets (a project's manifest keeps them) */
  options?: Readonly<Record<string, boolean | number | string>>;
};

export type ImportResult =
  | {
      /** the piStar file, as JSON (its text: `JSON.stringify(model, null, 2)`) */
      model: Record<string, unknown>;
      dialectRecord: DialectRecord;
      diagnostics: ImportDiagnostic[];
    }
  | { model: null; dialectRecord: null; diagnostics: ImportDiagnostic[] };
