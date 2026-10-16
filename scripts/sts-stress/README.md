# STS-ml stress test (goal-controller#163)

Runs the STS-ml seeds and UniTN's three tutorial projects through `@goal-controller/lib`'s built `out/`. The plan and decisions are in #160.

```sh
pnpm stress:sts                                  # builds lib, then runs everything
node scripts/sts-stress/run.cjs --strict         # exit non-zero on a failure or a skipped tutorial
node scripts/sts-stress/run.cjs --update         # rewrite snapshots/<seed>.sts
node scripts/sts-stress/run.cjs --oracle         # reports why there is no oracle yet (#160 D-R2)
```

## Seeds

The seeds are committed, drawn from the papers' figures. Each README has the mapping and its readings. The orchestrator has provisionally accepted all three as equivalent to their figures (owner away, #160).

- `examples/sts/travel-planning/`: the NESSoS chapter's §2, Figs. 1, 10–12 and 16.
- `examples/sts/stay-permit/`: the STS-ml manual's running example, Figs. 9, 14, 16, 18 and 20.
- `examples/sts/atm/`: IJSSE 2014's Fig. 1.

Checks per seed:

- **import**: the piStar file, read with its metamodel block (`stsAnalysisModel`).
- **checks**: `stsProblems` finds nothing.
- **notation**: the Notation view document reads back to the same model, with no edit and no diagnostic.
- **native**: written as `.sts` and read back, the model is itself but for `STS_LOSSY`. ATM's contribution is a known loss: no published `.sts` shows the type a contribution is written with.
- **snapshot**: the `.sts` the writer gives equals `snapshots/<seed>.sts`.
- **analyses**: each of the engine's analyses runs. Where `expected-analyses.json` exists (#161's), `runStsAnalyses` must give it.

## Tutorial projects (not committed, #160 D-R8)

`eGov.exp`, `healthcare.exp` and `taslab.exp` come from [sts-tool.eu/tutorials](https://www.sts-tool.eu/tutorials). The script downloads them into `.cache/sts/samples/` and checks each against its sha256, pinned in `tutorials.json`. CI caches that folder, keyed on the file, so sts-tool.eu is only asked when a pin changes.

An `.exp` is gzip of a Java-serialised list of the project's files. lib's `readStsProject` reads the file names and byte arrays from the stream's tags, with no Java and no class deserialised, and the script imports the `.sts`. A tutorial that can't be fetched is skipped with a message, and `--strict` fails.

Checks per tutorial:

- **import**: no warning but the known ones. Healthcare draws *blood examinedd* in no actor.
- **checks**: as for the seeds.
- **native**: as for the seeds.
- **analyses**: against `examples/sts/tutorials/<name>.expected-analyses.json` (#161's), when present. Those files are green's; their numbers are the reports' printed results.

## Oracle

None yet. STS-Tool 2.2.4 and its bundled DLV come under a EULA that forbids reverse engineering and the disclosure of benchmark results without UniTN's written permission. Whether we may use them is the owner's open question (#160 D-R2). `--oracle` reports that and skips. The reference results are the papers' and the reports' (#160 D1 point 3).

Results go to `.cache/sts/results/`: `SUMMARY.md` and `results.json`.
