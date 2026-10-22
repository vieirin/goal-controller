# Defects in the reference tools and published models we use as oracles

The KAOS stress test (`pnpm stress:kaos`, `packages/dialect/docs/
frameworks.md`'s "KAOS stress test" section) cross-checks our engines
against published papers and, where one exists and runs, the tool that
produced the paper's numbers. Several of those oracles have defects of
their own. By the owner's decision (2026-10-21): we document them here,
we do not fix them, and we do not report them on CAIRIS's, RADAR's or
KAOSTools' trackers. This page gathers what frameworks.md's per-step notes
already say about them, each with its source, what is wrong, how it was
found and reproduced, what it changes in our oracle, and how our code or
seed deals with it.

## CAIRIS

**Source:** `cairis-platform/cairis` @ `44cc57d`, Apache 2.0,
`cairis/sql/procs.sql:21245-21305` (`obstacleProbability`).

**What is wrong:**
- `andProb` is declared `default 0` and is never set to 1 before the AND
  loop multiplies into it, so an AND refinement always contributes 0 to
  the sum. The final value is `andProb + orProb`, raised to the
  obstacle's own probability only when that is higher — so an AND
  refinement's probability silently falls back to whatever was set
  directly on the obstacle.
- `orProb` has no clamp to 1, so an OR refinement's probabilities can sum
  past 1 (a synthetic model reaches 1.3).

**How found and reproduced:** CAIRIS run in Docker
(`scripts/kaos-stress/cairis-oracle.sh`, `mysql:8.0` + `shamalfaily/
cairis`, pinned by digest, `obstacleProbability` byte for byte with
44cc57d). On the synthetic cross-check: AND 0 vs the restated rule's 0.2;
an AND with its own 0.1 set gives 0.1 vs 0.2; OR 0.9 vs 0.7; OR sums to
1.3 vs 0.88; nested OR 0.4 → 0.6 vs 0.37 → 0.496. On the field cross-check
(ACME Water/Day, which has real probabilities, 20 obstacles, 10
non-zero): "Surplus equipment" (an AND) is 0 in CAIRIS vs 0.48
(0.8 × 0.6) in our restatement; "Unscanned media" and "Undetected
malicious traffic" (both OR) are 0.9/0.5 in CAIRIS vs 0.82/0.46 in ours.
18 of 21 obstacles agree exactly.

**What it changes in our oracle:** CAIRIS's own numbers can't be taken as
ground truth for an AND-refined or an over-1 OR-refined obstacle; the
field cross-check attributes each ACME Water/Day difference to one of
the two bugs (`or-sum`, `and-from-0`) rather than treating it as a
disagreement to resolve.

**How our code deals with it:** `cairisObstacleProbabilities`
(`packages/lib/src/importers/cairis/…`) restates CAIRIS's rule on
purpose — AND from 0, OR unclamped — so kaosprop's own (correct) AND/OR
rule can be cross-checked against CAIRIS's *actual* behaviour rather than
its intended one. `stress:kaos`'s CAIRIS seeds (`acme-water-day`, the
synthetic fixture) carry both CAIRIS's restated number and kaosprop's,
each difference attributed. #192, #203–#205, PR #370.

## RADAR

**Source:** `sbusari/RADAR` @ `e0a4503`, no licence (`license: null`, no
LICENSE file) — run and read, never copied.

### 1. Output precision

**What is wrong:** the CLI (`RADAR_CMD`) never sets an output precision,
so values print with `%.0f` — 0.12 prints as `0`.

**How found and reproduced:** running RADAR in Docker
(`maven:3.6-jdk-8`, `--platform linux/amd64`) on `LAS.rdr` printed
`Risk = 0` for all 648 solutions, including the 5 shortlisted. A local
CLI patch (built in `/tmp`, nothing copied into the repo) printing 6
decimals showed the real values, 0.1206–0.1363 under the file's sign.

**What it changes in our oracle:** without the patch, RADAR's printed
report looks inconsistent with the 0.12–0.13 risk range it states in
prose; the patch is what makes RADAR usable as a design-by-design oracle
at all.

