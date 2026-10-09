/**
 * The slot an engine's language tooling plugs into, for the Notation view and the
 * inspector's value fields. Shaped so a `@codemirror/lsp-client` LSPClient fits it
 * directly (`documentExtension` = `client.plugin(uri, languageId)`, `setContext` = the
 * context notification). Without one, `localLanguageSupport` derives highlighting,
 * lint and completion from the engine's definition.
 */
import {
  autocompletion,
  snippetCompletion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { forceLinting, linter } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import { ViewPlugin, type EditorView } from '@codemirror/view';
import {
  propertyOf,
  valueOf,
  type DefinitionContext,
  type AnyDialect,
  type CheckNameOf,
} from '@goal-controller/dialect';
import {
  checkContextOf,
  completionsAt,
  documentDiagnostics,
  fieldCompletions,
  fieldDiagnostics,
  type CompletionResult as DefinitionCompletions,
  type Diagnostic as LanguageDiagnostic,
  type RunCheck,
} from '@goal-controller/goal-language';
import { fieldUri } from '@goal-controller/goal-language/light';
import type { Check } from '@goal-controller/lib';
import { documentLanguage, valueLanguage } from './definitionLanguage';
import { languageProblems } from './diagnostics';
import { forgetDocument, publishDiagnostics } from './diagnosticsStore';
import { SOURCE } from './types';

export type { DefinitionContext };

export type LanguageSupport = {
  /** the Notation view's document (`client.plugin(uri, languageId)`) */
  documentExtension(uri: string): Extension;
  /** an inspector field: one element's property value */
  fieldExtension(elementId: string, key: string): Extension;
  /** what the text is checked against (the context notification) */
  setContext(context: DefinitionContext): void;
  /** the engine's grammar errors on the saved lines (sent with the context) */
  setSaved(saved: SavedLines): void;
  /** the model file's text, for a service that reads it (`pistar-json`) */
  setModelText?(text: string): void;
};

/** What the engine's grammar said of each saved element line, by id. */
export type SavedLines = Readonly<
  Record<string, { line: string; error: string | null }>
>;

const EMPTY: DefinitionContext = { elements: {}, variables: [] };

const toCodeMirror = (
  result: DefinitionCompletions | null,
): CompletionResult | null =>
  result && {
    from: result.from,
    ...(result.to !== undefined && { to: result.to }),
    options: result.options.map(({ label, type, detail, snippet }) =>
      snippet
        ? snippetCompletion(snippet, { label, type, detail })
        : { label, type, detail },
    ),
    validFor: /^[A-Za-z0-9_.]*$/,
  };

/**
 * An engine's named checks, run on a model: each is given its element and
 * the model (`checkContextOf`). The local support's, and the workbench's run
 * of the language on the model.
 */
export const runCheckIn =
  (
    // a property names its check: one of the definition's, so one of these
    checks: Readonly<Record<string, Check | undefined>>,
    model: () => DefinitionContext,
  ): RunCheck =>
  (name, properties, self) =>
    checks[name]?.(properties, checkContextOf(model(), self)) ?? null;

/**
 * The language support an engine's definition gives without a server: its document
 * language, lint (the problems and named checks it declares) and completion. What it
 * finds is published as the `service`'s diagnostics of each document.
 */
export const localLanguageSupport = <D extends AnyDialect>(
  definition: D,
  checks: Readonly<Record<CheckNameOf<D>, Check>>,
  service: string = SOURCE.language,
): LanguageSupport => {
  let context = EMPTY;
  let saved: SavedLines = {};
  const runCheck = runCheckIn(checks, () => context);
  // the views linted against the context, relinted when it changes (a view
  // registers on its first lint, and is dropped once it left the page)
  const views = new Set<EditorView>();
  const refresh = () =>
    views.forEach((view) =>
      view.dom.isConnected ? forceLinting(view) : views.delete(view),
    );
  // what a document's lint finds is published for it, and forgotten when its editor closes
  const lintWith = (
    document: string,
    diagnose: (view: EditorView) => LanguageDiagnostic[],
  ): Extension => [
    linter(
      (view) => {
        views.add(view);
        const found = diagnose(view);
        publishDiagnostics(
          service,
          document,
          languageProblems(found, definition.name),
        );
        return found;
      },
      { delay: 250 },
    ),
    ViewPlugin.define(() => ({ destroy: () => forgetDocument(document) })),
  ];

  return {
    documentExtension: (uri) => [
      documentLanguage(definition),
      lintWith(uri, (view) =>
        documentDiagnostics(definition, view.state.doc.toString(), context, {
          runCheck,
          saved,
        }),
      ),
      autocompletion({
        override: [
          (completion: CompletionContext) =>
            toCodeMirror(
              completionsAt(
                definition,
                completion.state.doc.toString(),
                completion.pos,
                context,
              ),
            ),
        ],
      }),
    ],
    fieldExtension: (elementId, key) => {
      const element = () => context.elements[elementId];
      const value = () => {
        const kind = element()?.kind;
        const property = kind && propertyOf(definition, kind, key);
        return property
          ? valueOf(property, element()?.properties ?? {})
          : undefined;
      };
      const initial = value();
      return [
        initial ? valueLanguage(initial) : [],
        lintWith(fieldUri(elementId, key), (view) =>
          fieldDiagnostics(
            definition,
            context,
            elementId,
            key,
            view.state.doc.toString(),
            runCheck,
          ),
        ),
        autocompletion({
          override: [
            (completion: CompletionContext) =>
              toCodeMirror(
                fieldCompletions(
                  definition,
                  context,
                  elementId,
                  key,
                  completion.state.doc.toString(),
                  completion.pos,
                ),
              ),
          ],
        }),
      ];
    },
    setContext: (next) => {
      context = next;
      refresh();
    },
    setSaved: (next) => {
      saved = next;
      refresh();
    },
  };
};
