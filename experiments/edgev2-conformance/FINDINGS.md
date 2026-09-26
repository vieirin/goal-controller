# edgeV2 vs the EDGE reference — findings

The EDGE reference is the fuzzer in EDGE-XT (`code/evaluation/goal_fuzzer.py`),
which defines how each goal construct must look in PRISM, plus 300 models it
generated. This document explains what edgeV2 did differently, what was changed
to align it, and what was found but deliberately left alone. How to reproduce
everything: [README.md](README.md).

## Result in one table

| | before (edgeV2 at `19660b7`) | after |
|---|---|---|
| Models structurally identical to the reference | **0 of 42** | **324 of 324** (all 300 reference models at N = 5/10/20, depth 2–6, + 24 free-form) |
| edgeV2 models that load in PRISM | **0 of 6** (every model with a task failed) | 6 of 6 |
| Reference properties holding on edgeV2 output (Storm, depth 2–4, 240 models) | — | 5 957 of 5 957 |
| P(root goal achieved) equal to the reference | — | 204 of 204 |
| Free-form models using edgeV2-only notation that generate | 18 of 18 | 36 of 36 |

Reports: `results/baseline/*.md` (before) and `results/after/*.md` (after).
The only model not checked is one free-form model with 39 tasks that exceeds
the 60–120 s limit; it is not an error.

## What was wrong

Ordered by impact. "Reference" lines use edgeV2 names.

1. **Models with tasks did not load at all.** The task module declared
   `T1_pursued` / `T1_achieved` but its commands used `t1_state` / `t1_achieved`,
   so PRISM stopped with `Unknown variable "t1_state"`. Goals also tested
   `T1_pursued=0` and used the integer `T1_achieved` as a boolean.
2. **A finished task never became idle.** `[achieved_T1] … -> true` kept the
   task active, so its parent's completion rule (which requires idle children)
   could never fire. Reference: `-> (t1_state'=0)`.
3. **Degradation retries did not load.** `[G1@3->G2]` produced guards on
   `g1_failed`, but the counter was only declared when the child had a
   `maxRetries` property, so the notation `@3` gave `Unknown variable
   "g1_failed"`. The achieved condition also ignored the retry phase
   (`g1 | g2` instead of `g1 | (g1_failed=3 & g2)`), and the give-up rules had
   no retry phase or threshold.
4. **Goals could give up at any moment.** For interleaved, alternative, choice,
   single-child and notation-less goals the skip rule had no achievability
   threshold, so PRISM chose between pursuing and giving up at random.
   Reference: skip only when `G0_achievable*N <= decision_G0` (interleaved:
   when no child is worth pursuing, `!(G1_achievable*N > decision_G1 | …)`).
5. **Choice goals.** One unguarded skip instead of three (uncommitted, and one
   per committed branch); achievability ignored the committed child
   (`g0_chosen=1 ? G1_achievable : …`); the child order came from the diagram
   links because the parser did not record the `[A?B]` list.
6. **Child selection (alternative, choice, degradation fallback).** edgeV2 split
   the share range into cumulative bands (for two children: first if
   `share1*N > d`, second if `share1*N <= d`). The reference uses a priority
   cascade: child *i* if `share_i*N > d` and no earlier child qualifies.
7. **Any-order goals.** Used raw shares and sibling states; the reference picks
   by each child's share among the *not yet achieved* siblings
   (`G1_relative = g1_achieved ? 0 : G1/(G1 + (g2_achieved ? 0 : G2))`) with the
   same cascade. The `_relative` formulas did not exist.
8. **Sequence goals** did not require the other children to be idle, so two
   children could run at once.
9. **Achievability of AND goals** was the plain product of the children. The
   reference counts what is left: `g0_achieved ? 0 : (!g1_achieved ? G1 : 1) * …`.
   With the product, a half-finished goal kept a low estimate and could be
   skipped although only easy work remained.
10. **Tasks had no decision threshold** (`decision_T1`), which the reference
    uses whenever a task is pursued directly (interleaved, choice, degradation).
11. **No `N` constant.** Guards used a literal `10.0`, so the discretisation
    could not be changed (the reference suite uses N = 5, 10 and 20).

## What was changed (edgeV2 only; the legacy edge engine is untouched)

All in `packages/lib/src/engines/edgeV2/` unless noted.

