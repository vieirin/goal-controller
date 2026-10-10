/**
 * The language services each mode is served by (goal-controller#24, option
 * C2): the shared goal-language service for every dialect engine and for
 * piStar-ext, and the servers engines bring of their own, registered the
 * same way. The workbench's views take one `LanguageSupport`, the services'
 * multiplexed: an editor gets completion, hover and go-to-definition from
 * the first service that speaks its document; every service's diagnostics
 * go to one store (`diagnosticsStore`), merged with the workbench's own.
 */
import type { Extension } from '@codemirror/state';
import { ViewPlugin } from '@codemirror/view';
import type { LSPClient } from '@codemirror/lsp-client';
import type { AnyDialect, DefinitionContext } from '@goal-controller/dialect';
import { fieldUri } from '@goal-controller/goal-language/light';
import { serverProblems } from './diagnostics';
import { forgetDocument, publishDiagnostics } from './diagnosticsStore';
import {
  ENGINE_CHECKS,
  ENGINE_DIALECTS,
  type DialectEngine,
} from './engineDialects';
import { goalClient, onClientDiagnostics } from './goalLsp';
import { localLanguageSupport, type LanguageSupport } from './languageSupport';
import { serverLanguageSupport } from './serverLanguageSupport';
import { SOURCE } from './types';

/** A document a language service may speak. */
export type ServiceDocument =
  /** the model's Notation view document (`G1: Name [G2;G3]` + property lines) */
  | 'goal-notation'
  /** one element's property value (an inspector field) */
  | 'field'
  /** the model file itself (piStar JSON), as MutRoSe's server reads it */
  | 'pistar-json';

export type LanguageService = {
  /** the source of its diagnostics (the Problems panel's group) */
  id: string;
  /** the documents it speaks */
  documents: readonly ServiceDocument[];
  /**
   * How the workbench reaches it, for a dialect: a client of its server
   * (built with `serviceClient`, so its diagnostics reach the store), or a
   * support run in the page; null while it can't be reached (not used then).
   */
  transport: (definition: AnyDialect) => LSPClient | LanguageSupport | null;
  /** where its diagnostics say their element: in `data` (the contract), or only by range */
  anchoring: 'data' | 'range';
  /** the LSP language id its documents are opened with (default: its id) */
  languageId?: string;
};

/** A mode a model is served in: a dialect engine's, or piStar-ext's. */
export type ServiceMode = DialectEngine | 'pistarext';

// one local support per definition, for every view on the page
const local = new WeakMap<AnyDialect, LanguageSupport>();

/** The definition's engine checks (none for a dialect without an engine). */
const checksOf = (definition: AnyDialect) => {
  const engine = (Object.keys(ENGINE_DIALECTS) as DialectEngine[]).find(
    (e) => ENGINE_DIALECTS[e] === definition,
  );
  return engine ? ENGINE_CHECKS[engine] : {};
};

/**
 * The shared goal-language service: the worker's server when it runs, the
 * same language run in the page when it doesn't.
 */
export const GOAL_LANGUAGE: LanguageService = {
  id: SOURCE.language,
  documents: ['goal-notation', 'field'],
  anchoring: 'data',
  languageId: 'goal',
  transport: (definition) => {
    const client = goalClient();
    if (client) return client;
    let support = local.get(definition);
    if (!support) {
      support = localLanguageSupport(definition, checksOf(definition));
      local.set(definition, support);
    }
    return support;
  },
};

/**
 * The servers engines bring, by mode, after the shared one. None yet:
 * MutRoSe's (lsp-mutrose, rebuilt on Langium) comes from mutrose-vscode, as
 * `{ id: 'mutrose', documents: ['pistar-json'], anchoring: 'data',
 * transport: () => serviceClient(...) }`.
 */
const ENGINE_SERVICES: Partial<
  Record<ServiceMode, readonly LanguageService[]>
> = {};

/** The services a mode is served by, the shared one first. */
export const languageServicesFor = (
  mode: ServiceMode,
): readonly LanguageService[] => [
  GOAL_LANGUAGE,
  ...(ENGINE_SERVICES[mode] ?? []),
];

const isClient = (
  transport: LSPClient | LanguageSupport,
): transport is LSPClient => 'plugin' in transport;

/**
 * Keeps a document in sync with a server whose client has no editor on it
 * (lsp-client syncs one client per editor): opened with the editor's text,
 * changed with it, closed with it.
 */
