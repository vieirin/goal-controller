/// <reference lib="webworker" />
import { EmptyFileSystem } from 'langium';
import { startLanguageServer } from 'langium/lsp';
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
} from 'vscode-languageserver/browser';
import { createRtServices } from './lsp.js';

/** Runs the RT language server inside a Web Worker, talking LSP over postMessage. */
export const startRtWorkerServer = (
  scope: DedicatedWorkerGlobalScope,
): void => {
  const connection = createConnection(
    new BrowserMessageReader(scope),
    new BrowserMessageWriter(scope),
  );
  const { shared } = createRtServices({ connection, ...EmptyFileSystem });
  startLanguageServer(shared);
};
