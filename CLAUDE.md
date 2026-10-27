# goal-controller

Goal models (iStar 2.0, KAOS, NFR, GRL, …) in, analysable artefacts out (PRISM MDPs, SLEEC rules, propagation results). pnpm monorepo; dependencies go one way: `dialect ← goal-language ← goal-tree ← lib ← ui`.

| Package | What lives there |
| --- | --- |
| `packages/dialect` | what a dialect is, as data; knows no engine. Per-framework notes in `docs/` |
| `packages/goal-language` | the one grammar (Langium): parser, validator, readers derived from a dialect |
| `packages/goal-tree` | goal model data structures |
| `packages/lib` | engines (`src/engines/<engine>/`), importers (`src/importers/`), dialect bindings (`src/dialects/`), CLI |
| `packages/ui` | Next.js workbench |

Engines in `packages/lib/src/engines/`: edge, edgeV2 (with edgeFamily shared), goda, mutrose, sleec, cgm, grl, istardt, tropos4as, kaosdoc, kaosprop, kaosexpert, nfrprop. Shared analyses: `analysis.ts`, `variants.ts`, `propositional.ts`.

When working on edgeV2, leave `engines/edge/` untouched: read it for reference, change only `edgeV2/` (and ask before touching `edge/`).

## Commands

- lib tests import the other packages' compiled `out/`. After pulling or editing dialect, goal-language or goal-tree, rebuild them first or tests fail with stale-type errors: `pnpm run build:dialect && pnpm run build:goal-language && pnpm run build:goal-tree` (`pnpm run build:lib` also builds lib).
- One area of lib (fast, quiet): `pnpm --filter @goal-controller/lib run test:only 'test/engines/edgeV2/**/*.test.ts'`. Plain `mocha <spec>` in lib runs the whole suite, because `.mocharc.json` adds its own spec.
- Package suites: `pnpm --filter @goal-controller/<pkg> run test` (lib ≈ 1.4k tests; run it once before reporting, not per edit). ui: `pnpm --filter @goal-controller/ui exec vitest run <file>`.
- Typecheck lib: `cd packages/lib && pnpm exec tsc --noEmit -p .`. Lint: `pnpm run lint`. Format: `pnpm run format:check`.
- Reference-tool checks: `pnpm run stress:<goda|grl|cgm|istardt|tropos4as|kaos>`.

## Reading

- For TypeScript symbols, ask the LSP first (definition, references, document symbols, hover): one call instead of a grep and a read per hit.
- When `graphify-out/` exists, try `graphify query "…"` / `path` / `explain` before `rg -n`; the graph is per machine, build it with `graphify .`.
- Search with `rg -n` (or the Grep tool) and read line ranges. Never `grep -r`: it ignores `.gitignore` and walks `node_modules` and `.claude/worktrees/`. Large files to read in ranges: `packages/ui/components/workbench/WorkbenchContext.tsx`, `packages/dialect/src/schema.ts`, `packages/dialect/docs/{frameworks,adding-an-engine,pistar-ext-support}.md`, `packages/goal-language/src/generated/grammar.ts` (generated).
- Generated or reference output, not source: `examples/**/generated/`, `examples/goda/fragmented/reference/`, `examples/*/experiments/`, `experiments/**/results/`, `result_plots/`, `dissertationExamples/generatedPrism/`, `old_examples/`, `logs/`, `output/`, `packages/lib/test/engines/edgeFamily/antlr-oracle.json`. Open one only when the task is about that output, and then the single file it names.
- Papers: `.cache/` holds the PDFs (not committed). Read a paper through its text transcription in `docs/papers/` when there is one; don't render pages to images.
- `.claude/worktrees/` holds other sessions' checkouts: never read or edit there unless it is your own working directory.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
