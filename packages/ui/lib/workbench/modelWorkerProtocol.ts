/**
 * What crosses `postMessage` between the main thread and the model worker
 * (goal-controller#434), besides the action protocol itself.
 *
 * - The worker's own channel carries one message, `open`, with the session's
 *   `MessagePort` transferred alongside it.
 * - The session's port carries the action protocol (`connectDispatcher` /
 *   `createRemoteDispatcher`, JSON-RPC 2.0) and, main thread to worker, the
 *   session's own control messages below. They share the port so they are
 *   ordered with its dispatches: a mode change or a palette is in place before
 *   the next action sent after it.
 * - Each `sourceModelChanged` the worker sends carries `ModelChangeExtras`
 *   next to its `newRoot`: the text derived from the model.
 * - The session's port also carries, worker to main, the active mode's
 *   guard report (goal-controller#471): not a response to anything the main
 *   thread asked, so it isn't a JSON-RPC frame either.
 * - The agent's GLSP/MCP session (`agent`) runs in the worker
 *   on a port of its own; the host tools that read the main thread's state
 *   (`agent`'s `tools`) are called back on the session's port
 *   (`ModelSessionToolCall`, answered with `toolResult`).
 */
import type {
  HostTool,
  HostToolResult,
  ModelSourceChangedAction,
} from '@istar-ts/actions';
import type { AnyPaletteDescription, GoalDiagnostic } from '@istar-ts/core';
import type { ModelMode } from './pistar';

/** Main thread → worker, on the worker itself. */
export type ModelWorkerOpen = {
  readonly type: 'open';
  /** the session's id (`ModelSession.id`), for the worker's own bookkeeping */
  readonly session: number;
  /** the opened model's text: the worker reads it as `wb.setText` does (`readModelText`) */
  readonly text: string;
};

/** Main thread → worker, on a session's port. */
export type ModelSessionControl =
  | {
      /** the mode's guards (`guardsForMode`): built in the worker from the mode */
      readonly type: 'mode';
      readonly mode: ModelMode;
    }
  | {
      /** what `requestContextActions` answers (none: iStar 2.0's) */
      readonly type: 'palette';
      readonly palette: AnyPaletteDescription | null;
    }
  | {
      /**
       * A raw write (`wb.setText`): `apply` reads `text` into the store as one
       * undoable edit, `text` kept as written; otherwise the model stays as it
       * is (a text that doesn't parse, or a guard's rejection) and `text` is
       * only what the next derived text takes its indentation from.
       */
      readonly type: 'write';
      readonly text: string;
      readonly apply: boolean;
    }
  | {
      /**
       * Serves the session's dispatcher on the port transferred alongside
       * (the engine worker's mirror), until `unserve` with the same `id`.
       */
      readonly type: 'serve';
      readonly id: number;
    }
  | { readonly type: 'unserve'; readonly id: number }
  | {
      /**
       * Serves the agent's GLSP/MCP session (`serveGlspMcpSession`)
       * on the port transferred alongside, until `unagent`
       * with the same `id`. `tools` are served next to the worker's own
       * host tools, each call to one sent back (`ModelSessionToolCall`).
       */
      readonly type: 'agent';
      readonly id: number;
      readonly tools: readonly ForwardedToolSpec[];
    }
  | { readonly type: 'unagent'; readonly id: number }
  | ({
      /**
       * The answer to the `ModelSessionToolCall` numbered `call`: its
       * result, or the message of what the tool threw (the worker throws it
       * again, for the GLSP server to report as any tool's).
       */
      readonly type: 'toolResult';
      readonly call: number;
    } & ({ readonly result: HostToolResult } | { readonly error: string }))
  | { readonly type: 'close' };

/** A host tool the main thread runs, as the worker serves it: all but its handler. */
export type ForwardedToolSpec = Omit<HostTool, 'handler'>;

/**
 * Worker → main thread, on a session's port: a call to one of `agent`'s
 * `tools`, by the agent session `agent`; answered with a `toolResult`.
 */
export type ModelSessionToolCall = {
  readonly type: 'toolCall';
  readonly agent: number;
  readonly call: number;
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
};

/**
 * Worker → main thread, on a session's port: the active mode's guards and
 * post-guards, run in report mode (goal-controller#471) over the model as it
 * stands — applied already, never rejected — so its diagnostics show as
 * Problems instead. Sent after every `mode` message, so it covers both an
 * import or open (whose raw write is never rejected) and a mode switch
 * (re-run for the model as it now stands). Replaces the session's last one.
 */
export type ModelSessionReport = {
  readonly type: 'report';
  readonly diagnostics: readonly GoalDiagnostic[];
};

/** What the worker adds to each `sourceModelChanged` it sends the main thread. */
export type ModelChangeExtras = {
  /**
   * The model's text: the one it was written or opened as, if it is a model
   * of the history (undo, redo), else serialized like the previous text.
   */
  readonly text: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** The worker's `open`, as its channel receives it. */
export const isModelWorkerOpen = (value: unknown): value is ModelWorkerOpen =>
  isRecord(value) &&
  value.type === 'open' &&
  typeof value.session === 'number' &&
  typeof value.text === 'string';

/** A session control message, not an action-protocol frame (those carry `jsonrpc`). */
export const isModelSessionControl = (
  value: unknown,
): value is ModelSessionControl =>
  isRecord(value) && !('jsonrpc' in value) && typeof value.type === 'string';

/** A report, as the session's port receives it (not a JSON-RPC frame). */
export const isModelSessionReport = (
  value: unknown,
): value is ModelSessionReport =>
  isRecord(value) &&
  value.type === 'report' &&
  Array.isArray(value.diagnostics);

/** The text the worker attached to `action`; none from a dispatcher that doesn't add it. */
export const changeTextOf = (
  action: ModelSourceChangedAction,
): ModelChangeExtras['text'] | null =>
  'text' in action && typeof action.text === 'string' ? action.text : null;

/** A tool call, as the session's port receives it (not a JSON-RPC frame). */
export const isModelSessionToolCall = (
  value: unknown,
): value is ModelSessionToolCall =>
  isRecord(value) &&
  value.type === 'toolCall' &&
  typeof value.agent === 'number' &&
  typeof value.call === 'number' &&
  typeof value.name === 'string' &&
  isRecord(value.args);
