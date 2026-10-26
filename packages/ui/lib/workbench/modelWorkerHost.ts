/**
 * The model worker's sessions (goal-controller#434): the workbench's
 * `ModelStore` and action dispatcher, its guards and post-guards, and the
 * text derived from the model, one session per opened model. The main thread
 * holds only a mirror of each (modelSession.ts), and every editor reaches the
 * dispatcher over the session's `MessagePort`. Hosted by the worker itself
 * (modelWorker.ts) or, where there is no `Worker` (the tests),
 * in-process over the same ports (modelWorkerLocal.ts).
 */
import {
  connectDispatcher,
  createActionDispatcher,
  type ActionDispatcher,
  type ActionGuard,
  type ActionPostGuard,
  type HostToolResult,
  type MessagePortLike,
  type ModelSourceChangedAction,
  type ReplaceModelOperation,
} from '@istar-ts/actions';
import {
  createModelStore,
  DEFAULT_PALETTE,
  toPistarObject,
  type AnyPaletteDescription,
  type GoalDiagnostic,
} from '@istar-ts/core';
import type { AnyModel } from '@goal-controller/lib';
import { emptyModel, pistarExtMetamodelGuard } from './dialects';
import { guardsForMode } from './modeGuards';
import { readModelText, serializeModel, type ModelMode } from './pistar';
import {
  isModelSessionControl,
  isModelWorkerOpen,
  type ModelChangeExtras,
  type ModelSessionAck,
  type ModelSessionControl,
  type ModelSessionReport,
  type ModelSessionToolCall,
  type ModelWorkerOpen,
} from './modelWorkerProtocol';

/** A message as the worker (or its in-process stand-in) receives it. */
export type ModelWorkerEvent = {
  readonly data: unknown;
  readonly ports: readonly MessagePort[];
};

type HostedSession = { close(): void };

