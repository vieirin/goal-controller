/// <reference lib="webworker" />
import { EmptyFileSystem } from 'langium';
import { startLanguageServer } from 'langium/lsp';
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
} from 'vscode-languageserver/browser';
import { createRtServices } from './lsp.js';
import { STRUCTURE_NOTIFICATION, type RtStructureRecord } from './structure.js';

/** Runs the RT language server inside a Web Worker, talking LSP over postMessage. */
export const startRtWorkerServer = (
  scope: DedicatedWorkerGlobalScope,
): void => {
  const connection = createConnection(
    new BrowserMessageReader(scope),
    new BrowserMessageWriter(scope),
  );
  const { shared, RtNotation } = createRtServices({
    connection,
    ...EmptyFileSystem,
  });
  connection.onNotification(
    STRUCTURE_NOTIFICATION,
    async (record: RtStructureRecord) => {
      RtNotation.structure.Structure.set(record);
      const uris = shared.workspace.LangiumDocuments.all
        .map((document) => document.uri)
        .toArray();
      // re-validates the open documents against the new structure
      await shared.workspace.DocumentBuilder.update(uris, []);
    },
  );
  startLanguageServer(shared);
};
