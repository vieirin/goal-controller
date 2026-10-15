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
- **analysis**: the engine's analysis runs on every scenario without error.
- **trace**: per scenario of the project, the lifecycle's trace against
  `reference/trace-<scenario>.txt`, row for row (`#` lines aside). A
  reference with `# compare: the state changes of <goal>` is compared with
  that goal's state changes, which is what Fig. 3 draws.
- **importer**: TAOM4E's `.tropos`, ⏭️ until the XMI reader (#137) is on
  main.

Results go to `.cache/tropos4as/results/`: `SUMMARY.md` (a row per seed and
scenario) and one JSON per seed.
