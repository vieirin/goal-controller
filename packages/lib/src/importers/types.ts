/**
 * What an importer returns (packages/dialect/docs/importers.md): a native
 * file's reader's result (goal-controller#143), the piStar model, what its
 * dialect needs beside it, and what was read differently or left out.
 */
export type {
  DialectRecord,
  NativeDiagnostic as ImportDiagnostic,
  NativeReadResult as ImportResult,
} from '@goal-controller/dialect';