const mirror = (client: LSPClient, uri: string, languageId: string) =>
  ViewPlugin.define((view) => {
    let version = 1;
    client.notification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId,
        version,
        text: view.state.doc.toString(),
      },
    });
    return {
      update(update) {
        if (!update.docChanged) return;
        version += 1;
        client.notification('textDocument/didChange', {
          textDocument: { uri, version },
          contentChanges: [{ text: update.state.doc.toString() }],
        });
      },
      destroy() {
        client.notification('textDocument/didClose', {
          textDocument: { uri },
        });
      },
    };
  });

/** What a server publishes for a document, into the store as the service's. */
const listen = (
  client: LSPClient,
  service: LanguageService,
  definition: AnyDialect,
  // the elements the model has, by key: a Notation line's element under its goal
  has: (key: string) => boolean,
) =>
  onClientDiagnostics(client, (params) =>
    publishDiagnostics(
      service.id,
      params.uri,
      serverProblems(
        params,
        service,
        definition,
        client.workspace.getFile(params.uri)?.doc.toString(),
        has,
      ),
    ),
  );

/** A support for one service: a server's (diagnostics to the store), or the page's own. */
const supportOf = (
  service: LanguageService,
  definition: AnyDialect,
  transport: LSPClient | LanguageSupport,
  has: (key: string) => boolean,
): LanguageSupport => {
  if (!isClient(transport)) return transport;
  listen(transport, service, definition, has);
  return service === GOAL_LANGUAGE
    ? serverLanguageSupport(definition, transport)
    : engineServerSupport(transport, service.languageId ?? service.id);
};

/**
 * An engine's own server: its documents opened as its language, no goal
 * context (it reads the model itself), the model file kept in sync.
 */
const engineServerSupport = (
  client: LSPClient,
  languageId: string,
): LanguageSupport => {
  let version = 0;
  const MODEL = 'file:///model.json';
  return {
    documentExtension: (uri) => client.plugin(uri, languageId),
    fieldExtension: (elementId, key) =>
      client.plugin(fieldUri(elementId, key), languageId),
    setContext: () => {},
    setSaved: () => {},
    setModelText: (text) => {
      version += 1;
      const at = version;
      void client.initializing.then(() =>
        client.notification(
          at === 1 ? 'textDocument/didOpen' : 'textDocument/didChange',
          at === 1
            ? { textDocument: { uri: MODEL, languageId, version: at, text } }
            : {
                textDocument: { uri: MODEL, version: at },
                contentChanges: [{ text }],
              },
        ),
      );
    },
  };
};

/**
 * The services' supports as one: an editor's features from the first service
 * that speaks its document, the others kept in sync with it (servers) so
 * their diagnostics reach the store too; the context and the model to every
 * service.
 */
export const multiplexSupport = (
  definition: AnyDialect,
  services: readonly LanguageService[],
): LanguageSupport => {
  // the context last given: its elements are the model's, by key
  let elements: DefinitionContext['elements'] = {};
  const has = (key: string) => key in elements;
  const served = services.flatMap((service) => {
    const transport = service.transport(definition);
    return transport
      ? [
          {
            service,
            transport,
            support: supportOf(service, definition, transport, has),
          },
        ]
      : [];
  });
  const speaking = (document: ServiceDocument) =>
    served.filter(({ service }) => service.documents.includes(document));
  /** The first speaker's extension, the other servers mirroring the document. */
  const editor = (
    document: ServiceDocument,
    uri: string,
    first: (support: LanguageSupport) => Extension,
  ): Extension => {
    const [lead, ...others] = speaking(document);
    return [
      lead ? first(lead.support) : [],
      ...others.flatMap(({ service, transport }) =>
        isClient(transport)
          ? [mirror(transport, uri, service.languageId ?? service.id)]
          : [],
      ),
      ViewPlugin.define(() => ({ destroy: () => forgetDocument(uri) })),
    ];
  };
  return {
    documentExtension: (uri) =>
      editor('goal-notation', uri, (support) => support.documentExtension(uri)),
    fieldExtension: (elementId, key) =>
      editor('field', fieldUri(elementId, key), (support) =>
        support.fieldExtension(elementId, key),
      ),
    setContext: (context) => {
      elements = context.elements;
      served.forEach(({ support }) => support.setContext(context));
    },
    setSaved: (saved) =>
      served.forEach(({ support }) => support.setSaved(saved)),
    setModelText: (text) =>
      speaking('pistar-json').forEach(({ support }) =>
        support.setModelText?.(text),
      ),
  };
};
