/**
 * The goal language's server: Langium's LSP services over the one grammar,
 * with everything a dialect decides taken from the `goal/context` a client
 * sends (the dialect as data, and the model). The features are the ones the
 * local support has (src/notation): the same diagnostics, completion, hover
 * and definitions, from the same functions.
 *
 * Named checks are code, not data: a host that has them (the workbench's
 * worker has lib's registries) passes them by dialect id, and the server runs
 * them as the local support does.
 */
import {
  DefaultLangiumDocumentFactory,
  EmptyFileSystem,
  inject,
  URI,
  type AstNode,
  type LangiumDocument,
  type Module,
  type ParseResult,
  type ParserOptions,
} from 'langium';
import {
  createDefaultModule,
  createDefaultSharedModule,
  DefaultCompletionProvider,
  DefaultDefinitionProvider,
  DefaultDocumentUpdateHandler,
  AstNodeHoverProvider,
  type DefaultSharedModuleContext,
  type LangiumServices,
  type LangiumSharedServices,
  type PartialLangiumServices,
  type PartialLangiumSharedServices,
} from 'langium/lsp';
import {
  CompletionItemKind,
  DiagnosticSeverity,
  LocationLink,
  type CancellationToken,
  type CompletionList,
  type CompletionParams,
  type DefinitionParams,
  type Diagnostic as LspDiagnostic,
  type Hover,
  type HoverParams,
  type TextDocumentChangeEvent,
} from 'vscode-languageserver';
import type { TextDocument } from 'langium';
import {
  hasIds,
  propertyOf,
  valueOf,
  type AnyDialect,
  type DefinitionContext,
} from '@goal-controller/dialect';
import {
  GoalGeneratedModule,
  GoalGeneratedSharedModule,
} from '../generated/module.js';
import type { LexerStart } from '../lexer.js';
import { GoalCoreModule, parseWith } from '../module.js';
import { syntaxErrorsOf } from '../parse.js';
import {
  completionsAt,
  fieldCompletionsAt,
  type Completion,
  type CompletionResult,
} from '../notation/completion.js';
import {
  documentDiagnostics,
  fieldDiagnostics,
  type Diagnostic,
  type RunCheck,
} from '../notation/diagnostics.js';
import { definitionAt, hoverAt } from '../notation/navigation.js';
import {
  readFieldUri,
  GOAL_CONTEXT_NOTIFICATION,
  type GoalContextParams,
} from './protocol.js';

/** An engine's named check, as lib implements it. */
export type NamedCheck = (
  properties: Readonly<Record<string, string>>,
  context: {
    self: string;
    kindOf: (id: string) => 'goal' | 'task' | 'resource' | undefined;
  },
) => string | null;

/** The named checks a host has, by dialect id, then by check name. */
export type CheckRegistries = Readonly<
  Record<string, Readonly<Record<string, NamedCheck>>>
>;

/** The dialect and model each document is checked against. */
export class GoalContextStore {
  private readonly byUri = new Map<string, GoalContextParams>();
  private fallback: GoalContextParams | undefined;

  set(params: GoalContextParams): void {
    if (params.uri) this.byUri.set(params.uri, params);
    else this.fallback = params;
  }

  for(uri: URI | string): GoalContextParams | undefined {
    return this.byUri.get(uri.toString()) ?? this.fallback;
  }
}

/** How a document is read: a field with its property's value type, else a document. */
const startOf = (
  uri: URI,
  params: GoalContextParams | undefined,
): LexerStart => {
  const field = readFieldUri(uri.toString());
  if (!field)
    return !params || hasIds(params.dialect) ? 'document' : 'plainDocument';
  const element = params?.context.elements[field.id];
  const property =
    params && element && propertyOf(params.dialect, element.kind, field.key);
  return property ? valueOf(property, element.properties).type : 'text';
};

const SEVERITY = {
  error: DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  info: DiagnosticSeverity.Information,
} as const;

const KIND = {
  variable: CompletionItemKind.Reference,
  keyword: CompletionItemKind.Keyword,
  property: CompletionItemKind.Property,
} as const satisfies Record<Completion['type'], CompletionItemKind>;

export type GoalLspServices = LangiumServices;

/**
 * The server's services. `connection` is optional (a test builds documents
 * without one); `checks` are the host's named checks.
 */
