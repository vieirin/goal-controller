# GODA-MDP stress test (goal-controller#35)

Runs #32's "Stress test" checks on pistarGODA-MDP's seven examples, through
the GODA engine in `@goal-controller/lib`.

```sh
pnpm stress:goda                                   # builds the packages, then runs everything
node scripts/goda-stress/run.cjs --save-baseline   # once, on the base commit: the regression baseline
node scripts/goda-stress/run.cjs --strict          # also fail on an AND or OR failure
node scripts/goda-stress/run.cjs --no-build-check  # don't build the MDPs with Storm or PRISM
```

The first run fetches the examples at `c8519f70` into `.cache/goda/` (network
needed once). The upstream repository has no licence, so nothing from it is
committed (#34 D1). Results go to `.cache/goda/results/`: `SUMMARY.md`,
`summary.json` and one JSON file per model.

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

| File | What |
|---|---|
| `fetch.cjs` | the examples at the pinned commit, cached |
| `references.cjs` | each model, its reference outputs, its issue and generator version (#34 D10) |
| `engine.cjs` | the one adapter over lib's `goda`, `godaOutput`, `GODA_IMPLEMENTED_VARIANTS` |
| `checks.cjs` | the checks on one model |
| `compare.cjs` | MDP after whitespace normalization, PCTL bytes, eval_formula.sh as a set (D15); the formulas with lib's evaluator |
| `build.cjs` | Storm or PRISM builds the MDP when one is on PATH (skipped otherwise) |
| `snapshot.cjs` | the other engines' language snapshot against the baseline |
| `report.cjs` | `SUMMARY.md`, including upstream's known behaviour |

**Exit code.** It is non-zero only on a regression in the other engines (or,
with `--strict`, on a failure in AND or OR). A failure on DM, Incompleteness,
TAS, Fragmented or BSN is an expected failure until its issue (#36 to #40)
lands. That includes `GodaUnsupported` and a generator version the engine
doesn't implement yet.

**Expected diagnostics.** When a model PR settles which dialect diagnostics a
model should have, it lists them in `checks.cjs`'s `EXPECTED_DIAGNOSTICS`.
