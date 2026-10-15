# Contextual goal models stress test (goal-controller#153)

Runs the contextual goal models' seeds through `@goal-controller/lib`'s built `out/`. It checks them, and reproduces #151's reference results exactly. With `--oracle`, it runs DLV and z3 in Docker against the TypeScript.

```sh
pnpm stress:cgm                                     # builds lib, then runs everything but the oracle
node scripts/cgm-stress/run.cjs --strict            # exit non-zero on a failure
node scripts/cgm-stress/run.cjs --strict --oracle   # and DLV 2.1.2 and z3, in Docker (docker/dlv)
```

## Seeds

Every seed is committed. There is nothing to fetch: no tool or model survives (#151). The orchestrator judged each seed equivalent to its figures (#151).

- `examples/cgm/museum-guide/`: REJ 2010 Fig. 2, its contexts C0–C15, and Fig. 4's analysis of C1. It carries Example 1 and Examples 2–4's relations.
- `examples/cgm/museum-guide-costs/`: Fig. 13, with costs, cost relations, Code 3's situation and `C13 → C12`.
- `examples/cgm/smart-home/`: IST 2013 Fig. 1, ϕ0–ϕ16 (Table 2) and Fig. 2's analysis of ϕ1. It carries §4.1's contradictions.

## Checks, per seed

- **import**: the piStar file, read with its metamodel block, as the analyses read it (`cgmAnalysisModel`).
- **checks**: `cgmProblems` finds nothing.
- **notation**: the Notation view document reads back to the same model (no edit) and has no diagnostic. This includes link lines for contexts, a contribution's opposite, an intersection's amount, and a dependency's context.
- **resources**: the situations and relations read without a problem.
- **dlv**: `reContextDlv` (Codes 2–3, and Code 4 where tasks have costs) writes exactly `reference/<seed>.dlv`, and `reference/<situation>.dlv` per situation.
- **analyses**: the engine's four analyses run without error, and the row counts the variants and cases.

## Reference results (#151), from the seeds

| Row | What | Expected |
|---|---|---|
| R1 | Fig. 13 | tasks `{T1,T4,T5,T7,T8,T9}`, cost 215, implementing `{V2,V5,V6}`; all tasks 340; core groups `{V1…V4}`, `{V5}`, `{V6}` |
| E-Fig13-noncore | Fig. 13's erratum | the paper's NV1, NV2 "replaced by V2"; the formula gives seven non-core variants, replaced by V5 or V6 |
| R2 | Code 3 | G10's variant 4, G11's −2 |
| E-Ex1 | Example 1's erratum | the paper prints in person 1, by call −1; the formula gives −1 and +1 |
| R3 | Fig. 3 | `C0 ∧ ¬C2 ∧ ¬C3 ∧ C1 ∧ C6 ∧ C10 ∧ C11`, C14 its quality context |
| R4a | Example 2 | `C7 → ¬C8` under `wp8.1 → ¬wp7.1`; every variant with C7 ∧ C8 unadoptable |
| R4b | Example 3, Fig. 9 | its variant unsatisfiable, `!F7.1 \| !F1.1` the conflict |
| IST-Ex1 | IST 2013 Example 1, Fig. 6 | every variant activating ϕ1 and ϕ7 inconsistent |

## Oracle (`--oracle`)

`docker/dlv/run.sh` builds the image once. It downloads DLV 2.1.2 at build, never committed, because DLV's licence forbids redistribution, and pip-installs z3. Nothing is installed on the host.

- **dlv-<seed>**: DLV's answer sets of the seed's Code 2 equal the TS enumerator's variants. Each variant is compared as its elements and its contexts' atoms, as sets.
- **dlv-costs-all**, **dlv-costs-answer**: DLV's Code 4 sums Fig. 13's tasks to 340, and its answer to 215.
- **z3**: every satisfiability, equivalence and implication verdict the analyses take on the seeds' relations, in SMT-LIB 2, agrees with z3's.

Results go to `.cache/cgm/results/`:
- `SUMMARY.md`;
- a JSON per seed;
- `references.json`.

The oracle's jobs and outputs go to `.cache/cgm/jobs/` and `.cache/cgm/oracle/`.
