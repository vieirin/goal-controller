/// <reference lib="webworker" />
/**
 * The model worker (goal-controller#434): the workbench's store, dispatcher
 * and guards, one session per opened model (modelWorkerHost.ts). The main
 * thread opens a session with a `MessagePort` and follows it with a mirror
 * (modelSession.ts); the engine worker follows the same dispatcher over a
 * port of its own.
 */
import { createModelWorkerHost } from './modelWorkerHost';

const host = createModelWorkerHost((pong) => self.postMessage(pong));

self.onmessage = (event: MessageEvent) => host.onMessage(event);
