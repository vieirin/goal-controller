# Reference files

Pinned from `vn/rt-langium-notation` @ `b61def8ba1db68fc42910a20a3b51373add88f01` (the hand-written
Langium notation, the reference result the engine definitions are checked
against) by:

    scripts/sync-reference.sh

| file | from |
| --- | --- |
| constructs.ts, properties.ts, context.ts, rt-notation.langium | packages/rt-language/src/ |
| notation.ts, edgeProperties.ts | packages/ui/lib/workbench/ |
| pistar.ts | packages/ui/lib/workbench/pistar.ts (composeNodeText only) |

Imports are rewritten to these copies, or to the built workspace packages
(`packages/goal-tree/out`, `packages/lib/out`). Do not edit them: a mismatch
is fixed in the definition, not here. `test/harness.test.ts` checks that
re-running the script gives these files unchanged.
