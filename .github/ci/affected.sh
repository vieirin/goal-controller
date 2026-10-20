#!/usr/bin/env bash
# Whether a CI job has anything to check: prints `run=true` or `run=false`
# (appended to $GITHUB_OUTPUT when set) and the files that decided it.
#
# Usage: affected.sh <job>, job one of: test, prism, stress:<engine>
# Env:   CI_EVENT (github.event_name), CI_BASE, CI_HEAD (the commits to diff;
#        for a pull request its base and head, for a push `before` and the sha)
#
# The jobs stay required checks: a job with nothing to check runs this step
# and skips the rest, so it still reports success. Anything not listed below
# as skippable runs everything, so a new top-level path is checked by default.
set -euo pipefail

job="${1:?usage: affected.sh <test|prism|stress:engine>}"
ZERO=0000000000000000000000000000000000000000

decide() {
  echo "run=$1"
  [ -n "${GITHUB_OUTPUT:-}" ] && echo "run=$1" >>"$GITHUB_OUTPUT"
  exit 0
}

case "${CI_EVENT:-}" in
  pull_request | push) ;;
  *) echo "event '${CI_EVENT:-}': run everything"; decide true ;;
esac
if [ -z "${CI_BASE:-}" ] || [ "$CI_BASE" = "$ZERO" ] || ! git cat-file -e "$CI_BASE^{commit}" 2>/dev/null; then
  echo "no base commit to diff against: run everything"
  decide true
fi

base="$(git merge-base "$CI_BASE" "$CI_HEAD")"
files="$(git diff --name-only "$base" "$CI_HEAD")"

# The libraries every job builds and runs, and the build itself. An engine's
# own folder is not in here: each job names the engines it runs.
shared() {
  case "$1" in
    packages/lib/src/engines/*/*) return 1 ;;
    packages/lib/src/dialects/*) return 1 ;; # KAOS, NFR, piStar-ext: no job below runs them
    packages/dialect/src/* | packages/goal-language/src/* | packages/goal-tree/src/* | packages/lib/src/*) return 0 ;;
    packages/goal-language/langium-config.json | packages/*/build.mjs | packages/lib/scripts/*) return 0 ;;
    packages/*/package.json | packages/*/tsconfig.json) return 0 ;;
    package.json | pnpm-lock.yaml | pnpm-workspace.yaml | tsconfig.base.json | tsconfig.json) return 0 ;;
    .github/ci/*) return 0 ;;
  esac
  return 1
}

# Paths no test reads: a change only there doesn't run `test`.
untested() {
  case "$1" in
    README.md | metrics.csv | nodemon.json | Makefile | vercel.json) return 0 ;;
    docs/* | experiments/* | docker/* | result_plots/* | dissertationExamples/* | old_examples/*) return 0 ;;
    logs/* | output/* | hooks/* | .vscode/* | .devcontainer/* | .cursor/* | .vercel/*) return 0 ;;
    .github/workflows/stress.yaml | .github/workflows/prism-test.yaml | .github/workflows/pages.yaml) return 0 ;;
    # the stress scripts no test requires (lib's tests do require goda's)
    scripts/cgm-stress/* | scripts/grl-stress/* | scripts/istardt-stress/* | scripts/tropos4as-stress/* | scripts/kaos-stress/*) return 0 ;;
  esac
  return 1
}

affects() {
  local file="$1"
  case "$job" in
    test)
      untested "$file" && return 1
      return 0
      ;;
    prism)
      shared "$file" && return 0
      case "$file" in
        packages/lib/src/engines/edge/* | packages/lib/src/engines/edgeV2/* | packages/lib/src/engines/edgeFamily/*) return 0 ;;
        examples/edge/experiments/* | experiments/Dockerfile.prism | experiments/prism-parse.sh) return 0 ;;
        Makefile | .github/workflows/prism-test.yaml) return 0 ;;
      esac
      ;;
    stress:*)
      local engine="${job#stress:}"
      shared "$file" && return 0
      case "$file" in
        "packages/lib/src/engines/$engine/"* | "scripts/$engine-stress/"* | "examples/$engine/"*) return 0 ;;
        scripts/native-column.cjs | .github/workflows/stress.yaml) return 0 ;;
      esac
      # cgm's oracle runs in CI on the DLV image built from docker/dlv
      [ "$engine" = cgm ] && case "$file" in docker/dlv/*) return 0 ;; esac
      # KAOS's is the framework's: its engines, its dialect, its seeds, and
      # kaosprop's hand-drawn RE'12 fixture (las.expected.csv's model)
      [ "$engine" = kaos ] && case "$file" in
        packages/lib/src/engines/kaosprop/* | packages/lib/src/engines/kaosexpert/* | packages/lib/src/dialects/kaos/*) return 0 ;;
        packages/lib/test/engines/kaosprop/fixtures/*) return 0 ;;
      esac
      ;;
    *)
      echo "unknown job '$job'" >&2
      exit 2
      ;;
  esac
  return 1
}

hits=()
while IFS= read -r file; do
  [ -n "$file" ] && affects "$file" && hits+=("$file")
done <<<"$files"

if [ "${#hits[@]}" -eq 0 ]; then
  echo "$job: nothing it checks changed ($(printf '%s\n' "$files" | grep -c . || true) file(s) in ${base:0:8}..${CI_HEAD:0:8})"
  decide false
fi
echo "$job: ${#hits[@]} file(s) it checks changed, e.g."
printf '  %s\n' "${hits[@]:0:10}"
decide true
