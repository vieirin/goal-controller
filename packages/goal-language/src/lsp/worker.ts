/// <reference lib="webworker" />
/**
 * The goal language server in a Web Worker, speaking LSP over postMessage
 * (`@goal-controller/goal-language/worker`). A host's worker script calls it,
 * passing the named checks it has (lib's registries, by dialect id).
 */
import { EmptyFileSystem } from 'langium';
import { startLanguageServer } from 'langium/lsp';
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
} from 'vscode-languageserver/browser';
import {
  createGoalLspServices,
  listenForContext,
  type CheckRegistries,
} from './server.js';

export type { CheckRegistries } from './server.js';
export type { CheckContext, NamedCheck } from '../notation/checks.js';

export const startGoalWorkerServer = (
  scope: DedicatedWorkerGlobalScope,
  { checks }: { checks?: CheckRegistries } = {},
): void => {
  const connection = createConnection(
    new BrowserMessageReader(scope),
    new BrowserMessageWriter(scope),
  );
  const { shared, store } = createGoalLspServices(
    { connection, ...EmptyFileSystem },
    { checks },
  );
  listenForContext(connection, shared, store);
  startLanguageServer(shared);
};