export const createGoalLspServices = (
  context: DefaultSharedModuleContext = EmptyFileSystem,
  { checks = {} }: { checks?: CheckRegistries } = {},
): {
  shared: LangiumSharedServices;
  Goal: GoalLspServices;
  store: GoalContextStore;
} => {
  const store = new GoalContextStore();

  /** The checks of a dialect, as the notation functions run them. */
  const runCheckFor = (
    dialect: AnyDialect,
    model: DefinitionContext,
  ): RunCheck => {
    const registry = checks[dialect.id] ?? {};
    const kindOf = (id: string) => {
      const kind = model.elements[id]?.kind;
      return kind === 'goal' || kind === 'task' || kind === 'resource'
        ? kind
        : undefined;
    };
    return (name, properties, self) =>
      registry[name]?.(properties, { self, kindOf }) ?? null;
  };

  class GoalDocumentFactory extends DefaultLangiumDocumentFactory {
    protected override parse<T extends AstNode>(
      uri: URI,
      text: string,
      _options?: ParserOptions,
    ): ParseResult<T> {
      return parseWith<T>(
        this.serviceRegistry.getServices(uri),
        startOf(uri, store.for(uri)),
        text,
      );
    }

    protected override parseAsync<T extends AstNode>(
      uri: URI,
      text: string,
      _token: CancellationToken,
    ): Promise<ParseResult<T>> {
      return Promise.resolve(this.parse<T>(uri, text));
    }
  }

  /** Forgets a closed document: the server holds no files to re-read it from. */
  class GoalDocumentUpdateHandler extends DefaultDocumentUpdateHandler {
    didCloseDocument(event: TextDocumentChangeEvent<TextDocument>): void {
      void this.workspaceLock.write((token) =>
        this.documentBuilder.update([], [URI.parse(event.document.uri)], token),
      );
    }
  }

  const toLsp = (
    document: LangiumDocument,
    diagnostics: Diagnostic[],
  ): LspDiagnostic[] =>
    diagnostics.map(({ from, to, severity, message }) => ({
      range: {
        start: document.textDocument.positionAt(from),
        end: document.textDocument.positionAt(to),
      },
      severity: SEVERITY[severity],
      message,
      source: 'goal',
    }));

  /** The diagnostics of a document: the dialect's, or syntax errors without one. */
  const diagnose = (document: LangiumDocument): LspDiagnostic[] => {
    const params = store.for(document.uri);
    const text = document.textDocument.getText();
    if (!params)
      return toLsp(
        document,
        syntaxErrorsOf(document.parseResult, text.length).map((error) => ({
          from: error.offset,
          to: error.offset + Math.max(error.length, 1),
          severity: 'error',
          message: error.message,
        })),
      );
    const { dialect, context: model } = params;
    const runCheck = runCheckFor(dialect, model);
    const field = readFieldUri(document.uri.toString());
    return toLsp(
      document,
      field
        ? fieldDiagnostics(dialect, model, field.id, field.key, text, runCheck)
        : documentDiagnostics(dialect, text, model, { runCheck }),
    );
  };

  class GoalCompletionProvider extends DefaultCompletionProvider {
    override readonly completionOptions = {
      triggerCharacters: [
        '[',
        ';',
        '|',
        '?',
        '+',
        '#',
        '>',
        '<',
        '{',
        '=',
        ',',
        '(',
      ],
    };

    override async getCompletion(
      document: LangiumDocument,
      params: CompletionParams,
    ): Promise<CompletionList | undefined> {
      const found = store.for(document.uri);
      if (!found) return undefined;
      const { dialect, context: model } = found;
      const text = document.textDocument.getText();
      const offset = document.textDocument.offsetAt(params.position);
      const field = readFieldUri(document.uri.toString());
      let result: CompletionResult | null;
      if (field) {
        const element = model.elements[field.id];
        const property =
          element && propertyOf(dialect, element.kind, field.key);
        result = property
          ? fieldCompletionsAt(
              dialect,
              valueOf(property, element.properties),
              text,
              offset,
              model,
            )
          : null;
      } else result = completionsAt(dialect, text, offset, model);
      if (!result) return undefined;
      const range = {
        start: document.textDocument.positionAt(result.from),
        end: params.position,
      };
      return {
        isIncomplete: false,
        items: result.options.map((option, i) => ({
          label: option.label,
          kind: KIND[option.type],
          detail: option.detail,
          sortText: String(i).padStart(4, '0'),
          textEdit: { range, newText: option.label },
        })),
      };
    }
  }

  class GoalHoverProvider extends AstNodeHoverProvider {
    override async getHoverContent(
      document: LangiumDocument,
      params: HoverParams,
    ): Promise<Hover | undefined> {
      const found = store.for(document.uri);
      if (!found || readFieldUri(document.uri.toString())) return undefined;
      const hover = hoverAt(
        found.dialect,
        document.textDocument.getText(),
        document.textDocument.offsetAt(params.position),
        found.context,
      );
      return hover
        ? {
            contents: { kind: 'markdown', value: hover.markdown },
            range: {
              start: document.textDocument.positionAt(hover.from),
              end: document.textDocument.positionAt(hover.to),
            },
          }
        : undefined;
    }

    protected override getAstNodeHoverContent(): string | undefined {
      return undefined;
    }
  }

  class GoalDefinitionProvider extends DefaultDefinitionProvider {
    /** set from the client's capabilities: CodeMirror's client reads Locations */
    linkSupport = true;

    override async getDefinition(
      document: LangiumDocument,
      params: DefinitionParams,
    ): Promise<LocationLink[] | undefined> {
      const found = store.for(document.uri);
      if (!found || readFieldUri(document.uri.toString())) return undefined;
      const offset = document.textDocument.offsetAt(params.position);
      const target = definitionAt(
        found.dialect,
        document.textDocument.getText(),
        offset,
      );
      if (!target) return undefined;
      const range = {
        start: document.textDocument.positionAt(target.from),
        end: document.textDocument.positionAt(target.to),
      };
      const uri = document.uri.toString();
      // LSP allows Location[] for a client without link support
      return this.linkSupport
        ? [LocationLink.create(uri, range, range)]
        : ([{ uri, range }] as unknown as LocationLink[]);
    }
  }

  const shared = inject(
    createDefaultSharedModule(context),
    GoalGeneratedSharedModule,
    {
      workspace: {
        LangiumDocumentFactory: (services) => new GoalDocumentFactory(services),
      },
      lsp: {
        DocumentUpdateHandler: (services) =>
          new GoalDocumentUpdateHandler(services),
      },
    } satisfies Module<LangiumSharedServices, PartialLangiumSharedServices>,
  );
  const Goal = inject(
    createDefaultModule({ shared }),
    GoalGeneratedModule,
    GoalCoreModule as Module<GoalLspServices, PartialLangiumServices>,
    {
      validation: {
        DocumentValidator: () => ({
          validateDocument: async (document: LangiumDocument) =>
            diagnose(document),
        }),
      },
      lsp: {
        CompletionProvider: (services) => new GoalCompletionProvider(services),
        HoverProvider: (services) => new GoalHoverProvider(services),
        DefinitionProvider: (services) => new GoalDefinitionProvider(services),
      },
    } as Module<GoalLspServices, PartialLangiumServices>,
  );
  shared.ServiceRegistry.register(Goal);
  shared.lsp.LanguageServer?.onInitialize((params) => {
    const definitions = Goal.lsp.DefinitionProvider;
    if (definitions instanceof GoalDefinitionProvider)
      definitions.linkSupport =
        params.capabilities.textDocument?.definition?.linkSupport ?? false;
  });
  return { shared, Goal, store };
};

