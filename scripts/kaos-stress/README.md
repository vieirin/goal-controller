# KAOS stress test (goal-controller#190, #192)

Checks every KAOS seed (`examples/kaos/<seed>/`, a project whose native file
is a `.kaos`) through lib's built `out/` only, and compares each seed's
`*.expected.csv` with what its engine computes.

```sh
pnpm stress:kaos                            # builds lib, then runs everything
node scripts/kaos-stress/run.cjs --strict   # fail on any seed's failure
```

Defects found in the oracle tools these seeds run against (CAIRIS,
RADAR, KAOSTools) and in the published papers/models themselves are
documented, not fixed, in
[`packages/dialect/docs/reference-defects.md`](../../packages/dialect/docs/reference-defects.md).

## Checks

- **import**: the `.kaos` reads (`kaosNativeFile`), and:
  - its model is the committed `<seed>.txt`, byte for byte;
  - its resources (kaosexpert's `experts.json` and `calibrations.json`,
    kaossim's `designs.json`) are the committed files;
  - it opens in the project's mode (`kaosprop`, `kaosexpert`, `kaosres` or
    `kaossim`).
- **validate**: istar-ts validates the model (`validateModel`: none).
- **roundtrip**: the model is written back with its resources
  (`writeKaos`), and the written file reads to the same model
  (`modelRoundTrip`) and the same resources.
- **analyses**: kaosprop's two analyses, kaosres's three, kaossim's two and
  kaosexpert's two run without error. All four engines read every `.kaos`,
  and kaosexpert and kaossim run 2000 and 200 samples here.
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
  - `quantity,selection,goal,expected,tolerance,options,derivation`
    (kaosres's countermeasure selection, goal-controller#191; the flood
    seed's): a selection, its countermeasure goals joined by `+` (`none`
    for the empty one), run with `options` (`semantics=kaostools`,
    `scope=model`, `limit=n`; SEAMS'17's rules by default):
    - `ESR` of `goal` within `tolerance`, `cost`, and `flags` (`safe` or
      `not safe`, `consistent` or `inconsistent`, `cost-optimal`);
    - of the run (`selection` `-`): `minimal cost` (`none`: no safe
      selection), `chosen` (the chosen selections, ` | `), `candidates`,
      `evaluated`, `exact` (`yes`/`no`).
  - `quantity,design,objective,expected,tolerance,paper,source,derivation`
    (kaossim's quantitative goals, goal-controller#193; the las-quantitative,
    las-design-space, las-radar and mine-pump seeds): `design` is a
    `designs.json` id, or `model` for the model as it is, simulated at
    100 000 samples, seed 1:
    - `value`: the objective's value within `tolerance`;
    - `unresolved`: the variables it lacks (any order);
    - `target`, `current`: as the model reads them;
    - of the design space (`design` `-`): `designs`, how many there are;
      `pareto`, the exhaustive front (` | `, sorted); `pareto nsga2`,
      seeded NSGA-II's.

    `las-radar.expected.csv`'s values are RADAR's own, run in Docker
    outside the repository (its README).
- **degenerate** (`las`): RE'12's rows under kaosexpert with point
  estimates. Each sample is kaosprop's EPS.
- **ADS corpus** (goal-controller#191, #201): ADS's `simple.kaos`,
  `validation-model.kaos`, and `las.kaos` with `obstacles.kaos` and
  `resolutions.kaos` (goal-language's test fixtures, MIT), selected as
  `ads.expected.csv` says, in the selection format with a `model` column.
  The option `estimates=ambulance` puts each leaf obstacle at its experts'
  combined mean (kaosexpert over the ambulance seed's five experts): the
  field run, about 20 s (4096 selections).

- **CAIRIS** (goal-controller#192): the `cairis-*` seeds have no native
  file. Each is one environment of a CAIRIS exemplar (lib's fixtures,
  `packages/lib/test/importers/fixtures/cairis`, Apache 2.0), as
  `cairis-seeds.cjs` lists them and writes them. For these seeds:
  - **import** reads the exemplar, and the seed's model is that
    environment's, byte for byte;
  - **roundtrip** is the model's JSON written back by istar-ts (D4: no
    CAIRIS writer);
  - **analyses** are kaosprop's;
  - **oracle** reads a seed's `*.expected.csv`, as
    `id,element,cairis,kaosprop,rule,derivation`. Each obstacle's CAIRIS
    value must match `cairis-oracle.csv` (CAIRIS in Docker, by
    `cairis-oracle.sh`) and lib's restatement of CAIRIS's rule
    (`cairisObstacleProbabilities`), both within 1e-6. Its kaosprop value
    must match within 5e-7. `rule` is `agree` exactly where the two values
    are equal; otherwise it says why they differ (`and-from-0`, `or-sum`).

  Only ACME Water/Day has probabilities in the source. The other seeds say
  "no probabilities in the source: not an oracle" (a skip). The synthetic
  cross-check (`synthetic.xml`, `synthetic.expected.csv`, in the fixtures)
  runs beside them as `CAIRIS synthetic`. To make CAIRIS's numbers again
  (Docker only):

  ```sh
  F=packages/lib/test/importers/fixtures/cairis
  scripts/kaos-stress/cairis-oracle.sh $F/synthetic.xml $F/ACME_Water.xml > $F/cairis-oracle.csv
  ```

Results go to `.cache/kaos/results/`: `SUMMARY.md` (one row per seed, then
every oracle row) and one JSON per seed.
