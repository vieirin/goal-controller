# COOL carpooling (REJ'13)

A. Cailliau, A. van Lamsweerde. *Assessing requirements-related risks
through probabilistic goals and obstacles*. Requirements Engineering
18(2):129–146, 2013, §6.3
([doi:10.1007/s00766-013-0168-5](https://doi.org/10.1007/s00766-013-0168-5)).

No machine-readable model of the paper exists. `carpooling.kaos` is
re-keyed from the paper's figures, in KAOSTools' syntax:

- Fig. 4's chain of milestone refinements to `Achieve [RideRequestServed]`
  (`rsr 95%`);
- Fig. 6's obstacle tree, each `refinedby` one alternative (an OR);
- Table 3's estimates for the leaves (`probability 6%`, …).

The three sibling subtrees the paper gives only as results (0.66, 0.808,
0.65) are their goals' `esr`. The paper's figures are reproduced as data
with this citation.

kaosprop reproduces the paper's chain: 0.015 → 0.08 → 0.12 → 0.19 → 0.81
→ 0.526 → 0.425 → **0.28**, against the root's required 95%
(goal-controller#181; lib's `test/importers/kaos.test.ts`). The same model
drawn by hand is kaosprop's unit oracle
(`packages/lib/test/engines/kaosprop/fixtures/rej13-carpooling.txt`).
`carpooling.txt` is the model as the `.kaos` importer reads the file. The
paper's critical pairs (470 of 1953) need its full 63-leaf model, which it
doesn't contain, so they are not checked.
