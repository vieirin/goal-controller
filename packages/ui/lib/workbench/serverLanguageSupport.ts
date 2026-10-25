/**
 * The language support a goal language server gives (lib/workbench/goalLsp):
 * diagnostics, completion, hover and go-to-definition (F12) from the server,
 * for a dialect it is told about in `goal/context`. Highlighting stays the
 * goal language's tokens, on the client. A `notInDiagram` diagnostic's quick
 * fix (goal-controller#440) renders as a lint tooltip action, next to it.
 */
import {
  setDiagnostics,
  type Diagnostic as LintDiagnostic,
} from '@codemirror/lint';
import type { LSPClient } from '@codemirror/lsp-client';
import type { Text } from '@codemirror/state';
import { ViewPlugin } from '@codemirror/view';
import {
  valueOf,
  type AnyDialect,
  type DefinitionContext,
} from '@goal-controller/dialect';
import { propertyOf } from '@goal-controller/goal-language';
import type { GoalCodeActionData } from '@goal-controller/goal-language/light';
import type { ActionDispatcher } from '@istar-ts/actions';
import type { AnyModel } from '@goal-controller/lib';
import { applyCodeAction, canApplyCodeAction } from './codeActions';
import { documentLanguage, valueLanguage } from './definitionLanguage';
import {
  goalFieldUri,
  onClientDiagnostics,
  requestCodeActions,
  sendGoalContext,
  type PublishedDiagnostics,
} from './goalLsp';
import type { LanguageSupport, SavedLines } from './languageSupport';

const LINT_SEVERITY = {
  1: 'error',
  2: 'warning',
  3: 'info',
  4: 'info',
} as const;

/** Who a quick fix dispatches through, and the model it checks it against (fresh each use). */
export type CodeActionDispatch = () => {
  dispatcher: ActionDispatcher<string, string>;
  model: AnyModel;
} | null;

/**
 * A document's diagnostics as lint ones, each with the action its code
 * action names, when it has one `dispatch()` can apply right now
 * (`canApplyCodeAction`; a stale owner or a kind that can't be on paper
 * gets none, rather than a fix that fails, goal-controller#440).
 */
export const codeActionDiagnostics = async (
  doc: Text,
  diagnostics: PublishedDiagnostics['diagnostics'],
  requestActions: (
    range: PublishedDiagnostics['diagnostics'][number]['range'],
  ) => Promise<GoalCodeActionData[]>,
  dispatch: CodeActionDispatch,
): Promise<LintDiagnostic[]> => {
  const found = await Promise.all(
    diagnostics.map(async (d) => ({
      d,
      actions: await requestActions(d.range),
    })),
  );
  return found.map(({ d, actions }) => ({
    from: doc.line(d.range.start.line + 1).from + d.range.start.character,
    to: doc.line(d.range.end.line + 1).from + d.range.end.character,
    severity: LINT_SEVERITY[(d.severity ?? 1) as 1 | 2 | 3 | 4],
    message: d.message,
    actions: actions.flatMap((data) => {
      const now = dispatch();
      if (!now || !canApplyCodeAction(now.model, data)) return [];
      return [
        {
          name: 'Add in the diagram',
          apply: () => {
            const current = dispatch();
            if (current)
              void applyCodeAction(current.dispatcher, current.model, data);
          },
        },
      ];
    }),
  }));
};

/** Renders each `notInDiagram` diagnostic's quick fix as a lint tooltip action. */
const codeActionsExtension = (
  client: LSPClient,
  uri: string,
  dispatch: CodeActionDispatch,
) =>
  ViewPlugin.define((view) => {
    const unsubscribe = onClientDiagnostics(client, (params) => {
      if (params.uri !== uri) return;
      void codeActionDiagnostics(
        view.state.doc,
        params.diagnostics,
        (range) => requestCodeActions(client, uri, range),
        dispatch,
      ).then((diagnostics) => {
        view.dispatch(setDiagnostics(view.state, diagnostics));
      });
    });
    return { destroy: unsubscribe };
  });

export const serverLanguageSupport = (
  definition: AnyDialect,
  client: LSPClient,
): LanguageSupport => {
  let context: DefinitionContext = { elements: {}, variables: [] };
  let saved: SavedLines = {};
  let dispatch: {
    dispatcher: ActionDispatcher<string, string>;
    model: () => AnyModel;
  } | null = null;
  return {
    documentExtension: (uri) => [
      documentLanguage(definition),
      client.plugin(uri, 'goal'),
      codeActionsExtension(client, uri, () => {
        const current = dispatch;
        return (
          current && {
            dispatcher: current.dispatcher,
            model: current.model(),
          }
        );
      }),
    ],
    fieldExtension: (elementId, key) => {
      const element = context.elements[elementId];
      const property = element && propertyOf(definition, element.kind, key);
      const value = property && valueOf(property, element.properties);
      return [
        value ? valueLanguage(value) : [],
        client.plugin(goalFieldUri(elementId, key), 'goal'),
      ];
    },
    setContext: (next) => {
      context = next;
      sendGoalContext(client, [definition, next, saved], () => ({
        dialect: definition,
        context: next,
        saved,
      }));
    },
    // sent with the next context (the hook sets both, the saved lines first)
    setSaved: (next) => {
      saved = next;
    },
    setDispatch: (dispatcher, model) => {
      dispatch = { dispatcher, model };
    },
  };
};
