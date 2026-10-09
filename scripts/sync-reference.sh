#!/usr/bin/env bash
# Pins the reference files the engine definitions are checked against: the
# hand-written Langium notation branch (vn/rt-langium-notation) at one commit,
# read with `git show` only (the branch is never checked out or changed).
# Imports are rewritten to the local copies (or the built workspace packages).
#
#   scripts/sync-reference.sh [out-dir]   (default: packages/lib/test/dialect/reference)
set -euo pipefail

COMMIT=b61def8ba1db68fc42910a20a3b51373add88f01
REPO=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
OUT=${1:-$REPO/packages/lib/test/dialect/reference}
mkdir -p "$OUT"

show() { git -C "$REPO" show "$COMMIT:$1"; }
header() { printf '// Pinned from vn/rt-langium-notation @ %s: %s\n// (scripts/sync-reference.sh; do not edit)\n' "${COMMIT:0:7}" "$1"; }

for file in constructs.ts properties.ts context.ts; do
  {
    header "packages/rt-language/src/$file"
    show "packages/rt-language/src/$file" | sed -e "s#from './constructs.js'#from './constructs'#"
  } > "$OUT/$file"
done
show packages/rt-language/src/rt-notation.langium > "$OUT/rt-notation.langium"

{
  header packages/ui/lib/workbench/notation.ts
  show packages/ui/lib/workbench/notation.ts | sed \
    -e "s#from '@goal-controller/rt-language/context'#from './context'#" \
    -e "s#from '@goal-controller/rt-language/properties'#from './properties'#"
} > "$OUT/notation.ts"

# notation.ts reads composeNodeText from the UI's pistar.ts: only that function
{
  header 'packages/ui/lib/workbench/pistar.ts (composeNodeText)'
  show packages/ui/lib/workbench/pistar.ts | awk '
    /^export const composeNodeText = \(/ { on = 1 }
    on { print }
    on && /^};$/ { exit }'
} > "$OUT/pistar.ts"

{
  header packages/ui/lib/workbench/edgeProperties.ts
  show packages/ui/lib/workbench/edgeProperties.ts | sed \
    -e "s#from '@goal-controller/lib'#from '../../../src'#"
} > "$OUT/edgeProperties.ts"

cat > "$OUT/REFERENCE.md" <<MD
# Reference files

Pinned from \`vn/rt-langium-notation\` @ \`$COMMIT\` (the hand-written
Langium notation, the reference result the engine definitions are checked
against) by:

    scripts/sync-reference.sh

| file | from |
| --- | --- |
| constructs.ts, properties.ts, context.ts, rt-notation.langium | packages/rt-language/src/ |
| notation.ts, edgeProperties.ts | packages/ui/lib/workbench/ |
| pistar.ts | packages/ui/lib/workbench/pistar.ts (composeNodeText only) |

Imports are rewritten to these copies, or to lib's own source
(\`packages/lib/src\`); \`@goal-controller/goal-tree\` resolves from lib. Do not
edit them: a mismatch is fixed in the definition, not here.
\`test/dialect/harness.test.ts\` checks that re-running the script gives these
files unchanged.
MD
