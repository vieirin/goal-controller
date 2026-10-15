# iStar-DT: Order (1.Order.istardtx)

**What it exercises:** the iStarDT-X importer and the DT-Golog writer on the smallest of dtx2dtg's golden pairs, ER 2024's running example: one OR decision between two suppliers, each with three probabilistic effects, and a reward that is a formula over the predicates the effects turn true (goal-controller #119).

- **Source:** [cmg-york/istardt](https://github.com/cmg-york/istardt) (`dtx2dtg` v0.2.0) `src/test/resources/dtx2dtg/1.Order.istardtx` at commit `649c9be2a0a45ee42d2056d9fed68016ac4f3689`, copied unchanged. The fixture, not `src/main/resources/xml/Order.istardt`: that example differs (`continuous = "false"`, five runs) and has no golden output.
- **Licence:** GNU LGPL 2.1. `LICENSE-LGPL-2.1` is the repository's `LICENSE`, copied unchanged. The model and `reference/Order.pl` are © their authors (Liaskos et al., York University's CMG), redistributed unmodified under the LGPL with this notice.
- **What is in the project:**
  - `1.Order.istardtx`: the source.
  - `Order.istardtx`: the model as our iStarDT-X writer writes it, its native file (`project.json`'s `models[].native`, goal-controller#144); dtx2dtg's validator accepts it, and `pnpm stress:istardt` fails when it isn't what the writer writes now. The source above stays as copied.
  - `Order.txt`: the model `importIstardt` makes of it, in the iStar-DT dialect, laid out by `importers/layout.ts` (the file has no diagram).
  - `reference/Order.pl`: dtx2dtg's golden output, `1.Order-Auth.pl`.
  - `reference/utility.txt`: DT-Golog's run of our output (`docker/dtgolog/`): expected utility 0.9235, the optimum dtg2sim's `1Order_Trials.py` records, probability 1.0, and the policy.
- **What was mapped** (#117 D1–D7):
  - 1 goal `G1` (the root, one run per episode), 2 tasks `T1`, `T2`, refined by 2 OR links;
  - each task's effect group (`eff`), and its 6 effects `E1`–`E6` hanging from it with their probabilities, each with an `identifier` (`deliveredInTimeA_Eff`: its name isn't the camelCase of its description);
  - 6 predicates `P1`–`P6`, each linked from the effect that turns it true;
  - 3 qualities `Q1`–`Q3`, `Q3` the root (the reward): each a weighted sum, drawn as 12 utility links as mx2dtx's `1.Order.drawio` draws them (10 from the effects to Cost and Happy Customer, 0.7 and 0.3 from those to Overall Quality), with no formula;
  - the actor's sets: `crossRun`, `exported`, `initializations`, in the file's order.
- **Checked by:** `pnpm stress:istardt`: the import, the checks, the output byte for byte after the header against `reference/Order.pl`, and with `--oracle` DT-Golog's utility and policy against the golden file's.
