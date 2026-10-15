# iStar-DT: Heating (3.2.Heating_10R_Mixed.istardtx)

**What it exercises:** what Order doesn't: a condition box with `previous`, qualities that read their own previous value and a condition, continuous exports with bounds, a cross-run set that mixes qualities and a condition, and ten runs per episode (goal-controller #119).

- **Source:** [cmg-york/istardt](https://github.com/cmg-york/istardt) (`dtx2dtg` v0.2.0) `src/test/resources/dtx2dtg/3.2.Heating_10R_Mixed.istardtx` at commit `649c9be2a0a45ee42d2056d9fed68016ac4f3689`, copied unchanged. The fixture, not `src/main/resources/xml/Heating.istardt`: that example is an earlier version (`hvacOn` a predicate rather than a condition, `continuous = "false"`) and has no golden output.
- **Licence:** GNU LGPL 2.1. `LICENSE-LGPL-2.1` is the repository's `LICENSE`, copied unchanged. The model and `reference/Heating.pl` are © their authors (Liaskos et al., York University's CMG), redistributed unmodified under the LGPL with this notice.
- **What is in the project:**
  - `3.2.Heating_10R_Mixed.istardtx`: the source.
  - `Heating.istardtx`: the model as our iStarDT-X writer writes it, its native file (`project.json`'s `models[].native`, goal-controller#144); dtx2dtg's validator accepts it, and `pnpm stress:istardt` fails when it isn't what the writer writes now. The source above stays as copied.
  - `Heating.txt`: the model `importIstardt` makes of it, laid out by `importers/layout.ts`.
  - `reference/Heating.pl`: dtx2dtg's golden output, `3.2.Heating_10R_Mixed-Auth.pl`.
  - `reference/utility.txt`: DT-Golog's run of our output (`docker/dtgolog/`): expected utility −4.8475 over `bp`'s horizon of 10, probability 1.0. dtg2sim's `7HeatingContinuousMutiRun4_Trials.py` (−1.360857) is a hand-written four-run model, not this one.
- **What was mapped** (#117 D1–D7):
  - 1 goal, 2 tasks (OR), their effect groups and 4 effects, each linked to the predicate it turns true;
  - Overall Quality as its 2 utility links (0.3 from Cost, 0.7 from Comfort), as mx2dtx's diagram draws it; the 4 other qualities with their formulas, and a reads link from each element a formula names (PRE for a previous value), as the paper's figure draws them; as the goal language's expressions: `roomTemperature`'s is `0.5 + 0.9 * previous(roomTemperature) + hvacOn * (0.05 * previous(roomTemperature) + 1.75)`;
  - the condition `C1` (`hvacOn`), its formula as an assertion, fully parenthesised: `((previous(hvacOn) & (!(signalOffS))) | signalOnS)` (#126: a call is a condition on its own);
  - 4 predicates; `roomTemperature`'s and `runningTime`'s export bounds on the qualities;
  - the actor's sets, in the file's order.
- **What is read differently:** the file exports `hvacOn`, a condition; DT-Golog exports goals, tasks and predicates (discrete), qualities and variables (continuous), so dtx2dtg leaves it out, and so does the writer (a warning).
- **Checked by:** `pnpm stress:istardt`: the import, the checks, the output byte for byte after the header against `reference/Heating.pl`, and with `--oracle` DT-Golog's utility and policy against the golden file's.