/** Opens the session `open` asks for, over `port`. */
const hostSession = (
  { text }: ModelWorkerOpen,
  port: MessagePort,
  onClosed: () => void,
): HostedSession => {
  const read = readModelText(text);
  const opened = 'model' in read ? read.model : emptyModel();
  const store = createModelStore(opened);
  // the text each model of the history was shown as: undo and redo bring it
  // back as it was, byte for byte (#410)
  const textOf = new WeakMap<AnyModel, string>();
  if ('model' in read) textOf.set(opened, text);
  // the text the next derived one takes its indentation from
  let lastText = text;
  // what requestContextActions answers: the canvas's palette (istar-ts#202)
  let palette: AnyPaletteDescription = DEFAULT_PALETTE;
  // the mode, for the agent's session (its guards, host tools and context)
  let mode: ModelMode = 'pistar';
  // the mode's own guards (oneActorOnly, an edgeV2 check, #412), read fresh
  // on each dispatch (the dispatcher's own are fixed at creation)
  let modeGuards: readonly ActionGuard<string, string>[] = [];
  let modePostGuards: readonly ActionPostGuard<string, string>[] = [];
  // sendModel: each sourceModelChanged carries the model and canUndo/canRedo,
  // for the mirrors that follow it (the main thread's, the engine worker's)
  const dispatcher = createActionDispatcher(store, {
    palette: () => palette,
    guards: [
      pistarExtMetamodelGuard,
      (operation, before) =>
        modeGuards.flatMap((guard) => guard(operation, before) ?? []),
    ],
    postGuards: [
      (operation, after, before) =>
        modePostGuards.flatMap(
          (guard) => guard(operation, after, before) ?? [],
        ),
    ],
    sendModel: true,
  });
  // derived once per change, before any connection forwards it: the first
  // subscriber, and a dispatcher notifies synchronously, in order
  const extrasOf = new WeakMap<ModelSourceChangedAction, ModelChangeExtras>();
  const unsubscribe = dispatcher.subscribe((action) => {
    if (action.kind !== 'sourceModelChanged') return;
    const model = store.getModel();
    const derived = textOf.get(model) ?? serializeModel(model, lastText);
    textOf.set(model, derived);
    lastText = derived;
    extrasOf.set(action, { text: derived });
  });
  // the main thread's connection: every change with its extras
  const withExtras: ActionDispatcher<string, string> = {
    dispatch: (action, options) => dispatcher.dispatch(action, options),
    subscribe: (listener) =>
      dispatcher.subscribe((action) => {
        const extras =
          action.kind === 'sourceModelChanged'
            ? extrasOf.get(action)
            : undefined;
        listener(extras ? { ...action, ...extras } : action);
      }),
  };
  const served = new Map<number, () => void>();
  // the agent's sessions (`serveGlspMcpSession`), and their calls to the main
  // thread's host tools still waiting for an answer
  const agents = new Map<number, () => void>();
  const toolCalls = new Map<
    number,
    {
      readonly agent: number;
      resolve(result: HostToolResult): void;
      reject(error: Error): void;
    }
  >();
  let toolCallCount = 0;
  const forwardTo =
    (agent: number) =>
    (
      name: string,
      args: ModelSessionToolCall['args'],
    ): Promise<HostToolResult> =>
      new Promise((resolve, reject) => {
        const call = (toolCallCount += 1);
        toolCalls.set(call, { agent, resolve, reject });
        port.postMessage({
          type: 'toolCall',
          agent,
          call,
          name,
          args,
        } satisfies ModelSessionToolCall);
      });
  const stopAgent = (agent: number): void => {
    agents.get(agent)?.();
    agents.delete(agent);
    for (const [call, waiting] of toolCalls)
      if (waiting.agent === agent) {
        toolCalls.delete(call);
        waiting.reject(new Error('the agent session is closed'));
      }
  };

  const write = (next: string, apply: boolean): void => {
    lastText = next;
    if (!apply) return;
    const written = readModelText(next);
    // the main thread read it first: it does parse
    if (!('model' in written)) return;
    textOf.set(written.model, next);
    // a host-side edit, as `wb.setText`'s was before the worker (#410): one
    // undo step; a conversion's text may be of another metamodel, which
    // `istar.replaceModel` (read with the dispatcher's own) can't take
    store.replace(written.model);
  };

  /**
   * The active mode's guards and post-guards, run in report mode
   * (goal-controller#471) over the model as it stands: never rejects, so an
   * import or an open applies as written and its diagnostics show as
   * Problems instead. `istar.replaceModel` stands in for "this is the
   * model", since a guard reads its operation and the model the same way
   * for any operation that replaces the whole thing.
   */
  const report = (): readonly GoalDiagnostic[] => {
    const model = store.getModel();
    const operation: ReplaceModelOperation = {
      kind: 'istar.replaceModel',
      model: toPistarObject(model),
    };
    return [
      ...modeGuards.flatMap((guard) => guard(operation, model) ?? []),
      ...modePostGuards.flatMap(
        (guard) => guard(operation, model, model) ?? [],
      ),
    ];
  };

  const control = (
    message: ModelSessionControl,
    ports: readonly MessagePort[],
  ): void => {
    switch (message.type) {
      case 'mode': {
        mode = message.mode;
        const { guards, postGuards } = guardsForMode(message.mode);
        modeGuards = guards;
        modePostGuards = postGuards;
        port.postMessage({
          type: 'report',
          diagnostics: report(),
        } satisfies ModelSessionReport);
        return;
      }
      case 'palette':
        palette = message.palette ?? DEFAULT_PALETTE;
        return;
      case 'write':
        write(message.text, message.apply);
        return;
      case 'serve': {
        const other = ports[0];
        if (!other) return;
        const disconnect = connectDispatcher<string, string, MessageEvent>(
          other,
          dispatcher,
        );
        served.set(message.id, () => {
          disconnect();
          other.close();
        });
        return;
      }
      case 'unserve':
        served.get(message.id)?.();
        served.delete(message.id);
        return;
      case 'agent': {
        const other = ports[0];
        if (!other) return;
        // loaded once a page turns the agent on, not with every worker
        const started = import('./agent/agentHost').then(({ serveAgent }) =>
          serveAgent(other, {
            store,
            dispatcher,
            getMode: () => mode,
            getPalette: () => palette,
            forwarded: message.tools,
            forward: forwardTo(message.id),
          }),
        );
        agents.set(message.id, () => {
          void started.then((stop) => stop());
        });
        return;
      }
      case 'unagent':
        stopAgent(message.id);
        return;
      case 'toolResult': {
        const waiting = toolCalls.get(message.call);
        toolCalls.delete(message.call);
        if ('result' in message) waiting?.resolve(message.result);
        else waiting?.reject(new Error(message.error));
        return;
      }
      case 'close':
        close();
        return;
    }
  };

  // the action protocol and the control messages share the port (ordered):
  // `connectDispatcher` sees only the former
  const rpc: MessagePortLike<MessageEvent> = {
    postMessage: (data) => port.postMessage(data),
    onmessage: null,
  };
  // acked before it's applied (goal-controller#479): a slow dispatch acks
  // almost instantly even though applying it then takes a while, so the main
  // thread can tell "busy" from "gone" without timing the apply itself
  let ackSeq = 0;
  port.onmessage = (event: MessageEvent) => {
    ackSeq += 1;
    port.postMessage({ type: 'ack', seq: ackSeq } satisfies ModelSessionAck);
    if (isModelSessionControl(event.data)) control(event.data, event.ports);
    else rpc.onmessage?.(event);
  };
  const disconnect = connectDispatcher<string, string, MessageEvent>(
    rpc,
    withExtras,
  );

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    for (const stop of served.values()) stop();
    served.clear();
    for (const agent of agents.keys()) stopAgent(agent);
    disconnect();
    unsubscribe();
    dispatcher.dispose();
    port.onmessage = null;
    port.close();
    onClosed();
  };
  return { close };
};

/** The worker's sessions, and the handler for its own channel's messages. */
export const createModelWorkerHost = () => {
  const sessions = new Map<number, HostedSession>();
  const onMessage = ({ data, ports }: ModelWorkerEvent): void => {
    const port = ports[0];
    if (!isModelWorkerOpen(data) || !port) return;
    sessions.get(data.session)?.close();
    sessions.set(
      data.session,
      hostSession(data, port, () => sessions.delete(data.session)),
    );
  };
  return {
    onMessage,
    /** the sessions open now (the tests check a switch disposes one) */
    openSessions: (): readonly number[] => [...sessions.keys()],
  };
};
