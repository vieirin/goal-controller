# iStar-DT: Garden (istardt-own.istardtx)

**What it exercises:** what none of dtx2dtg's nine fixtures has, in one model DT-Golog solves, so the importer, the checks and the writer cover the whole BNF (goal-controller #119):

- negative precedence (`npr`): the sprinkler isn't run once the soil is read wet (`soilWet`, a condition), and an OR sibling's `npr`, which the checks say is implied (info);
- a `pre` that is a formula rather than one element's name (`waterByHand`'s), which the importer turns into a condition it names (`waterByHandPre`, #117 D2), beside a `pre` that names a goal (`waterGarden` after `inspectGarden`);
- `turnsFalse` (watering makes the soil no longer dry), `set` (each reading sets `moisture`), and a variable, `moisture`, read by a condition's comparison (`moisture > 50`) and by a quality, exported continuous and carried across runs;
- a division (`moisture / 100`) and a negation (`-waterCost`) in the qualities' formulas, and a quality that reads its own previous value;
- three goals under an AND root (six orders of DT-Golog procedures), the gardener's and the owner's (`reportToOwner`) under the one actor iStar-DT has.

- **Source:** written for goal-controller as an iStarDT-X file, following the BNF and XSD of cmg-york/istardt at `649c9be`.
- **Licence:** the repository's.
- **What is in the project:**
  - `istardt-own.istardtx`: the source.
  - `istardt-own.txt`: the model `importIstardt` makes of it, laid out by `importers/layout.ts`.
  - `reference/utility.txt`: DT-Golog's run of our output (`docker/dtgolog/`), its reference: there is no golden file. Expected utility −0.5384, probability 0.6: when the soil reads wet, the `npr` blocks the sprinkler and the `pre` blocks watering by hand, so that branch stops.
- **What was mapped:** 4 goals, 6 tasks, 12 effects, 4 qualities, 2 conditions (`soilWet` and the importer's `waterByHandPre`), 10 predicates, 1 variable; 9 refinements, 12 effect links, 2 precedence and 2 negative precedence links.
- **Unverified:** what dtx2dtg leaves as a TODO (`npr`, `turnsFalse`, `set`, a variable, a task's own `pre`, a division, a negation, a comparison in a condition) is written as ER 2024 §3.2 and the BNF say, and checked only by DT-Golog running it (`packages/dialect/docs/istardt.md`).
- **Checked by:** `pnpm stress:istardt`: the import, the checks, and with `--oracle` DT-Golog's utility and policy against `reference/utility.txt`.
