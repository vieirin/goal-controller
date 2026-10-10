# GODA-MDP: BSN (BSN.txt)

**What it exercises:** the SEAMS 2019 Body Sensor Network exemplar: 5-operand DM with T1.X, three-level ids, the same id under different goals.

- **Source:** [lesunb/pistarGODA-MDP](https://github.com/lesunb/pistarGODA-MDP) `docs/examples/BSN/` at commit `c8519f703a2337980a041fdbf09235ab51744fb4` (Solano et al., SEAMS 2019). The model and its `output/` files are copied unchanged. `reference/` holds upstream's outputs.
- **Permission:** included with the permission of LES/UnB, through one of the lab's advisors (goal-controller #34, D30). The upstream repository itself has no licence file.
- **Generator version:** `5305bc1`. The upstream reference outputs were made with this version (#34, D10), so `project.json` sets `options.variant` to it. Generating in the workbench reproduces every file in `reference/` byte for byte (checked by `pnpm stress:goda`, #35).
