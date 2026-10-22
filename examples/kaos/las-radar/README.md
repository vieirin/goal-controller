# London Ambulance design space (RADAR's LAS.rdr)

RADAR's decision model of the London Ambulance Service: 5 decisions, 648
designs, two objectives (Busari and Letier, *RADAR: a lightweight tool for
requirements and architecture decision analysis*, ICSE'17). Here it is
re-keyed as a kaossim model, so that RADAR is a design-by-design oracle for
kaossim's simulation and its design-space search (goal-controller#193,
#207).

## Where it comes from

- **The model:** `docs/LAS.rdr` in
  [UCL-badass/radar](https://github.com/UCL-badass/radar) at `53272ca`
  (2017-07-20). It is the same file, byte for byte, as
  `src/main/resources/uk.ac.ucl.cs.examples/LAS/LAS.rdr` at `e430316`. It is
  used with the owner's approval; the repository states no licence. Every
  number is the file's.
- **The oracle:** RADAR itself (sbusari/RADAR `e0a4503`), built and run in
  Docker (`maven:3.6-jdk-8`) on 2026-10-21, outside this repository.
  Nothing of RADAR is copied here.

## How RADAR's model maps onto KAOS

RADAR has no goals. Its model is a set of quantity variables, each defined
in one of two ways:

- by an equation, an AND refinement in RADAR's graph;
- by a decision, an OR with one estimate per option.

The seed places them on a KAOS model as follows:

- each variable is a quality variable of a goal named after what it is
  about ("Ambulance mobilised", "Incident form encoded");
- each equation sits on the refinement of the goal that declares the
  variable;
- each decision is a goal with one OR responsibility assignment per option,
  which is RE'11's OR-assignment, its `SysRef` the option's system
  reference. The SysRef is `<decision>: <option>`, as RADAR names both, and
  the agent is named the same.

A decision that sets two variables (`Incident Form Encoding Method` sets the
call-taking time and its cost) is one decision point with both estimates on
each assignment, as in RADAR.

RADAR's distributions map one to one:

| RADAR | kaossim |
| --- | --- |
| `exponential(m)` | `exponential[m]`, its mean (commons-math's) |
| `normal(m, s)` | `normal[m, s]` |
| `normalCI(a, b)` | `normalci[a, b]`: a 90 % interval, σ = (b − a)/3.29 (RADAR's constant) |
| `triangular(a, b, c)` | `triangular[a, b, c]` |
| `deterministic(n)` | `n` |

## The one departure: the risk objective's sign (D4)

Line 3 of `LAS.rdr` is `Objective Min Risk = Pr (ResponseTime <= 14*60);`.
The report (`docs/LAS_report.html`) prints `Pr(ResponseTime > 14*60)`, "the
probability that the ambulance response time exceeds 14 minutes". The seed
takes the report's sign, as decided on #189 (D4).

Running RADAR shows that the report's numbers are the file's sign's (#189,
#369):

- **Rounding.** RADAR's CLI prints values with no decimals: it sets no
  output precision. Run with 6 decimals, the file's sign gives Risk
  0.1206–0.1363, which is the report's 0.12–0.13. So "Risk = 0 for every
  design" was rounding.
- **The report's sign** gives Risk ≈ 0.80–0.88, and one Pareto-optimal
  design on every run.
- **The report's five shortlisted designs** are the file's sign's. With it,
  RADAR shortlists 6 designs on one run and 4 on another (it is unseeded,
  and those designs are within Monte Carlo noise of each other). kaossim's
  exhaustive front with that sign is the first run's 6.
- **A second discrepancy:** the report's text gives
  `MobilisedAmbulanceDistanceFromLocation = normalCI(10000,100000)` where
  the file has `triangular(10000, 50000, 100000)`. The report's Risk values
  are the triangular's: the normalCI gives 0.18–0.20. The seed keeps the
  file's.

## The oracle

`las-radar.expected.csv`, checked by `scripts/kaos-stress` at 100 000
samples, seed 1:

- **648 designs**, RADAR's SolutionSpace.
- **One Pareto-optimal design**, RADAR's one shortlisted with this sign:
  Computer-Based and Automated Call Location, Fully Automated Allocation,
  MDT-System B, Automated Vehicle Location B, 100 ambulances. Both the
  exhaustive search and seeded NSGA-II find it.
- **Risk and ExpectedBenefit** of the designs in `designs.json` (the current
  system, RADAR's optimal one, the report's five), each against RADAR's value
  within 4σ of the two Monte Carlo runs combined. All 648 designs agree with
  RADAR within 4σ, the worst at 1.2σ (#369). The rows check seven of them.
- **The report's printed Risk values**, listed as not reproducible with the
  report's sign.

## Files

- `las-radar.kaos`: the project's native file, the designs as `declare
  design`. It opens in kaossim's mode.
- `las-radar.txt`: the model, `las-radar.kaos` read.
- `designs.json`: the designs the oracle names, also read from
  `las-radar.kaos`.
- `las-radar.expected.csv`: the oracle.
