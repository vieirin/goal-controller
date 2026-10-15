/**
 * jUCMNav's `.jucm` into goal-controller (goal-controller#106, #28 item 15):
 * the GRL half of a URN specification as a piStar model in the GRL dialect,
 * its strategies as the dialect's `strategies` project resource, and what
 * the import could not keep. One way: no export back to `.jucm`
 * (packages/dialect/docs/importers.md).
 */
import { readJucm, type GrlReadDiagnostic } from './xmi';
import { STRATEGIES_RESOURCE, toPistar } from './pistar';

export type ImportDiagnostic = GrlReadDiagnostic;

/** What a model's dialect needs beside the model: its engine, and its resources' files. */
export type DialectRecord = {
  /** the engine the model records (`diagram.customProperties.engine`) */
  engine: string;
  /** each project resource kind's files, by path in the project */
  projectResources: Readonly<Record<string, Readonly<Record<string, string>>>>;
};

export type ImportResult =
  | {
      /** the piStar file, as JSON (its text: `JSON.stringify(model, null, 2)`) */
      model: Record<string, unknown>;
      dialectRecord: DialectRecord;
      diagnostics: ImportDiagnostic[];
    }
  | { model: null; dialectRecord: null; diagnostics: ImportDiagnostic[] };

/** A `.jucm` text as a GRL model; null with error diagnostics when it isn't one. */
export const importJucm = (text: string): ImportResult => {
  const { document, diagnostics } = readJucm(text);
  if (!document) return { model: null, dialectRecord: null, diagnostics };
  const { model, strategies } = toPistar(document, diagnostics);
  return {
    model,
    dialectRecord: {
      engine: 'grl',
      projectResources: { [STRATEGIES_RESOURCE]: strategies },
    },
    diagnostics,
  };
};

export { readJucm } from './xmi';
export type { GrlDocument } from './xmi';
export { KIND_OF_TYPE, STRATEGIES_FOLDER, STRATEGIES_RESOURCE } from './pistar';
