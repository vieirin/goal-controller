# Module-layout experiment

Model: `G0[G1@3->G16] G1[G2+G9] G2[G3#G6] G3[T4@3->T5] G6[T7+T8] G9[G10@3->G13] G10[T11;T12] G13[T14;T15] G16[G17#G24] G17[G18#G21] G18[T19?T20] G21[T22;T23] G24[G25;G28] G25[T26?T27] G28[T29|T30]` (N=10). Only the module layout differs between the edgeV2 variants; commands, formulas and constants are identical. Reproduce with `python3 layout_experiment.py`.

| model | layout | PRISM 4.9 (symbolic) | Storm 1.14 (sparse) |
|---|---|---|---|
| `edgev2.prism` | as generated | out of memory (CUDD) | 195 states in 0.035 s |
| `split.prism` | one module per task, tasks last | out of memory (CUDD) | 195 states in 0.032 s |
| `goals_postorder.prism` | goals children-first, one ChangeManager | out of memory (CUDD) | 195 states in 0.015 s |
| `postorder.prism` | one module per task, children-first | 195 states in 0.29 s | 195 states in 0.013 s |
| `reference.prism` | EDGE reference | 195 states in 0.236 s | 195 states in 0.016 s |
