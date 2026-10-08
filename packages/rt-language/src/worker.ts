/// <reference lib="webworker" />
import { EmptyFileSystem, URI } from 'langium';
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
      // re-validates the open documents against the new context (a closed one
      // has no text left to re-read: the server holds no files)
      const uris = shared.workspace.TextDocuments.all().map((document) =>
        URI.parse(document.uri),
      );
      await shared.workspace.DocumentBuilder.update(uris, []);
    },
  );
  startLanguageServer(shared);
};