/**
 * Takes `goal/context` notifications on a connection: each re-reads and
 * re-validates the open documents (a context changes how a field is read).
 */
export const listenForContext = (
  connection: NonNullable<DefaultSharedModuleContext['connection']>,
  shared: LangiumSharedServices,
  store: GoalContextStore,
): void => {
  connection.onNotification(
    GOAL_CONTEXT_NOTIFICATION,
    async (params: GoalContextParams) => {
      store.set(params);
      const uris = shared.workspace.TextDocuments.all().map((document) =>
        URI.parse(document.uri),
      );
      await shared.workspace.DocumentBuilder.update(uris, []);
    },
  );
};

/**
 * The diagnostics the server publishes for a text at a URI, as offsets (no
 * connection needed: what a client would see, for tests and hosts).
 */
export const serverDiagnostics = async (
  shared: LangiumSharedServices,
  uri: string,
  text: string,
): Promise<Diagnostic[]> => {
  const { LangiumDocumentFactory, LangiumDocuments, DocumentBuilder } =
    shared.workspace;
  const parsed = URI.parse(uri);
  if (LangiumDocuments.hasDocument(parsed))
    LangiumDocuments.deleteDocument(parsed);
  const document = LangiumDocumentFactory.fromString(text, parsed);
  LangiumDocuments.addDocument(document);
  await DocumentBuilder.build([document], { validation: true });
  const severity = (s: DiagnosticSeverity | undefined) =>
    s === DiagnosticSeverity.Warning
      ? 'warning'
      : s === DiagnosticSeverity.Information
        ? 'info'
        : 'error';
  const diagnostics = (document.diagnostics ?? []).map((d) => ({
    from: document.textDocument.offsetAt(d.range.start),
    to: document.textDocument.offsetAt(d.range.end),
    severity: severity(d.severity),
    message: typeof d.message === 'string' ? d.message : d.message.value,
  })) satisfies Diagnostic[];
  LangiumDocuments.deleteDocument(parsed);
  return diagnostics;
};
