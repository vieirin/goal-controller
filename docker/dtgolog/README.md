# DT-Golog as iStar-DT's oracle

iStar-DT's DT-Golog output (goal-controller #119) is run with DT-Golog itself, #117 D1.2.

**What it does.** The image is SWI-Prolog 9.2.9 with:
- Soutchanski's DT-Golog interpreter (`DT-Golog.pl`, October 1999), downloaded when the image is built from [its author's page](https://www.cs.ryerson.ca/~mes/publications/appendix/appendixC/dtgolog), and patched as [RLGen's README](https://github.com/cmg-york/RLGen) says: `:- pragma(debug).` commented out, `not` declared an operator, `cputime/1` defined;
- dtg2sim's `DT-Golog-Iface.pl` and `DT-Golog-Ext.pl` at `ed424ff` (pinned in the Dockerfile);
- `shim.pl`, goal-controller's, for what no published file defines: `getInitValue/2`, `initiallyTrue/1` and `val/2` (which dtx2dtg's programs call), and ECLiPSe's `printf/2,3` and `date/1` (which `bp/6` writes its report with).

`run.pl` loads one program and runs its own `dtgRun(Policy, Utility, Probability)` (`bp(root, 10, …)`, as dtx2dtg writes it), in a fresh SWI-Prolog. `oracle.pl` does so for every `.pl` in a directory and writes `<name>.txt`:

```
Utility: 0.9235
Probability: 1.0
Policy: orderFromSupplierB:senseEffect(orderFromSupplierB):if(…)
```

or `ERROR: <why>`.

**How to run it.** Docker only: nothing is installed on the host.

```sh
docker/dtgolog/run.sh <programs directory> <output directory>
```

`pnpm stress:istardt --oracle` runs it on the seeds' programs and their golden files (`scripts/istardt-stress/`).

**Licence.** `DT-Golog.pl` is "non-commercial research purpose only; do not distribute without permission". It is downloaded inside the image when it is built, never committed here, and **the image is never pushed**. dtg2sim has no licence: its two files are fetched, not committed. `shim.pl`, `run.pl`, `oracle.pl` and `run.sh` are goal-controller's.
