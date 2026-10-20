# GRL stress test (goal-controller#106)

Imports `.jucm` seeds with `@goal-controller/lib`'s `importJucm`, checks them,
and evaluates their strategies against jUCMNav itself, through lib's built
`out/` only.

```sh
pnpm stress:grl                            # builds lib, then runs everything
node scripts/grl-stress/run.cjs --oracle   # also runs jUCMNav (Docker) on the fetched seeds
node scripts/grl-stress/run.cjs --strict   # fail on a committed seed's failure
```

## Seeds

- **Committed**: `examples/grl/grl-smart-home/SmartHome2.jucm` and
  `examples/grl/grl-own/grl-own.jucm` (in **bold** in the summary),
  each with its reference in `reference/evaluations.csv` beside it.
- **Fetched** at pinned commits into `.cache/grl/<commit>/` (network needed
  once; single raw files, no clones):
  - JUCMNAV/TURNtoURN at `4fac7d36`: every `.jucm` under `Expected Outputs/`,
    the GRL constructs (belief, goal, indicator, resource, softgoal, task)
    and the UCM-only ones, each with its `-autolayout` twin;
  - dcalegar/GoalCat at `636e4828`: `data/goals/{rtfm_goal_model,
rtfm_mini_goal_model, sepsis_goal_model, bpic2019_goal_model}.jucm`.

  Their references are the oracle's CSVs in `.cache/grl/reference/`, written
  by `--oracle`. Without one, a seed's evaluations are ⏭️ "no reference (run
  --oracle)".

## Checks

- **import**: `importJucm` gives a model and no `error` diagnostic.
- **conformance**: the file's `intElements` and belief nodes against the
  imported actors' nodes, orphans and dependums; its grlspec `links` and
  BeliefLinks against `model.links`.
- **checks**: `grlCheckRegistry` over every contribution link's properties.
- **evaluations**: `grlGraph(grlAnalysisModel(parsePistar(model, { fileMetamodel: true })))` (the view of its `KindModel`, goal-controller#125),
  then each strategy from `readStrategies` with `evaluateStrategy`, under the
  oracle's three runs (quantitative at tolerance 0 and 10, qualitative). Each
  reference row (every intentional element and actor) must match exactly, in
  value and in label.
- **native** (goal-controller#144): the model written back with `writeJucm`.
  - **Round trip:** the written file imports to the same model and
    strategies, the diagram's extent aside, and writing it again gives the
    same bytes.
  - **Oracle:** with `--oracle`, jUCMNav evaluates the written files too
    (`.cache/grl/native/` into `.cache/grl/native-reference/`), and each
    one's rows must equal its seed's reference, every one.

## The oracle

`docker/jucmnav/run.sh <seeds> <out>` evaluates every `.jucm` in a directory
with jUCMNav in Docker (never on the host), a CSV per seed:
`algorithm,tolerance,strategy,strategyName,kind,id,value,label`. When it can't
load a seed, the CSV is one `ERROR,<message>` line. For a fetched seed that's
⏭️. For a committed seed it's a failure: the repository's seed isn't one
jUCMNav reads.

Results go to `.cache/grl/results/`: `SUMMARY.md` (one row per seed and
strategy, with the first differences) and one JSON per seed.

| File             | What                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| `fetch.cjs`      | the upstream seeds at their pinned commits, cached                   |
| `references.cjs` | the committed seeds, each seed's reference, running the oracle       |
| `seed.cjs`       | the checks on one seed                                               |
| `compare.cjs`    | the oracle's CSV, read; a strategy's evaluations against it, exactly |
| `native.cjs`     | the written .jucm: its round trip, jUCMNav on it against the seed    |
| `report.cjs`     | `SUMMARY.md`                                                         |

**Exit code.** Non-zero only with `--strict`, when a committed seed fails a
check. A fetched seed's failures are reported, never fatal.
