# GODA-MDP: AND (and2.txt)

**What it exercises:** AND refinement: the smallest case.

- **Source:** [lesunb/pistarGODA-MDP](https://github.com/lesunb/pistarGODA-MDP) `docs/examples/AND/` at commit `c8519f703a2337980a041fdbf09235ab51744fb4` (Solano et al., SEAMS 2019). The model and its `output/` files are copied unchanged. `reference/` holds upstream's outputs.
- **Permission:** included with the permission of LES/UnB, through one of the lab's advisors (goal-controller #34, D30). The upstream repository itself has no licence file.
- **Generator version:** `cc808b6`. The upstream reference outputs were made with this version (#34, D10), so `project.json` sets `options.variant` to it. Generating in the workbench reproduces every file in `reference/` byte for byte (checked by `pnpm stress:goda`, #35).
