# TAOM4E-MM.ecore

TAOM4E's base Tropos metamodel (FBK-irst, `it.itc.sra.taom4e.model`), the one
the `.tropos` importer (`../index.ts`) is written against. Copied unchanged.

- **Origin:** [markhibberd/tefkat](https://github.com/markhibberd/tefkat),
  `tefkat.engine.tests/transformation/models/TAOM4E-MM.ecore`, last changed in
  commit `5e4a1b446d66645860c025dce9bf378327c0c4a9` (2008-05-11), fetched
  2026-10-15. SHA-256
  `999b9e5eebc390a46cefd87569db605e7d125a1a622089169f8a6a336237727a`, 46,716
  bytes.
- **Licence:** the tefkat repository has no licence file. TAOM4E itself was
  GPL-2 (its Google Code record, goal-controller#134). The file is kept as
  the importer's reference, not built or shipped.
- **What it has:** packages `core.gencore`, `core.informalcore` (actors, hard
  goals, softgoals, plans, resources, AND/OR decomposition, means-end,
  contribution, dependency), `core.informalcore.formalcore` (Formal Tropos's
  `mode`, `creationProperty`, `invariantProperty`, `fulfillmentProperty`,
  `metric`), `diagram` (positions) and `project`.
- **What it doesn't have:** any Tropos4AS concept (artifacts, failures,
  errors, conditions as Tropos4AS writes them). Those are in REJ 2017's
  figures only (#134).

No `.tropos` file written by TAOM4E survives, so the importer's fixtures
(`packages/lib/test/engines/tropos4as/taom4e/`) are written by hand against
this file: **unverified against TAOM4E**.
