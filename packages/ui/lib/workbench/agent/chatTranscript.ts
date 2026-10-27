/**
 * What the agent drawer's transcript shows (goal-controller#485), as data:
 * its entries, and what a tool call's card and an edit's diff card read off
 * a call's result and the model before and after it. Generic over the
 * registry's tools: nothing here knows a tool by its name.
 */
import type {
  ChangeSetEntry,
  JsonValue,
  TranscriptToolCall,
} from '@istar-ts/agent';
import type { GlspChangeSet } from '@istar-ts/agent/glsp';
import { structuredPatch } from 'diff';
import type { Attachment } from './providers';

/**
 * A Propose run's change set, for the user to review: `pending` until
 * approved (`applied`), rejected, or `discarded` (the model worker it was
 * previewed in restarted, or a later run superseded it).
 */
export type ProposalState = 'pending' | 'applied' | 'rejected' | 'discarded';

export type ChatEntry =
  | {
      kind: 'user';
      id: string;
      text: string;
      attachments: readonly Attachment[];
    }
  /** a step's prose, streamed in as it arrives */
  | { kind: 'assistant'; id: string; text: string }
  | { kind: 'tool'; id: string; call: TranscriptToolCall }
  /** the model's JSON text before and after an edit */
  | {
      kind: 'diff';
      id: string;
      fileName: string;
      before: string;
      after: string;
    }
  | {
      kind: 'proposal';
      id: string;
      changeSet: GlspChangeSet;
      entries: readonly ChangeSetEntry[];
      state: ProposalState;
    }
  | { kind: 'error'; id: string; text: string };

export type ChipTone = 'ok' | 'caution' | 'danger' | 'muted';

const isRecord = (
  value: JsonValue,
): value is { readonly [key: string]: JsonValue } =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** a validator's findings: an object's `diagnostics` or `issues` list */
const issuesOf = (content: JsonValue): readonly JsonValue[] | undefined => {
  if (!isRecord(content)) return undefined;
  const found = content.diagnostics ?? content.issues;
  return Array.isArray(found) ? found : undefined;
};

/**
 * A tool call's status chip, from its result: refused, a validator's
 * findings, an applied edit (Auto mode: each call is one undo step), a
 * dry-run edit (Propose mode), or a read.
 */
export const toolCallChip = ({
  disposition,
  result,
}: Pick<TranscriptToolCall, 'disposition' | 'result'>): {
  label: string;
  tone: ChipTone;
} => {
  if (!result.ok) return { label: 'rejected', tone: 'danger' };
  const issues = issuesOf(result.content);
  if (issues)
    return {
      label: `${issues.length} issue${issues.length === 1 ? '' : 's'}`,
      tone: issues.length === 0 ? 'ok' : 'caution',
    };
  if (disposition === 'applied') return { label: '1 undo step', tone: 'ok' };
  if (disposition === 'proposed') return { label: 'proposed', tone: 'muted' };
  return { label: 'read', tone: 'ok' };
};

/** a call's arguments on one line: `key: value, …` */
export const argsSummary = (args: JsonValue): string => {
  if (args === null) return '';
  if (!isRecord(args)) return JSON.stringify(args);
  return Object.entries(args)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ');
};

type Scalar = null | boolean | number | string;

const isScalar = (value: JsonValue): value is Scalar =>
  value === null || typeof value !== 'object';

/**
 * A result that is a list of flat objects (each value a scalar), as a
 * table's columns (every key, in first-seen order) and rows; none for any
 * other result.
 */
export const flatTable = (
  content: JsonValue,
):
  | {
      columns: readonly string[];
      rows: readonly { readonly [key: string]: Scalar }[];
    }
  | undefined => {
  if (!Array.isArray(content) || content.length === 0) return undefined;
  const rows: { [key: string]: Scalar }[] = [];
  const columns = new Set<string>();
  for (const item of content) {
    if (!isRecord(item)) return undefined;
    const row: { [key: string]: Scalar } = {};
    for (const [key, value] of Object.entries(item)) {
      if (!isScalar(value)) return undefined;
      row[key] = value;
      columns.add(key);
    }
    rows.push(row);
  }
  return { columns: [...columns], rows };
};

export type DiffLine = {
  kind: 'hunk' | 'add' | 'remove' | 'context';
  text: string;
};

/** `before` → `after` as a unified diff's lines, with its +/− counts */
export const modelDiff = (
  before: string,
  after: string,
): { added: number; removed: number; lines: readonly DiffLine[] } => {
  const patch = structuredPatch('', '', before, after, '', '', {
    context: 3,
  });
  let added = 0;
  let removed = 0;
  const lines: DiffLine[] = [];
  for (const hunk of patch.hunks) {
    lines.push({
      kind: 'hunk',
      text: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
    });
    for (const line of hunk.lines) {
      const text = line.slice(1);
      if (line.startsWith('+')) {
        added += 1;
        lines.push({ kind: 'add', text });
      } else if (line.startsWith('-')) {
        removed += 1;
        lines.push({ kind: 'remove', text });
      } else if (line.startsWith(' ')) lines.push({ kind: 'context', text });
      // `\ No newline at end of file` says nothing about the model
    }
  }
  return { added, removed, lines };
};

/**
 * What a proposed entry does, in words: its step's lines, or why it was
 * refused. The entry is a copy of what the worker's scratch call answered:
 * an `undo`/`redo` carries its own `undoDescription`, a step its `stepId`,
 * which `changeSet.step` finds it by.
 */
export const describeEntry = (
  changeSet: GlspChangeSet,
  entry: ChangeSetEntry,
): { refused: boolean; lines: readonly string[] } => {
  if (!entry.result.ok)
    return {
      refused: true,
      lines: entry.result.diagnostics.map(({ message }) => message),
    };
  const undone = entry.result.undoDescription;
  if (undone) return { refused: false, lines: [undone] };
  return {
    refused: false,
    lines: changeSet.step(entry)?.description ?? [`${entry.name} (no change)`],
  };
};
