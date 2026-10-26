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
  type MessagePortLike,
  type ModelSourceChangedAction,
} from '@istar-ts/actions';
import {
  createModelStore,
  DEFAULT_PALETTE,
  type AnyPaletteDescription,
} from '@istar-ts/core';
import type { AnyModel } from '@goal-controller/lib';
import { emptyModel, pistarExtMetamodelGuard } from './dialects';
import { guardsForMode } from './modeGuards';
import { readModelText, serializeModel } from './pistar';
import {
  isModelSessionControl,
  isModelWorkerOpen,
  type ModelChangeExtras,
  type ModelSessionControl,
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
  // the metamodel each model of the history is read with (ModelChangeExtras)
  const metamodelKeyOf = new WeakMap<AnyModel, number>([[opened, 0]]);
  let metamodelKey = 0;
  // what requestContextActions answers: the canvas's palette (istar-ts#202)
  let palette: AnyPaletteDescription = DEFAULT_PALETTE;
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
    metamodelKey = metamodelKeyOf.get(model) ?? metamodelKey;
    metamodelKeyOf.set(model, metamodelKey);
    extrasOf.set(action, { text: derived, metamodelKey });
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

  const write = (next: string, apply: boolean, key: number): void => {
    lastText = next;
    if (!apply) return;
    const written = readModelText(next);
    // the main thread read it first: it does parse
    if (!('model' in written)) return;
    textOf.set(written.model, next);
    metamodelKeyOf.set(written.model, key);
    // a host-side edit, as `wb.setText`'s was before the worker (#410): one
    // undo step; a conversion's text may be of another metamodel, which
    // `istar.replaceModel` (read with the dispatcher's own) can't take
    store.replace(written.model);
  };

  const control = (
    message: ModelSessionControl,
    ports: readonly MessagePort[],
  ): void => {
    switch (message.type) {
      case 'mode': {
        const { guards, postGuards } = guardsForMode(message.mode);
        modeGuards = guards;
        modePostGuards = postGuards;
        return;
      }
      case 'palette':
        palette = message.palette ?? DEFAULT_PALETTE;
        return;
      case 'write':
        write(message.text, message.apply, message.metamodelKey);
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
  port.onmessage = (event: MessageEvent) => {
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
  const onMessage = ({ data: open, ports }: ModelWorkerEvent): void => {
    const port = ports[0];
    if (!isModelWorkerOpen(open) || !port) return;
    sessions.get(open.session)?.close();
    sessions.set(
      open.session,
      hostSession(open, port, () => sessions.delete(open.session)),
    );
  };
  return {
    onMessage,
    /** the sessions open now (the tests check a switch disposes one) */
    openSessions: (): readonly number[] => [...sessions.keys()],
  };
};
