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
  kaosprop's mode. `Achieve [Incident Resolved]` requires 95%
  (`rsr 95%`).
- What the model has no place for yet is kept as written in the diagram's
  `kaosUnsupported`, and the importer lists each item when it reads the
  file. That covers the five experts, the three calibrations, the
  obstacles' per-expert estimates (`probability[e4] (…)`, RE'15) and the
  model attributes `@author`, `@version` and `@experts.quantiles`.
  Combining the experts is a later round's job (goal-controller#190). Until
  then the obstacles have no probability, and kaosprop finds every goal
  satisfied.
