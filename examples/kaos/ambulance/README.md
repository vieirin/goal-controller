# Brussels ambulance dispatching (ADS)

The core of Antoine Cailliau and Axel van Lamsweerde's ambulance
dispatching system model, from
[ancailliau/ADS](https://github.com/ancailliau/ADS) at `da3241f`
(`UCLouvain.AmbulanceSystem.Monitoring/Models`, MIT, © 2016 Antoine
Cailliau). The papers that use it are RE'12 (probabilistic obstacles),
RE'15 (expert estimates) and SEAMS'17 (runtime countermeasures).

- `ambulance.kaos` is ADS's `las.kaos` (41 goals, 8 agents) followed by its
  `obstacles.kaos` (76 obstacles, 47 of them leaves), byte for byte, but for
  two edits:
  - las.kaos's two `import` lines are commented out (`resolutions.kaos`, the
    third file las.kaos imports, is not part of this seed);
  - the `#` before the estimates of experts e1, e2, e3 and e5 is removed.
    ADS keeps every expert's estimates in the file and comments out all but
    one run's: e4's here, e1's in the thesis's copy of the same model. RE'15
    combines all five, so the seed reads all five (goal-controller#198).

  The file is the project's native file (goal-controller#181).
- `ambulance.txt` is the model as the `.kaos` importer reads it. It opens in
  kaosexpert's mode (goal-controller#190): its leaf obstacles' estimates
  are per expert (`Probability[e1]` … `Probability[e5]`, RE'15), and
  `experts.json` and `calibrations.json` are its five experts and three
  calibration variables, read from the file's `declare expert` and
  `declare calibration`, with `@experts.quantiles`. The root is
  `Achieve [Incident Resolved]`, which requires 95% (`rsr 95%`). kaosprop
  reads the same file, one switch away: it doesn't combine experts, so its
  obstacles have no probability and every goal is satisfied.
- ADS's data is kept as written, errors included: e4 gives "Allocated
  Ambulance Not At Station" (the leaf and the calibration variable) as
  `(30.00%, 10.00%, 50.00%)`, which the workbench reports (quantiles don't
  decrease; RE'15's Table IV prints 30/40/50 %), and kaosexpert leaves out.
- `ambulance.expected.csv` is the oracle `stress:kaos` checks: each
  expert's scores and weight, the root's distribution (VU 1, US 0.946,
  RE'15 0.9189; with Expert 1 alone 0.950, RE'15 0.9471), and each leaf
  obstacle alone against the root (§VII's violation diagram), with how
  each number compares with RE'15 and why the paper's can't be reproduced
  exactly (#198, results on #343).
- What the model has no place for (the model attributes `@author` and
  `@version`) is kept as written in the diagram's `kaosUnsupported`, and the
  importer lists each item when it reads the file.
