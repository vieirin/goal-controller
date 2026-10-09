/**
 * The slot an engine's language tooling plugs into, for the Notation view and the
 * inspector's value fields. Shaped so a `@codemirror/lsp-client` LSPClient fits it
 * directly (`documentExtension` = `client.plugin(uri, languageId)`, `setContext` = the
 * context notification). Without one, `localLanguageSupport` derives highlighting,
 * lint and completion from the engine's definition.
 */
import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { forceLinting, linter, type Diagnostic } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import {
  completionsAt,
  documentDiagnostics,
  fieldCompletionsAt,
  fieldDiagnostics,
  propertyOf,
  valueOf,
  type CompletionResult as DefinitionCompletions,
  type DefinitionContext,
  type AnyDialect,
  type RunCheck,
} from '@goal-controller/dialect';
import type { Check } from '@goal-controller/lib';
import { documentLanguage, valueLanguage } from './definitionLanguage';

export type { DefinitionContext };

export type LanguageSupport = {
  /** the Notation view's document (`client.plugin(uri, languageId)`) */
  documentExtension(uri: string): Extension;
  /** an inspector field: one element's property value */
  fieldExtension(elementId: string, key: string): Extension;
  /** what the text is checked against (the context notification) */
  setContext(context: DefinitionContext): void;
};

/** What the engine's grammar said of each saved element line, by id. */
export type SavedLines = Readonly<
  Record<string, { line: string; error: string | null }>
>;

export type LocalLanguageSupport = LanguageSupport & {
  /** the view's grammar errors (a language server reads them itself) */
  setSaved(saved: SavedLines): void;
};

const EMPTY: DefinitionContext = { elements: {}, variables: [] };

const toCodeMirror = (
  result: DefinitionCompletions | null,
): CompletionResult | null =>
  result && {
    from: result.from,
    options: result.options.map(({ label, type, detail }) => ({
      label,
      type,
      detail,
    })),
    validFor: /^[A-Za-z0-9_.]*$/,
  };

/**
 * The language support an engine's definition gives without a server: its document
 * language, lint (the problems and named checks it declares) and completion.
 */
export const localLanguageSupport = (
  definition: AnyDialect,
  checks: Readonly<Record<string, Check>>,
): LocalLanguageSupport => {
  let context = EMPTY;
  let saved: SavedLines = {};
  // what an engine check may ask of another element (a quality is a goal to no check)
  const kindOf = (id: string) => {
    const kind = context.elements[id]?.kind;
    return kind === 'goal' || kind === 'task' || kind === 'resource'
      ? kind
      : undefined;
  };
  const runCheck: RunCheck = (name, properties, self) =>
    checks[name]?.(properties, { self, kindOf }) ?? null;
  // the views linted against the context, relinted when it changes (a view
  // registers on its first lint, and is dropped once it left the page)
  const views = new Set<EditorView>();
  const refresh = () =>
    views.forEach((view) =>
      view.dom.isConnected ? forceLinting(view) : views.delete(view),
    );
  const lintWith = (diagnose: (view: EditorView) => Diagnostic[]): Extension =>
    linter(
      (view) => {
        views.add(view);
        return diagnose(view);
      },
      { delay: 250 },
    );

  return {
    documentExtension: () => [
      documentLanguage(definition),
      lintWith((view) =>
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
        initial ? valueLanguage(definition, initial) : [],
        lintWith((view) =>
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
            (completion: CompletionContext) => {
              const config = value();
              return config
                ? toCodeMirror(
                    fieldCompletionsAt(
                      definition,
                      config,
                      completion.state.doc.toString(),
                      completion.pos,
                      context,
                    ),
                  )
                : null;
            },
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
