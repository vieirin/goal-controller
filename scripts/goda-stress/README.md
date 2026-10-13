# GODA-MDP stress test (goal-controller#35)

Runs #32's "Stress test" checks on pistarGODA-MDP's seven examples, and on
SA-BSN's goal model (#95), through the GODA engine in `@goal-controller/lib`.

```sh
pnpm stress:goda                                   # builds the packages, then runs everything
node scripts/goda-stress/run.cjs --save-baseline   # once, on the base commit: the regression baseline
node scripts/goda-stress/run.cjs --strict          # also fail on a failure of a model whose issue has landed
node scripts/goda-stress/run.cjs --no-build-check  # don't build the MDPs with Storm or PRISM
```

The first run fetches the examples at `c8519f70` into `.cache/goda/` (network
needed once). The upstream repository has no licence, so nothing from it is
committed (#34 D1). Results go to `.cache/goda/results/`: `SUMMARY.md`,
`summary.json` and one JSON file per model (`SA-BSN-<variant>.json` for SA-BSN).

What a check compares:

- **mdp**: our `.nm` against the reference after whitespace normalization,
  and its file name, which is the actor's as the reference's is (`AND.nm`).
- **performance** is informational. It records generation time (median of
  the runs) and output size, and always passes: upstream publishes no
  times to hold it to.
- **build** gives each constant `eval_formula.sh` leaves out a value of
  its type: `0.5`, `1` for an `int` (a decision-making module's `CTX_<n>`
  is never in the script), `true` for a `bool`. It lists those constants as
  `defaulted`.

## SA-BSN (#93, #95)

The model comes from lesunb/bsn at `f939d3c8` (MIT):
`src/sa-bsn/knowledge_repository/resource/models/{goalModel.txt, reliability.formula, cost.formula, param.zip}`.
These are fetched into `.cache/goda/sa-bsn/<commit>/`, and `param.zip` is
unzipped into `param/` (`zip.cjs`, no `unzip` needed).

- **Variants.** SA-BSN's variant is `cc808b6` (#93 D2). The model also runs
  with `5305bc1`, which throws on `[G3#G4]` as upstream does; that row is
  informational throughout. The SUMMARY's "Against param.zip" table says
  which variant reproduces which of the archive's eight files.
  `param.zip` was generated from an earlier revision of the model (#98),
  so those comparisons are informational too. An informational failure
  (ℹ️) is reported but never fails `--strict`. So with SA-BSN in
  `SUPPORTED`, only cc808b6's parsing, round-trip, dialect checks,
  generation and runtime checks gate.
- **The runtime's files.** The BSN runtime doesn't read the goal model. It
  loads `reliability.formula` and `cost.formula`, and its engines find the
  components by scanning the terms. The engine is run with
  `runtimeFormulas: true` (#94), and `runtime.cjs` checks its pair:
  - **runtimePair**: byte-identical to upstream's (no trailing newline);
  - **termContract**: the reliability formula's identifiers are exactly
    `{CTX_, F_, R_}` × the seven components (`G3_T1_1` … `G3_T1_6`,
    `G4_T1`), and the cost formula's `{CTX_, W_}` × the same;
  - **evaluationParity**: lib's evaluator against the runtime's semantics
    in plain arithmetic (Π CTX·F·R, Σ CTX·W), and against `bc` on the same
    text when `bc` is on PATH, within 1e-12. It uses three value sets:
    `eval_formula.sh`'s, the engines' initial strategy (`CTX_` 0, `R_`,
    `F_`, `W_` 1), and `eval_formula.sh`'s with `G3_T1_5` deactivated.

| File             | What                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `fetch.cjs`      | the examples at the pinned commit, and SA-BSN's files, cached                                                     |
| `zip.cjs`        | `param.zip`'s files, with Node's zlib                                                                             |
| `references.cjs` | each model, its reference outputs, its issue and generator version (#34 D10); SA-BSN's components                 |
| `engine.cjs`     | the one adapter over lib's `goda`, `godaOutput`, `GODA_IMPLEMENTED_VARIANTS`                                      |
| `checks.cjs`     | the checks on one model; which failures count under `--strict`                                                    |
| `runtime.cjs`    | the runtime pair, the term contract and evaluation parity                                                         |
| `compare.cjs`    | MDP after whitespace normalization, PCTL bytes, eval_formula.sh as a set (D15); the formulas with lib's evaluator |
| `build.cjs`      | Storm or PRISM builds the MDP when one is on PATH (skipped otherwise)                                             |
| `snapshot.cjs`   | the other engines' language snapshot against the baseline                                                         |
| `report.cjs`     | `SUMMARY.md`, including upstream's known behaviour                                                                |

**Exit code.** It is non-zero only on a regression in the other engines. With
`--strict`, a failure of a model whose issue has landed also counts (`run.cjs`'s
`SUPPORTED`: AND, OR, DM, Incompleteness, TAS, SA-BSN), except a model's
informational checks. A failure on any other model (Fragmented #39, BSN #40) is
an expected failure until its issue lands.

**Expected diagnostics.** When a model PR settles which dialect diagnostics a
model should have, it lists them in `checks.cjs`'s `EXPECTED_DIAGNOSTICS`.
