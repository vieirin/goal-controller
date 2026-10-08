/// <reference lib="webworker" />
import { EmptyFileSystem } from 'langium';
import { startLanguageServer } from 'langium/lsp';
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
} from 'vscode-languageserver/browser';
import {
  CONTEXT_NOTIFICATION,
  type RtContextRecord,
  type RtPropertyRules,
} from './context.js';
import { createRtServices } from './lsp.js';

/**
 * Runs the RT language server inside a Web Worker, talking LSP over postMessage.
 * `rules` are the engine's property rules (its checks), injected by the editor.
 */
export const startRtWorkerServer = (
  scope: DedicatedWorkerGlobalScope,
  { rules }: { rules?: RtPropertyRules } = {},
): void => {
  const connection = createConnection(
    new BrowserMessageReader(scope),
    new BrowserMessageWriter(scope),
  );
  const { shared, RtNotation } = createRtServices({
    connection,
    ...EmptyFileSystem,
  });
  RtNotation.context.Context.rules = rules;
  connection.onNotification(
    CONTEXT_NOTIFICATION,
    async (record: RtContextRecord) => {
      RtNotation.context.Context.set(record);
      const uris = shared.workspace.LangiumDocuments.all
        .map((document) => document.uri)
        .toArray();
      // re-validates the open documents against the new context
      await shared.workspace.DocumentBuilder.update(uris, []);
    },
  );
  startLanguageServer(shared);
};
