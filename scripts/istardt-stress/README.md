# iStar-DT stress test (goal-controller#119)

Imports iStarDT-X seeds with `@goal-controller/lib`'s `importIstardt`, checks
them, writes their DT-Golog files and compares them with dtx2dtg's golden
ones, and runs both with DT-Golog itself, through lib's built `out/` only.

```sh
pnpm stress:istardt                            # builds lib, then runs everything but the oracle
node scripts/istardt-stress/run.cjs --oracle   # also runs DT-Golog (Docker) on ours and the golden files, and dtx2dtg's validator on our iStarDT-X
node scripts/istardt-stress/run.cjs --strict   # fail on a committed seed's failure
```

## Seeds

- **Committed**: `examples/istardt/istardt-order` (dtx2dtg's `1.Order`),
  `istardt-heating` (`3.2.Heating_10R_Mixed`), both LGPL-2.1 with their golden
  files in `reference/`, and `istardt-own`, our model of what the fixtures
  lack, whose reference is DT-Golog's run (`reference/utility.txt`). In
  **bold** in the summary.
- **Fetched** at a pinned commit into `.cache/istardt/<commit>/` (network
  needed once; single raw files, no clones; `fetch.cjs`): cmg-york/istardt at
  `649c9be`, the nine golden pairs under `src/test/resources/dtx2dtg/`, the
  example models, the BNF, the XSD and the translator's and xmlparser's
  sources; mx2dtx's `.drawio` at `97b8a18` (a `.drawio` importer's pending
  fixtures).

`projects.cjs --write` rewrites the committed sources and golden files from the
fetched ones and the committed models from the importer; `--utilities` writes
each project's `reference/utility.txt` from the last `--oracle` run.

## Checks

- **import**: `importIstardt` gives a model and no `error` diagnostic.
- **model** (committed): the project's model is the import's.
- **native**: the import through iStarDT-X, the native file (#144 item 2): written and read back, the model but for positions (`nativeCheck`). A native file the project ships (`models[].native`) must be byte for byte what the writer writes of its model now. With `--oracle`, dtx2dtg's validator (`docker/dtx2dtg`: the XSD, then the Schematron) accepts what the writer wrote (`validator.cjs`), in Docker.
- **checks**: `istardtProblems` finds no error.
- **dtgolog**: the writer's file equals the golden `*-Auth.pl` after the four
  header lines, byte for byte (#117 D1.1).
- **oracle** (`--oracle`): DT-Golog's expected utility, probability and policy
  for ours equal the golden file's (or `reference/utility.txt`). When DT-Golog
  fails on the golden file the same way, it is ⏭️: the model's, not ours.
  dtg2sim's `*_Trials.py` utilities are shown for information.

## The oracle

`docker/dtgolog/run.sh <programs> <out>` runs every `.pl` in a directory with
DT-Golog in Docker (never on the host), a result per program:
`Utility: …`, `Probability: …`, `Policy: …`, or `ERROR: …`. The image
downloads `DT-Golog.pl` when it is built, and is never pushed: its licence
forbids redistribution (`docker/dtgolog/README.md`).

Results go to `.cache/istardt/results/`: `SUMMARY.md` and one JSON per seed.

| File           | What                                                         |
| -------------- | ------------------------------------------------------------ |
| `fetch.cjs`    | the upstream files at their pinned commits, cached           |
| `projects.cjs` | the committed seeds and the fetched ones; rewriting the seeds |
| `seed.cjs`     | the checks on one seed                                       |
| `oracle.cjs`   | running DT-Golog; reading its results; the trials' utilities |
| `report.cjs`   | `SUMMARY.md`                                                 |

**Exit code.** Non-zero only with `--strict`, when a committed seed fails a
check. A fetched seed's failures are reported, never fatal.
