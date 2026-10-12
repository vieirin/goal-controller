# pool-nemo (spike, #72 / #73)

The definition pool's rules (#63's core rules and every engine's) on
[Nemo](https://github.com/knowsys/nemo), through the prepared-program bindings
of the `vieirin/nemo` fork (branch `vn/goal-controller-bindings`).

## The dependency

`nemo-wasm` is the Node.js package of the fork, installed from a release of
`vieirin/nemo` (branch `wasm-fast-reevaluation`). Nothing is built on install:

```json
"nemo-wasm": "https://github.com/vieirin/nemo/releases/download/nemo-wasm-v0.10.1-fork.1/nemo-wasm-node-0.10.1-fork.1.tgz"
```

Each release is one fixed build. To move to a newer build of the fork, release
it there (`nemo-wasm/Dockerfile`, then `nemo-wasm/pack.mjs`; see the
fork's `nemo-wasm/README.md`) and change the URL.

To try an unreleased build of a local checkout of the fork, link it instead,
without committing the change:

```sh
pnpm --filter @goal-controller/pool-nemo add nemo-wasm@link:<path to the fork>/nemo-wasm/pkg-node
```

## The gates

```sh
pnpm --filter @goal-controller/pool-nemo gates          # gate 1 and gate 3
pnpm --filter @goal-controller/pool-nemo gates:text     # also #72's text path
node gates.cjs bsn,synthetic                            # only some fixtures
```

- **Gate 1:** the `problem` tuples and the `resolves` count must match #63's
  evaluator on every fixture. There is also an edit sequence: the 10 oracle
  cases in turn on one engine, through `setFacts`.
- **Gate 3:** each keystroke is timed as the editor would run it. The rules are
  prepared once (`new NemoProgram`). Then, per keystroke:
  1. `createEngine` and `addFacts` load the facts as rows;
  2. `reason`;
  3. `getResultRows('problem')`.

  The script prints medians of 15 runs (3 at 2,200 elements), taken after
  warm-up runs. It also times a long-lived engine that uses `setFacts`.

`fixtures/*.json` hold #63's rules, extracted facts and derived results per
scenario, as #72 dumped them from #63's `FactPool`:

- the 10 oracle cases;
- medicine-delivery, tas3-edgev2, GODA BSN and Fragmented;
- the 2,200-element synthetic model, gzipped.
