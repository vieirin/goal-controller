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
import type { Problem } from '@/lib/workbench/types';
import type { Attachment } from './providers';

/**
 * A Propose run's change set, for the user to review: `pending` until
 * approved (`applied`), rejected, or `discarded` (the model worker it was
 * previewed in restarted, or a later run superseded it).
 */
export type ProposalState =
  | 'pending'
  | 'applied'
  | 'rejected'
  | 'discarded'
  /** it would leave errors: sent back to the agent, which proposes again */
  | 'revised';

/**
 * A change set replayed on a copy of the model (`previewProposal`): the
 * model's JSON text before and after it, and the problems it would add;
 * or why it couldn't be replayed.
 */
export type PreviewView =
  | {
      ok: true;
      fileName: string;
      before: string;
      after: string;
      problems: readonly Problem[];
    }
  | { ok: false; message: string };

/**
 * The entry kinds a live transcript and a stored, read-only one render the
 * same (`SharedEntryCard`): nothing here is a run's or a session's own.
 */
export type SharedEntry =
  | {
      kind: 'user';
      id: string;
      text: string;
      attachments: readonly Attachment[];
    }
  /** a step's prose, streamed in as it arrives */
  | { kind: 'assistant'; id: string; text: string }
  | { kind: 'tool'; id: string; call: TranscriptToolCall }
  /** what the drawer did on its own (sent a proposal back to the agent) */
  | { kind: 'notice'; id: string; text: string }
  | { kind: 'error'; id: string; text: string };

export type ChatEntry =
  | SharedEntry
  /**
   * the model's JSON text before and after an edit; the elements and links
   * it added or changed, and the model's problems before its run (as
   * `problemKey`s), for the problems it introduced
   */
  | {
      kind: 'diff';
      id: string;
      fileName: string;
      before: string;
      after: string;
      touched: ReadonlySet<string>;
      baseline: ReadonlySet<string>;
      undone: boolean;
    }
  | {
      kind: 'proposal';
      id: string;
      changeSet: GlspChangeSet;
      entries: readonly ChangeSetEntry[];
      preview: PreviewView;
      state: ProposalState;
    };

/**
 * `ChatEntry`, stripped of what only the run or session it came from can
 * read back: a 'diff's `touched`/`baseline` (the live model's problems,
 * which a reopened conversation shows none of) and a 'proposal's live
 * `changeSet`/`entries` (its `step` closes over the run's own scratch
 * session), each entry's change described once instead, while both are
 * still live (`toStoredEntry`). What a model's earlier conversation is kept
 * as, and shown as, read-only.
 */
export type StoredChatEntry =
  | SharedEntry
  | {
      kind: 'diff';
      id: string;
      fileName: string;
      before: string;
      after: string;
      undone: boolean;
    }
  | {
      kind: 'proposal';
      id: string;
      state: ProposalState;
      preview: PreviewView;
      described: readonly {
        toolCallId: string;
        name: string;
        refused: boolean;
        lines: readonly string[];
      }[];
    };

/** `entry`, as kept for a model that isn't open now (`StoredChatEntry`) */
export const toStoredEntry = (entry: ChatEntry): StoredChatEntry => {
  switch (entry.kind) {
    case 'diff':
      return {
        kind: 'diff',
        id: entry.id,
        fileName: entry.fileName,
        before: entry.before,
        after: entry.after,
        undone: entry.undone,
      };
    case 'proposal':
      return {
        kind: 'proposal',
        id: entry.id,
        state: entry.state,
        preview: entry.preview,
        described: entry.entries.map((proposed) => ({
          toolCallId: proposed.toolCallId,
          name: proposed.name,
          ...describeEntry(entry.changeSet, proposed),
        })),
      };
    default:
      return entry;
  }
};

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

/**
 * a problem as itself: where, and what, its positions left out (an edit
 * moves the same problem within its line: `1:10` before a rename, `1:13`
 * after)
 */
export const problemKey = ({
  elementId,
  message,
}: Pick<Problem, 'elementId' | 'message'>): string =>
  `${elementId ?? ''}\u0000${message.replace(/\b\d+:\d+\b/g, '')}`;

/**
 * The problems an edit introduced, as the model is now: on an element or
 * link it added or changed (by its id, or by `keyOf` it: the RT id the
 * notation's problems name it by), and not there before its run. One fixed
 * since is gone from the list.
 */
export const introducedProblems = (
  problems: readonly Problem[],
  touched: ReadonlySet<string>,
  baseline: ReadonlySet<string>,
  keyOf: (id: string) => string | undefined = () => undefined,
): readonly Problem[] => {
  const names = new Set(touched);
  for (const id of touched) {
    const key = keyOf(id);
    if (key) names.add(key);
  }
  return problems.filter(
    (problem) =>
      problem.elementId !== undefined &&
      names.has(problem.elementId) &&
      !baseline.has(problemKey(problem)),
  );
};

/** the model's problems, for the agent's next request (a system-prompt section) */
export const problemsText = (problems: readonly Problem[]): string =>
  problems.length === 0
    ? 'None.'
    : problems
        .map(
          ({ severity, message, elementId }) =>
            `- ${severity}: ${message}${elementId ? ` (element ${elementId})` : ''}`,
        )
        .join('\n');

/** what a proposal that would leave `errors` is sent back to the agent with */
export const revisionPrompt = (errors: readonly Problem[]): string =>
  [
    'Your change set was not applied: it would leave these problems in the model.',
    problemsText(errors),
    'Propose the whole change again, from the model as it is now, so that it leaves none of them.',
  ].join('\n\n');
