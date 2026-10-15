# MutRoSe examples

`lab-sample-logistics/gm/LabSampleLogistics.txt` is `src/test/gm/LabSampleLogistics.gm`
from [mutrose-vscode](https://github.com/CPeluti/mutrose-vscode) (MIT License,
Copyright (c) 2025 Caio Peluti), as the istar-ts editor saves it, completed so it
decomposes: G2 (the query that controls `deliveries_requested`, which G1 refines
into but the original leaves out) is added, and G3's achieve condition ranges over
the deliveries. The original, unchanged, is a fixture of the lib's MutRoSe tests
(`packages/lib/test/engines/mutrose/fixtures/LabSampleLogistics.upstream.txt`).
Its world, HDDL domain and configuration were written for this repository.

`medicine-delivery/` was written for this repository.
