/**
 * The round-trip contract of a dialect's native files (goal-controller#143),
 * as every dialect's tests and the stress scripts' `native` column check
 * it: a model written and read back equals it but for what the format
 * can't carry (`lossy`); a file read and written back equals it, as its
 * format compares texts (`canonical`), where the file is lossless (a file
 * holding what the model doesn't keep isn't).
 */
import {
  modelDifference,
  type NativeDiagnostic,
  type NativeFileContext,
  type NativeFileDefinition,
  type PistarJson,
} from '@goal-controller/dialect';

/** How a round trip went: whether it holds, where it doesn't, and what reading and writing said. */
export type RoundTrip = {
  ok: boolean;
  /** why not, when it doesn't hold */
  problem: string | null;
  diagnostics: NativeDiagnostic[];
};

const errorsOf = (diagnostics: readonly NativeDiagnostic[]) =>
  diagnostics.filter((d) => d.severity === 'error');

const failed = (problem: string, diagnostics: NativeDiagnostic[]) => ({
  ok: false,
  problem,
  diagnostics,
});

/** `read(write(m))` equals `m` but for the format's lossy paths; `written`: the text it wrote. */
export const modelRoundTrip = (
  file: NativeFileDefinition,
  model: PistarJson,
  context: NativeFileContext,
): RoundTrip & { written: string | null } => {
  if (!file.write) return { ...failed('it has no writer', []), written: null };
  const written = file.write(model, context);
  if (written.text === null)
    return {
      ...failed(
        `not written: ${errorsOf(written.diagnostics)[0]?.message ?? 'no reason given'}`,
        written.diagnostics,
      ),
      written: null,
    };
  const read = file.read(written.text, context);
  const diagnostics = [...written.diagnostics, ...read.diagnostics];
  if (!read.model)
    return {
      ...failed(
        `what it wrote doesn't read: ${errorsOf(read.diagnostics)[0]?.message ?? 'no reason given'}`,
        diagnostics,
      ),
      written: written.text,
    };
  const difference = modelDifference(model, read.model, file.lossy);
  return difference
    ? {
        ...failed(
          `read back, ${difference.path} is ${difference.b}, not ${difference.a}`,
          diagnostics,
        ),
        written: written.text,
      }
    : { ok: true, problem: null, diagnostics, written: written.text };
};

/** The first line two texts differ on, 1-based, with both lines. */
const firstDifferentLine = (a: string, b: string) => {
  const [left, right] = [a.split('\n'), b.split('\n')];
  for (let i = 0; i < Math.max(left.length, right.length); i++)
    if (left[i] !== right[i])
      return { line: i + 1, a: left[i] ?? '', b: right[i] ?? '' };
  return null;
};

/** `write(read(f))` equals `f`, both in the format's canonical form (as written, without one). */
export const textRoundTrip = (
  file: NativeFileDefinition,
  text: string,
  context: NativeFileContext,
): RoundTrip & { written: string | null } => {
  const read = file.read(text, context);
  if (!read.model)
    return {
      ...failed(
        `it doesn't read: ${errorsOf(read.diagnostics)[0]?.message ?? 'no reason given'}`,
        read.diagnostics,
      ),
      written: null,
    };
  if (!file.write)
    return { ...failed('it has no writer', read.diagnostics), written: null };
  const written = file.write(read.model, {
    ...context,
    projectResources: read.dialectRecord.projectResources,
    options: read.dialectRecord.options,
  });
  const diagnostics = [...read.diagnostics, ...written.diagnostics];
  if (written.text === null)
    return {
      ...failed(
        `not written: ${errorsOf(written.diagnostics)[0]?.message ?? 'no reason given'}`,
        diagnostics,
      ),
      written: null,
    };
  const canonical = file.canonical ?? ((same: string) => same);
  const difference = firstDifferentLine(
    canonical(text),
    canonical(written.text),
  );
  return difference
    ? {
        ...failed(
          `line ${difference.line} is ${JSON.stringify(difference.b)}, not ${JSON.stringify(difference.a)}`,
          diagnostics,
        ),
        written: written.text,
      }
    : { ok: true, problem: null, diagnostics, written: written.text };
};
