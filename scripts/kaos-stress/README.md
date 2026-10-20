# KAOS stress test (goal-controller#190)

Checks every KAOS seed (`examples/kaos/<seed>/`, a project whose native file
is a `.kaos`) through lib's built `out/` only, and compares each seed's
`*.expected.csv` with what its engine computes.

```sh
pnpm stress:kaos                            # builds lib, then runs everything
node scripts/kaos-stress/run.cjs --strict   # fail on any seed's failure
```

## Checks

- **import**: the `.kaos` reads (`kaosNativeFile`), and:
  - its model is the committed `<seed>.txt`, byte for byte;
  - its resources (kaosexpert's `experts.json` and `calibrations.json`)
    are the committed files;
  - it opens in the project's mode (`kaosprop` or `kaosexpert`).
- **validate**: istar-ts validates the model (`validateModel`: none).
- **roundtrip**: the model is written back with its resources
  (`writeKaos`), and the written file reads to the same model
  (`modelRoundTrip`) and the same resources.
- **analyses**: kaosprop's two analyses and kaosexpert's two run without
  error. Both engines read every `.kaos`, and kaosexpert runs 2000
  samples here.
- **oracle**: each row of the seed's `*.expected.csv`, by its header:
  - `id,element,probability,paper,derivation` (kaosprop's):
    - kaosprop's probability within 5e-7;
    - the paper's printed value within one unit of its last digit, unless
      the derivation logs an erratum (`the paper prints …`).

    `las.expected.csv` is the oracle of RE'12's hand-drawn model
    (`packages/lib/test/engines/kaosprop/fixtures/re12-las.txt`), not of
    `las.kaos`, as its header says. `carpooling.expected.csv` is the
    carpooling seed's: REJ'13's chain from Table 3's estimates.
  - `quantity,id,expected,tolerance,source,derivation` (kaosexpert's):
    - a quantity of an expert (`information`, `calibration`, `weight`);
    - a quantity of an element: `probability` (one sample's), `mean`, `VU`,
      `US`, `SU@<p>` or `q<pct>` of its distribution; with `given`
      `experts=e1`, of a run on those experts' estimates only (RE'15's
      one-expert run, `ambulance.expected.csv`);
    - a leaf obstacle alone against the goal in `source` (`VU alone`,
      `US alone`);
    - `triangular a`/`triangular b`: a triangular distribution's elicited
      (a0, m, b0) extended by a tail fraction (`given = "a0,m,b0,tail"`,
      goal-controller#199's `lib.extendTriangular`, HASE'11 §III-B2).

    Each is checked within its tolerance, the run being 100 000 samples
    with seed 1. A row whose `expected` is `-` is a number the paper prints
    and the seed can't reproduce: reported, never a failure.
- **degenerate** (`las`): RE'12's rows under kaosexpert with point
  estimates. Each sample is kaosprop's EPS.

Results go to `.cache/kaos/results/`: `SUMMARY.md` (one row per seed, then
every oracle row) and one JSON per seed.
