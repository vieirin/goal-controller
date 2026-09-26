# edgeV2 conformance harness

Checks that the edgeV2 engine produces the PRISM models the EDGE reference
expects. The reference is the fuzzer in EDGE-XT
(`code/evaluation/goal_fuzzer.py`, vendored here as `reference_fuzzer.py`),
which defines the PRISM encoding of each goal construct and ships 300 reference
models in `code/evaluation/generated_models`.

What was wrong with edgeV2 and what changed: [FINDINGS.md](FINDINGS.md).

## What it does

1. **Builds goal models.**
   - *Reference suite:* every reference `.prism` file is parsed back into its
     goal tree (construct and child order come from the module comments and
     pursue labels; the reconstruction reproduces all 300 files exactly).
   - *Free-form suite:* random trees that use the notation beyond the reference:
     tasks at any depth, 1–4 children, every operator, custom retry counts,
     goals without notation.
2. **Converts** each tree to a piStar goal model in edgeV2 notation
   (`[A;B]` sequence, `[A+B]` any order, `[A#B]` interleaved, `[A|B]`
   alternative, `[A?B]` choice, `[A@3->B]` degradation) and runs the edgeV2
   engine on it (`convert.js`, every task gets achievability 0.8 like the
   reference).
3. **Compares structure** (`compare.py`): reference names are translated to
   edgeV2 names (`gG0` → `g0_state`, `GG0_achievable` → `G0_achievable`, …) and
   every command and formula is compared *semantically*: two guards are the same
   if they agree on 400 random states. Known defects of the reference are
   corrected first and listed in the report (`models.ERRATA`).
4. **Model-checks** (optional, `--check`) edgeV2 and reference models with Storm
   (default) or PRISM in Docker: the reference's own PCTL properties, translated
   to edgeV2 names, must hold, and `P=? [F root achieved]` must equal the
   reference's value under the fuzzer's decision thresholds.
5. **Writes a report** `SUMMARY.md` (`report.py`) in plain language.

## Reproduce

Prerequisites: Node ≥ 22 with pnpm, Python ≥ 3.10 (standard library only),
Docker, and the EDGE-XT checkout next to this repository
(`../EDGE-XT/code/evaluation/generated_models`, or pass `--reference-dir`).

```bash
# 1. build the engine
pnpm install && pnpm run build:lib

# 2. model checkers (only needed for --check)
docker pull movesrwth/storm:stable                                   # Storm 1.14 (arm64 + amd64)
docker build -t prism49 -f experiments/edgev2-conformance/docker/Dockerfile.prism \
  experiments/edgev2-conformance/docker                              # PRISM 4.9 (arm64 build)

cd experiments/edgev2-conformance

# 3. committed example set → examples/edgeV2/generated/ (≈5 min with --check)
python3 run.py --check --timeout 120

# 4. everything: all 300 reference models + 60 free-form, structure only (≈2 min)
python3 run.py --reference-filter '*' --freeform 60 --out /tmp/edgev2-full

# 5. wide model-checking run (depth 2–4, N = 5/10/20)
python3 run.py --reference-filter 'random_N*_d[234]_w2_*' --freeform 60 \
  --out /tmp/edgev2-wide --check --timeout 60 --jobs 6

# re-render a report from an existing output folder
python3 run.py --report-only /tmp/edgev2-full
```

Useful options: `--checker prism` (use PRISM instead of Storm), `--timeout`
(seconds per checker run; the checker is hard-killed 10 s later and its
container 60 s after that), `--jobs` (parallel checker runs), `--freeform N`,
`--reference-filter GLOB`, `--title`.

For PRISM on x86-64, change the download in `docker/Dockerfile.prism` to
`prism-4.9-linux64-x86.tar.gz`.

## Output

`<out>/SUMMARY.md` is the report. Each model has a folder
`<out>/<suite>/<name>/` with:

| file | content |
|---|---|
| `goal.txt` | piStar goal model given to edgeV2 |
| `notation.txt`, `tree.json` | the tree (notation / machine-readable) |
| `edgev2.prism` | edgeV2 output (`edgev2.error.txt` if generation failed) |
| `edgev2.pctl` / `edgev2.props` | properties in edgeV2 names (PRISM / Storm syntax) |
| `reference.prism`, `reference.pctl` | reference model and properties, errata applied |
| `reference.storm.prism` | the reference with the parentheses Storm needs (see FINDINGS) |
| `errata.json`, `findings.json` | corrected reference defects, raw differences |
| `*.storm.log` / `*.prism.log` | model-checker output (git-ignored) |
| `RUN.json` (in `<out>`) | date, engine commit, command, checker |

## Results kept in the repository

- `results/baseline/structure.md`, `results/baseline/prism.md` — edgeV2 at
  `19660b7`, before the fixes (60 models; PRISM on 6).
- `results/after/` — the same reports for the fixed engine.
- `results/layout-experiment/` — the module-layout experiment: reference,
  edgeV2 output, the rewritten variants and `RESULTS.md`
  (`python3 layout_experiment.py` regenerates them).
- `examples/edgeV2/generated/` — the committed example set with its report.

## Files

| file | role |
|---|---|
| `run.py` | orchestration and CLI |
| `models.py` | goal trees: reference ↔ tree, random trees, piStar writer, naming, errata |
| `compare.py` | semantic structural comparison |
| `prism_expr.py` | PRISM model parser and expression evaluator |
| `report.py` | human-readable report |
| `convert.js` | batch edgeV2 conversion |
| `layout_experiment.py` | rewrites an edgeV2 output's module layout and builds each variant in PRISM and Storm (see FINDINGS.md) |
| `reference_fuzzer.py` | vendored EDGE-XT fuzzer (the oracle; do not edit) |
| `docker/Dockerfile.prism` | PRISM 4.9 image |