**How our code deals with it:** the patched build (documented in
`scripts/kaos-stress/README.md` and #193/#207's log) is what produced
`examples/kaos/las-radar/las-radar.expected.csv`'s RADAR column; the seed
itself contains no RADAR code.

### 2. `--nbr_simulation` ignored

**What is wrong:** the CLI hard-codes 10 000 simulations regardless of
`--nbr_simulation`.

**How found and reproduced:** passing other values to `--nbr_simulation`
on the Docker build produced no change in RADAR's run time or output
variance; reading `RADAR_CMD`'s source confirms the flag is parsed and
never used.

**What it changes in our oracle:** the Monte Carlo tolerance used against
RADAR's numbers is sized for 10 000 samples regardless of what was
requested.

**How our code deals with it:** our own kaossim engine runs at 100 000
samples (seed 1) and is cross-checked against RADAR's fixed 10 000 within
a 4σ tolerance; `las-radar.expected.csv`'s tolerances already account for
RADAR's sample count, not a configurable one.

### 3. `LAS.rdr`'s sign is inverted; the report was computed with the file's distribution, not its own

**What is wrong:**
- `LAS.rdr` line 3 declares `Objective Min Risk = Pr(ResponseTime <=
  14*60)` (minimise the probability of a *fast* response), while
  `LAS_report.html` prints and discusses `Pr(ResponseTime > 14*60)` (the
  intended risk of a *slow* one). Running the file as written gives
  Risk ≈ 0.797–0.882 with a single Pareto-optimal design on every run;
  running it with the report's intended sign gives Risk 0.1206–0.1363
  and a shortlist of 4–6 designs (unseeded), a subset of which is the
  report's own 5. So the report's *numbers* (0.12–0.13, 648/5) were
  computed with the file's inverted sign, while the report's *prose* and
  formula state the intended one.
- `LAS_report.html` also states
  `MobilisedAmbulanceDistanceFromLocation = normalCI(10000,100000)`,
  while `LAS.rdr` has `triangular(10000, 50000, 100000)`. Running with
  `normalCI` gives Risk 0.18–0.20, not the report's 0.12–0.13, so the
  report was computed with the file's triangular distribution, not its
  own stated normal one.

**How found and reproduced:** both variants run against the patched
RADAR build in Docker, each at 10 000 simulations, compared against the
report's stated 0.12–0.13 risk and 5-design shortlist (#193, logged on
#207).

**What it changes in our oracle:** the Pareto front and risk values a
naive reading of `LAS.rdr` "as the intended formula" would produce (1
design, Risk ≈ 0.8) are not what the report's 648/5 figures describe;
the oracle has to pick one of file-sign/report-sign explicitly.

**How our code deals with it:** our `las-radar` seed (D4, #193) uses the
report's *sign* (`Pr(ResponseTime > 14*60)`, the intended formula) but
the file's *distribution* (the triangular). The file's inverted sign is
recorded as the discrepancy, not silently corrected: kaossim's exhaustive
front on this seed is RADAR's single design under the report's sign (not
648/5 — the 5-design front belongs to the file's sign, a variant run
documented but not the seed's oracle). Every design's objective values
are checked against RADAR's own Docker run within Monte Carlo tolerance.

## KAOSTools

**Source:** `ancailliau/KAOSTools`.

**What is wrong, by commit:**
- **current `master`'s PEG grammar can't parse ADS's files.** Built with
  `mcs` under Mono (amd64 emulation breaks `msbuild`/`csc`); its parser
  wants `declare obstacle [id]`, and ADS's `obstacles.kaos` has anonymous
  nested obstacles, so parsing fails with `Expected Whitespace or
  Identifier or end at line 12 col 9`.
- **`05a5125`'s `CMSelector` (countermeasure selection optimiser):**
  `GetOptimalSelections` checks no consistency (a Conflict link is never
  evaluated), enumerates non-empty selections only (the empty selection
  is never a candidate even when nothing else is safe), and — when the
  minimal cost is positive — pools *every* selection costing no more
  than that minimal cost into the "optimal" set regardless of whether it
  is safe (`if (minCost > 0 && cost > minCost) continue;`, then maximum
  satisfaction, no safety test). With two high-level goals this can
  surface an unsafe selection ahead of a safe, costlier one; it never
  shows up with KAOSTools' own single `--root` goal, because a cheaper
  unsafe selection's satisfaction is bounded by its RDS and can't beat a
  safe one's.
- **the 2015 `UncertaintySimulation` tool (`0f17b6e`, over
  ExpertOpinionSharp's `CookFramework`) needs scoring-rule fixes to match
  RE'15's printed Cooke numbers**, and **reads expert quantiles as
  `float`, not `double`**, so a quantile written as `5%` becomes
  `0.0500000007` at the root: enough to push a sum over 100% and trigger
  a "`>94.99999993%`" style violation that double precision wouldn't.
  The tool also averages NaN into every information score when a
  variable's expert estimates are all identical (a point range, 0/0 per
  bin), which propagates to every expert's weight being NaN unless the
  caller special-cases it.

**How found and reproduced:**
- the PEG failure: `dotnet`/`mono` build in Docker, run against ADS's
  files directly (#191 part A's log).
- `CMSelector`'s pooling bug: built at `05a5125` with `mcs` in
  `mono:6.12 --platform linux/amd64`, run on the flood model
  (`model2.kaos`, `ancailliau/phd-thesis` @ `6a9f5fd`) and on a
  synthetic counter-model with two RSR goals (one goal, cost 1, unsafe;
  another, cost 2, safe) — KAOSTools pools the cheap unsafe one into its
  optimum (rv367's finding, logged on #353/#367).
- `UncertaintySimulation`'s float-quantile and NaN-averaging bugs: built
  at `0f17b6e` with the BDDSharp/ExpertOpinionSharp commits it needs
  (`d151929`, `b481f3a`), run against ADS's five-expert estimates; 38 of
  47 leaves agree with our engine within 0.006, and the 9 that don't each
  have an expert quantile of exactly 5%, landing at `0.0500000007` (gt190b's
  log, #198/#343).

**What it changes in our oracle:** KAOSTools can only be used as a
second oracle on files simple enough for its PEG, and its optimiser and
simulator results need the same bugs applied to our own engine (or
explicitly worked around) before a comparison is meaningful.

**How our code deals with it:**
- kaosres's selection engine defaults to SEAMS'17's rules as written
  (consistency checked, the empty selection a candidate, cost-optimal
  defined among the safe selections) and offers KAOSTools' rules as an
  explicit option (`semantics: 'kaostools'`) for comparison — **with the
  pooling bug fixed** (only safe selections are pooled under
  `'kaostools'` too; #353, rv367), since the bug has no effect on
  KAOSTools' own single-root-goal case and reproducing it would add
  nothing but a known wrong answer.
- kaosexpert's Cooke implementation (`cooke()`) leaves a point-range
  variable out of the information scores (both the expert's and the
  decision maker's) while still counting it in N, which is what lets it
  match KAOSTools' weights to 1e-8 on ADS once the same rule is applied
  to both sides; kaosexpert reads quantiles in double precision and
  clamps a Monte Carlo draw below 0 to 0 (KAOSTools does neither), so the
  two engines' sampled quantities (root US 0.9462 vs KAOSTools' 0.9461,
  and 9 of 47 leaves) differ slightly by design, each difference
  attributed rather than matched bug-for-bug.

## Published-paper and published-model inconsistencies

These are defects in the papers' or models' own printed numbers, not in a
tool.

- **RE'12 (the case-driven LAS example):** prints
  `0.60 × 0.995 + 0.40 × 0.98 = 0.984`; the product of the paper's own
  factors is 0.989. Only 0.989 reproduces the paper's own next steps
  (0.989 × 0.957 = 0.9466; 0.98 × 0.9466 = 0.9277) and Table II's 000 row
  (0.98 × 0.989 = 96.92%). Our hand-drawn oracle fixture
  (`packages/lib/test/engines/kaosprop/fixtures/re12-las.txt`) uses 0.989
  and reproduces every one of the paper's downstream numbers to within
  its own rounding.
- **RE'15 (the ADS fire alarm, §III vs §VII):** the United Safety (US) of
  `Achieve[BuildingEvacuatedWhenFire]` is printed as **0.1645 in §III**
  and **0.1529 in §VII**. Also, SU(p) is defined in prose as "the
  probability to observe … at least p" but the paper's own formula
  integrates `∫ₓ<ₚ` (at most p); our engine follows the formula, which
  makes VU = SU(RDS) exactly (as the paper's §VI.B chain assumes) and
  gives SU(0.84) = 0.85, matching neither reading to the paper's own
  printed 0.78. Our fire-alarm seed's `expected.csv` lists both printed
  US values and the formula-vs-prose SU discrepancy rather than picking
  one silently.
- **SEAMS'17 (Table I, the flood example):** its figures fit no single
  set of leaf obstacle rates — the model files (`FloodingSimulator`
  @`ef6db9f`, the thesis's `model2.kaos`) have an RDS of 0.65 against the
  paper's 80%, two countermeasures that resolve nothing in the files
  (Emergency is commented out; Ultrasound-10s has no `resolvedby`), and
  back-solving individual Table I cells against each other gives
  contradictory values for `(1 − e)` (0.76 from one row, 0.80 from
  another). Our flood seed documents Table I as not reproducible and
  uses its own computed selections as the oracle instead (#191 part B,
  #200/#201).
- **REJ'13 (the carpooling example, §6.3):** the formula for
  `DropPointNotReachedInTime` is 0.015, which is actually
  `DetourOnPlannedRoad`'s printed rate (1.5%), not
  `DriverAtOtherDropPoint`'s — confirmed against Fig. 6's tree. Our
  carpooling seed re-keys the paper's actual chain
  (0.01495 → 0.0805 → 0.1188 → 0.1898 → 0.8102 → 0.5266 → 0.4255 →
  0.2809), which matches the paper's printed 0.015 → … → 0.28 to the
  digits it prints, using the formula's intended obstacle rather than the
  paper's misnamed one.
- **HASE'11 (the mooring example, Figure 3/§III-B2's triangular tail
  extension):** the paper's own printed extended bounds
  (0.82548, 0.90, 0.9863) don't exactly solve the two tail equations it
  states for the elicited (0.85, 0.90, 0.96) — our exact 2D-Newton solve
  gives (0.825529, 0.90, 0.986351), off by ~5e-5/~1e-4. Checked that both
  of the paper's own printed values solve the two equations only to
  within 5e-4 of the stated 0.05/0.95 tail, not exactly, so this reads as
  the paper's own rounding or a lower-precision solver rather than a
  different formula. `examples/kaos/mooring/mooring.expected.csv` checks
  our exact solve, not the paper's rounded digits.

- **ASE'08 (Letier, Kramer, Magee and Uchitel, the mine pump, §2 and
  §4):** one requirement's name is spelled three ways. Figure 2 defines
  `Maintain[PumpOnWhenHighWaterAndNoMethane]`; Figure 3's operations
  (`startPump`'s `ReqTrig For`, `stopPump`'s `ReqPre For`) name it
  `PumpOnWhenHighWaterAndNotMethane`; the paper's models archive (its
  `Mine Pump KAOS model.txt`, licence not stated, read and not copied)
  writes `PumpOnWhenHighWaterANDNoMethane`. Found while transcribing the
  paper (`docs/papers/letier-fse02-icse02.md`, §3.5) for
  goal-controller#194; reproduced by reading the two figures side by side.
  A seed that re-keys the figures as printed has an operationalisation
  naming a requirement nobody declares. The mine pump seed (#209) keys
  every operation to Figure 2's name, the one the requirement is declared
  with, and records the other two spellings as this defect.
- **ASE'08 (the mine pump's environment, §4 step 2, against its models
  archive):** the paper prints `aboveHigh`'s domain precondition as
  ¬HighWater ∧ ¬LowWater (the water rises above high from the medium
  level) and says `belowHigh`, `aboveLow` and `belowLow` are "specified in
  a similar way"; the archive's `Mine Pump LTS from goal operationalization
  - ASEJ vesrion.lts` (licence not stated, read and not copied) has
  `DomPre_aboveHigh` on ¬HighWater alone and `DomPre_belowLow` on ¬LowWater
  alone, so its environment lets the water be high and low at once (its own
  comment, on a commented-out `DomInvar_NeverHighAndLow`, asks whether
  excluding that is "cheating"). The same section says the extra process
  constrains "each fluent" to change at most once between two ticks; the
  archive's constrains the water level's two fluents together, one
  `OnePerTick` process per object rather than per fluent. Found for
  goal-controller#209 by setting the transcription (§3.4) beside the
  archive's constraints; the mine pump seed keeps the paper's
  preconditions and, per rv392's review (#209 follow-up), the paper's
  per-fluent grouping too — the oracle outranks the archive's own output
  where they conflict. `mine-pump-lts.expected.csv` checks the paper's
  reading (`OnePerTick_HighWater`, `OnePerTick_LowWater`, …, one row per
  fluent) and marks the rows that differ from the archive's per-object
  `OnePerTick_Sump`/`OnePerTick_Mine` grouping with this defect.

## Inputs withheld (not a defect)

Some papers withhold the elicited data a model's numeric oracle would
need, by their own stated policy rather than by error:

- **HASE'11 (fibre-rope mooring):** §V states twice that every elicited
  quantity is unpublished ("For privacy, we do not report the elicited
  quantities"; Figure 6(b) "report[s] the curve shape but not the actual
  numbers"). The seed leaves every leaf ESR and α (GL3/GL5/GL8) unset,
  each marked in `mooring.kaos` with a comment saying so; Table II's
  Spearman correlations are listed as not reproducible (`expected = -`).
- **FSE'04 and RE'11 (the ambulance LAS, quantitative goals):** FSE'04
  itself calls its Table 3 "plausible (but fictitious) estimations for
  *some of* the important parameters"; most distribution families, the
  city size `L`, the number of truly-available ambulances, and the
  equations relating several quality variables are never printed. RE'11
  likewise withholds option costs, several per-option distributions, and
  the full Pareto set (only a plot, Figure 6, not a list). The
  `las-quantitative` and `las-design-space` seeds report every such
  input as unresolved rather than claiming a number for it; Table 3, its
  sensitivity result, and RE'11's 61/97/73% are listed as
  "not reproducible: inputs not printed", each naming what is missing.

## See also

- `packages/dialect/docs/frameworks.md`'s "KAOS stress test" section,
  Step 3 part A/B/C, Step 4 part A/B, Step 5 and Step 6, for the full
  decisions these findings came out of.
- `goal-controller` issues #182, #189, #343, #353, #368, #369 for the
  per-round logs these entries are drawn from.
