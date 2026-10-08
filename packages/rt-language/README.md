# @goal-controller/rt-language

The RT goal notation (`G1: Name [G2;G3@2->T4]`) as a Langium language: one grammar for the edgeLangium engine's parser and for the notation view's language server. See the root README, "EdgeLangium engine and the notation view".

## Entries

| import | format | contents |
| --- | --- | --- |
| `@goal-controller/rt-language` | ESM + CJS bundle (langium inlined) | `parseNodeText`, `exprText`, the constructs |
| `…/constructs` | ESM, langium-free | `CONSTRUCT_LABEL`, `CONSTRUCT_HELP`, `RT_OPERATORS` |
| `…/structure` | ESM, langium-free | the `rt/structure` notification and its messages |
| `…/lsp` | ESM | `createRtServices`: validation, completion, hover |
| `…/worker` | ESM, browser only | `startRtWorkerServer` |

The CJS bundle exists because Langium 4 is ESM-only and goal-tree/lib are CommonJS.

## Changing the grammar

1. Edit `src/rt-notation.langium`. Tokenization is done by `src/lexer.ts`, which replays ANTLR's longest-match rule: if you add a token, add it to its `RULES` list too, in ANTLR's definition order.
2. Regenerate the AST and grammar modules, and commit `src/generated/`:

   ```sh
   pnpm --filter @goal-controller/rt-language run generate   # langium generate
   ```

3. Build and test:

   ```sh
   pnpm run build:goal-tree   # builds rt-language first
   pnpm test                  # includes the differential test against ANTLR edgeV2
   ```
