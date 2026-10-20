# Brussels ambulance dispatching (ADS)

The core of Antoine Cailliau and Axel van Lamsweerde's ambulance
dispatching system model, from
[ancailliau/ADS](https://github.com/ancailliau/ADS) at `da3241f`
(`UCLouvain.AmbulanceSystem.Monitoring/Models`, MIT, © 2016 Antoine
Cailliau). The papers that use it are RE'12 (probabilistic obstacles),
RE'15 (expert estimates) and SEAMS'17 (runtime countermeasures).

- `ambulance.kaos` is ADS's `las.kaos` (41 goals, 8 agents) followed by its
  `obstacles.kaos` (76 obstacles), byte for byte, except las.kaos's two
  `import` lines, which are commented out. `resolutions.kaos`, the third
  file las.kaos imports, is not part of this seed. The file is the
  project's native file (goal-controller#181).
- `ambulance.txt` is the model as the `.kaos` importer reads it. It opens in
  kaosexpert's mode (goal-controller#190): its obstacles' estimates are per
  expert (`Probability[e4]`, RE'15), and `experts.json` and
  `calibrations.json` are its five experts and three calibration variables,
  read from the file's `declare expert` and `declare calibration`, with
  `@experts.quantiles`. `Achieve [Incident Resolved]` requires 95%
  (`rsr 95%`). kaosprop reads the same file, one switch away: it doesn't
  combine experts, so its obstacles have no probability and every goal is
  satisfied.
- ADS's data is kept as written, errors included: the calibration
  variable "Allocated Ambulance Not At Station" gives e4's quantiles as
  `(30.00%, 10.00%, 50.00%)`, which the workbench reports (quantiles don't
  decrease). Most of ADS's estimates are commented out in the file, so only
  e4's are read. Reproducing RE'15's ADS numbers is goal-controller#198's.
- What the model has no place for (the model attributes `@author` and
  `@version`) is kept as written in the diagram's `kaosUnsupported`, and the
  importer lists each item when it reads the file.
