# Tropos4AS stress test (goal-controller#136)

Runs the Tropos4AS seeds through `@goal-controller/lib`'s built `out/`,
checks them, and compares each scenario's lifecycle trace with its
reference, exactly.

```sh
pnpm stress:tropos4as                            # builds lib, then runs everything
node scripts/tropos4as-stress/run.cjs --strict   # exit non-zero on a failure
```

## Seeds

Every seed is committed; there is nothing to fetch and no oracle to run (no
Tropos4AS tool survives, goal-controller#134):

- `examples/tropos4as/cleaner-agent/`: AAMAS 2009 Fig. 1, with §5's scenario
  (`reference/trace-paper.txt`, transcribed from §5 and Fig. 3) and an
  all-fail scenario (derived by hand).
- `examples/tropos4as/patient-monitoring/`: iStar 2011 Fig. 1, with "a day"
  (ours, derived by hand).

## Checks

- **import**: the piStar file, read with its metamodel block, as the
  lifecycle reads it (`tropos4asAnalysisModel`, `readTropos4asModel`).
- **checks**: `tropos4asProblems` reports no error (warnings are listed).
- **notation**: the model's Notation view document (an element's name, its
  property lines under it, #138) reads back to the same model:
  `notationEdits` gives no edit, `documentDiagnostics` nothing.
- **analysis**: the engine's analysis runs on every scenario without error:
  a case per scenario, its steps in order (#137's step series).
- **trace**: per scenario of the project, the lifecycle's trace against
  `reference/trace-<scenario>.txt`, row for row (`#` lines aside). A
  reference with `# compare: the state changes of <goal>` is compared with
  that goal's state changes, which is what Fig. 3 draws.
- **importer**: the seed's TAOM4E twin, `<seed>.tropos` in
  `packages/lib/test/engines/tropos4as/taom4e/` (written by hand against
  `TAOM4E-MM.ecore`, **unverified against TAOM4E**: no file it wrote
  survives), read by `readTaom4e`, equals the seed in what TAOM4E's base
  metamodel carries (`taom4eCarried`: actors, iStar elements and links, the
  creation, achievement and maintain conditions, a maintain-goal's type).
  One more row: the GODA-shaped twin of `examples/goda/dm` (`dm-goda.tropos`)
  is read as GODA's, and the GODA engine generates from it what it does from
  `dm2.txt`, file for file (#134 D1.3).

- **native**: the seed through Tropos4AS's native file, `.tropos` (#144 item 3): written and read back, it is the model but for `lossy` (the shared `nativeCheck`). The GODA twin's row checks the same, and that the model read back still generates `dm2.txt`'s files through the GODA engine. Unverified against TAOM4E: no tool can re-read the file.

Results go to `.cache/tropos4as/results/`: `SUMMARY.md` (a row per seed and
scenario, and the GODA twin's), one JSON per seed and `goda-twin.json`.
