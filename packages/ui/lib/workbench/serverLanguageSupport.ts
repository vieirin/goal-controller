/**
 * The language support a goal language server gives (lib/workbench/goalLsp):
 * diagnostics, completion, hover and go-to-definition (F12) from the server,
 * for a dialect it is told about in `goal/context`. Highlighting stays the
 * goal language's tokens, on the client.
 */
import type { LSPClient } from '@codemirror/lsp-client';
import {
  propertyOf,
  valueOf,
  type AnyDialect,
  type DefinitionContext,
} from '@goal-controller/dialect';
import { documentLanguage, valueLanguage } from './definitionLanguage';
import { goalFieldUri, sendGoalContext } from './goalLsp';
import type { LanguageSupport, SavedLines } from './languageSupport';

export const serverLanguageSupport = (
  definition: AnyDialect,
  client: LSPClient,
): LanguageSupport => {
  let context: DefinitionContext = { elements: {}, variables: [] };
  let saved: SavedLines = {};
  return {
    documentExtension: (uri) => [
      documentLanguage(definition),
      client.plugin(uri, 'goal'),
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
  };
};
