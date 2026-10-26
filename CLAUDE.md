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
- Typecheck lib (src and tests): `cd packages/lib && pnpm exec tsc --noEmit -p tsconfig.test.json`. Lint: `pnpm run lint`. Format: `pnpm run format:check`.
- Workbench smoke e2e (Playwright, own port/distDir, never `:3000`): `pnpm run e2e` (headless), `pnpm run e2e:headed`, `pnpm run e2e:ui`; once per machine, `pnpm --filter @goal-controller/ui exec playwright install chromium`.
- Reference-tool checks: `pnpm run stress:<goda|grl|cgm|istardt|tropos4as|kaos>`.

## Reading

- For TypeScript symbols, ask the LSP first (definition, references, document symbols, hover): one call instead of a grep and a read per hit.
- Search with `rg -n` (or the Grep tool) and read line ranges. Never `grep -r`: it ignores `.gitignore` and walks `node_modules` and `.claude/worktrees/`. Large files to read in ranges: `packages/ui/components/workbench/WorkbenchContext.tsx`, `packages/dialect/src/schema.ts`, `packages/dialect/docs/{frameworks,adding-an-engine,pistar-ext-support}.md`, `packages/goal-language/src/generated/grammar.ts` (generated).
- Generated or reference output, not source: `examples/**/generated/`, `examples/goda/fragmented/reference/`, `examples/*/experiments/`, `experiments/**/results/`, `result_plots/`, `dissertationExamples/generatedPrism/`, `old_examples/`, `logs/`, `output/`, `packages/lib/test/engines/edgeFamily/antlr-oracle.json`. Open one only when the task is about that output, and then the single file it names.
- Papers: `.cache/` holds the PDFs (not committed). Read a paper through its text transcription in `docs/papers/` when there is one; don't render pages to images.
- `.claude/worktrees/` holds other sessions' checkouts: never read or edit there unless it is your own working directory.