- **Tasks** (`template/modules/changeManager/…`): variables `t1_state`,
  `t1_achieved_` and a `formula t1_achieved = (t1_achieved_=1)`, so goals and
  tasks share one interface; `achieved` resets the task; `decision_T1`
  declared for every task.
- **One place for child order and constructs** (new
  `template/modules/goalModule/template/children.ts`): children follow the
  notation order (the priority); goals without notation behave as interleaved
  (AND) or alternative (OR); the degradation retry chain comes from `@n` or
  `maxRetries`. Inconsistent models (notation listing non-children, or an AND
  operator over OR links) are still generated, with a warning in the log, as
  before.
- **Guards** (`pursue/decisionGuards.ts`, `andGoal.ts`, `orGoal.ts`,
  `skip.ts`): the reference encoding for each construct, including the
  priority cascade, the relative-share cascade, retry phases and the three
  kinds of choice skip.
- **Formulas** (`formulas.ts`): remaining-achievability for AND goals, choice
  achievability, retry-gated achieved condition for degradation, `_relative`
  formulas for any-order goals.
- **Constants** (`decisionVariables.ts`, `template/index.ts`): `const int N`
  with a new `discretisation` option (default 10, the previous scale);
  `_decision_G` only for goals that select a child. The UI's
  `achievabilitySpace` is still ignored by edgeV2, as before.
- **Parser** (`packages/goal-tree/…/goalNameParser/edgeV2.ts`): `[A?B]` now
  records its children (`{ type: 'choice', choice: [...] }`).
- **Validator** and unit tests updated to the new names.

## Defects in the reference that edgeV2 does not copy

Applied to the reference before comparing and counted in every report.

- **Choice goals can never give up on their chosen child.** The per-branch
  skip is guarded by `g0_state=1 & g0_state=0`. edgeV2 uses "the chosen child
  is idle" (`g1_state=0`). 2 409 occurrences in the 300 models.
- **`g0_chosen: [0..2]` is hard-coded**, too small for a choice with three or
  more children (`g0_chosen'=3` is rejected by PRISM). edgeV2 uses
  `[0..#children]`.
- **Choice properties are written without a newline**, so the `.pctl` line
  cannot be parsed.
- **The reference does not run in Storm.** It writes `!G1_relative*N>d` and
  `!(G1/(G1+G2))*N > d`; PRISM reads `!(… > …)`, Storm reads `(!…)*N` and
  rejects the model. The harness adds the parentheses for Storm only. edgeV2
  output already has them.

## Found, documented, not changed

The output layout was deliberately kept as it is.

- **PRISM's symbolic engine runs out of memory on medium models because of
  module layout.** Model: reference `random_N10_d4_w2_000`
  (EDGE-XT `code/evaluation/generated_models/random_N10_d4_w2_000.prism`;
  15 goals, 16 tasks, 195 reachable states). The reference declares one module
  per task, each right before its parent goal, root last. edgeV2 declares the
  goals in id order and all tasks in one `ChangeManager` at the end. Rewriting
  only the layout of the edgeV2 output (same commands, formulas, constants):

  | layout | PRISM 4.9 (symbolic) | Storm 1.14 |
  |---|---|---|
  | as generated | out of memory (CUDD) | 195 states, 0.035 s |
  | one module per task, tasks last | out of memory | 195 states, 0.032 s |
  | goals children-first, one ChangeManager | out of memory | 195 states, 0.015 s |
  | one module per task, children-first | **195 states, 0.29 s** | 195 states, 0.013 s |
  | EDGE reference | 195 states, 0.24 s | 195 states, 0.016 s |

  Both parts are needed. Recommendation: emit a module per task next to its
  parent (children-first), or model-check with Storm / `prism -explicit`.
  Files and script: `results/layout-experiment/` (reproduce with
  `python3 layout_experiment.py`).
- **The OR achievability formula is not a probability for three or more
  children.** Both the reference and edgeV2 use `sum − product`
  (`G1 + G2 + G3 − G1·G2·G3`), which can exceed 1 (0.8 each gives 1.888).
  For two children it equals inclusion–exclusion. Kept for conformance; the
  correct form is `1 − (1−G1)(1−G2)(1−G3)`.
- **Degradation counts pursuits, not failures.** Following the reference, the
  retry counter increments each time the preferred child is started. Since a
  success achieves the goal this is equivalent in practice, but the name
  "failed" is misleading.
