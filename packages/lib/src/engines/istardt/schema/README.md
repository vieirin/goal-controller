# iStarDT-X's schema

The `.istardt`/`.istardtx` format's schema (goal-controller#144 item 2): `istar_dt_x_schema.xsd`, as cmg-york/istardt has it at `649c9be2a0a45ee42d2056d9fed68016ac4f3689` (`src/main/resources/xsd/`, the commit `scripts/istardt-stress` and `docker/dtx2dtg` pin). SHA-256 `7c4e8978b65b72ca6b51eab81a3dc1f7f57fab097005ba16a12c13d4edf6f75c`.

The defaults the XSD gives (a goal's `root`, `terminal`, `episodeLength`, a quality's `root`, an effect's `satisfying`) are the ones `canonicalIstardtx` drops. dtx2dtg's Schematron, which the writer also satisfies (every goal's `episodeLength`, a `description` everywhere), isn't committed: `docker/dtx2dtg` runs it.

GNU LGPL 2.1 (`LICENSE-LGPL-2.1`, the repository's `LICENSE`), as the seeds under `examples/istardt/`. Copied unchanged.
