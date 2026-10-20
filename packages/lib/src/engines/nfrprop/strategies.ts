/**
 * nfrprop's strategies as a project resource (goal-controller#328, GRL's
 * pattern: `packages/lib/src/engines/grl/strategies.ts`): an alternative
 * set of initial labels to propagate from, instead of editing the model's
 * own `initialLabel` properties between runs. One file, one strategy:
 *
 * ```json
 * {
 *   "name": "RSA 260 only",
 *   "labels": { "Encrypt with RSA 128 bits": "denied" }
 * }
 * ```
 *
 * A key is an element's name as the Notation view writes it, tried first,
 * or its piStar id (propagation.ts's `runPropagation`, once a model is in
 * scope, resolves it; a key neither finds is said in the case, as GRL's
 * unknown evaluations are). An element the strategy doesn't mention keeps its own
 * rule: an operationalization or claim nothing contributes to is
 * satisficed, any other element propagated.
 */
import {
  keyRange,
  readJson,
  type ParsedResource,
  type ProjectResourceParser,
  type ResourceDiagnostic,
  type ResourceFile,
} from '../projectResources';
import { NFR_LABELS, type NfrLabel } from './labels';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isLabel = (value: unknown): value is NfrLabel =>
  (NFR_LABELS as readonly string[]).includes(value as string);

/** One file, as it is written: a strategy's name, and its labels by name or piStar id. */
export type NfrStrategyFile = {
  name: string;
  labels: Readonly<Record<string, NfrLabel>>;
};

/** A strategy as its file declares it; `path` doubles as its id (one strategy per file). */
export type NfrStrategy = {
  id: string;
  name: string;
  path: string;
  labels: ReadonlyMap<string, NfrLabel>;
};

/** Reads one file's strategy, with what is wrong in it. */
const readFile = (
  file: ResourceFile,
  diagnostics: ResourceDiagnostic[],
): NfrStrategy | null => {
  const { value, diagnostics: json } = readJson(file);
  diagnostics.push(...json);
  if (value === undefined) return null;
  const problem = (key: string, message: string) =>
    diagnostics.push({
      path: file.path,
      severity: 'error',
      message,
      ...keyRange(file.text, key),
    });
  if (!isRecord(value) || !isRecord(value.labels)) {
    problem('labels', 'A strategy file has a `labels` object');
    return null;
  }
  const name = typeof value.name === 'string' ? value.name : file.path;
  const labels = new Map<string, NfrLabel>();
  for (const [element, label] of Object.entries(value.labels)) {
    if (!isLabel(label)) {
      problem(
        element,
        `Strategy ${name}: element ${element}'s label is one of ${NFR_LABELS.join(', ')}`,
      );
      continue;
    }
    labels.set(element, label);
  }
  return { id: file.path, name, path: file.path, labels };
};

/** Every file's strategy, in file order, with what is wrong in them. */
export const readNfrStrategies = (
  files: readonly ResourceFile[],
): { strategies: NfrStrategy[]; diagnostics: ResourceDiagnostic[] } => {
  const diagnostics: ResourceDiagnostic[] = [];
  const strategies = files.flatMap((file) => readFile(file, diagnostics) ?? []);
  return { strategies, diagnostics };
};

/** The project resource parser: the strategies as symbols (by name) and as data. */
export const parseNfrStrategies: ProjectResourceParser<{
  strategies: { id: string; name: string; elements: string[] }[];
}> = (
  files,
): ParsedResource<{
  strategies: { id: string; name: string; elements: string[] }[];
}> => {
  const { strategies, diagnostics } = readNfrStrategies(files);
  return {
    symbols: {
      strategies: strategies.map((strategy) => ({
        name: strategy.name,
        detail: `${strategy.labels.size} labels`,
      })),
    },
    // JSON: it crosses to the language server
    data: {
      strategies: strategies.map((strategy) => ({
        id: strategy.id,
        name: strategy.name,
        elements: [...strategy.labels.keys()],
      })),
    },
    diagnostics,
  };
};
