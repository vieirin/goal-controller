# @goal-controller/rt-language

The RT goal notation (`G1: Name [G2;G3@2->T4]`) as a Langium language: one grammar for the edgeLangium engine's parser and for the notation view's language server. See the root README, "EdgeLangium engine and the notation view".

## Entries

| import | format | contents |
| --- | --- | --- |
| `@goal-controller/rt-language` | ESM + CJS bundle (langium inlined) | `parseNodeText`, `parseAssertion`, `exprText`, the constructs |
| `…/constructs` | ESM, langium-free | `CONSTRUCT_LABEL`, `CONSTRUCT_HELP`, `RT_OPERATORS`, `CONSTRUCT_RELATION`, `relationMismatch` |
| `…/context` | ESM, langium-free | the `rt/context` notification, its messages and `NOTATION_SEVERITY` |
| `…/properties` | ESM, langium-free | property keys and help, and the property-line and resource-declaration helpers |
| `…/lsp` | ESM | `createRtServices`: validation, completion, hover |
| `…/worker` | ESM, browser only | `startRtWorkerServer` |

The CJS bundle exists because Langium 4 is ESM-only and goal-tree/lib are CommonJS.

## Changing the grammar

1. Edit `src/rt-notation.langium`. Tokenization is done by `src/lexer.ts`, which replays ANTLR's longest-match rule and switches token sets per line kind (RT text, an assertion, a dependsOn list, a raw value, a resource declaration). If you add a token, add it to the matching rules list too, in ANTLR's definition order.
   - The property-line and declaration syntax also lives in `src/properties.ts` (langium-free, for the UI). `test/language.test.ts` checks that both agree.
2. Regenerate the AST and grammar modules, and commit `src/generated/`:

   ```sh
   pnpm --filter @goal-controller/rt-language run generate   # langium generate
   ```

3. Build and test:

   ```sh
   pnpm run build:goal-tree   # builds rt-language first
   pnpm test                  # includes the differential test against ANTLR edgeV2
   ```

## Documents the language server reads

- `*.rt`: the whole-model notation document (the Notation view).
- `…/fields/<element id>/<property key>.rtp`: one property value (an inspector field), parsed with that value's rule and checked with the element's other properties from `rt/context`.
