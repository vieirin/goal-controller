# Reference files

Pinned from `vn/rt-langium-notation` @ `b61def8ba1db68fc42910a20a3b51373add88f01` (the hand-written
Langium notation, the reference result the engine definitions are checked
against) by:

    scripts/sync-reference.sh

| file | from |
| --- | --- |
| constructs.ts, properties.ts, context.ts, rt-notation.langium | packages/rt-language/src/ |
| notation.ts, edgeProperties.ts | packages/ui/lib/workbench/ |
| goalView.ts | written by the script: goal-tree's view with the reference's construct type |
| pistar.ts | packages/ui/lib/workbench/pistar.ts (composeNodeText only) |
| RTRegex.edge.g4, RTRegex.edgeV2.g4, AssertionRegex.g4 | packages/lib/grammar/ @ `44947643c925880d74deab1d39f2a08c9fd54a43` (the ANTLR grammars, removed) |

Imports are rewritten to these copies, or to lib's own source
(`packages/lib/src`); `@goal-controller/goal-tree` resolves from lib. Do not
edit them: a mismatch is fixed in the definition, not here.
`test/dialect/harness.test.ts` checks that re-running the script gives these
files unchanged.
