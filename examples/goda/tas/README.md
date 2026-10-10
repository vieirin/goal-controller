# GODA-MDP: TAS (TAS.txt)

**What it exercises:** DM on goals, assertion conditions on goals, three DM task groups, Resources without ids.

- **Source:** [lesunb/pistarGODA-MDP](https://github.com/lesunb/pistarGODA-MDP) `docs/examples/TAS/` at commit `c8519f703a2337980a041fdbf09235ab51744fb4` (Solano et al., SEAMS 2019). The model and its `output/` files are copied unchanged. `reference/` holds upstream's outputs.
- **Permission:** included with the permission of LES/UnB, through one of the lab's advisors (goal-controller #34, D30). The upstream repository itself has no licence file.
- **Generator version:** `5305bc1`. The upstream reference outputs were made with this version (#34, D10), so `project.json` sets `options.variant` to it. Generating in the workbench reproduces every file in `reference/` byte for byte (checked by `pnpm stress:goda`, #35).
