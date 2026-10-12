# pool-nemo (spike, #72 / #73)

The definition pool's rules (#63's core rules and every engine's) on
[Nemo](https://github.com/knowsys/nemo), through the prepared-program bindings
of the `vieirin/nemo` fork (branch `vn/goal-controller-bindings`).

## The dependency

`nemo-wasm` is linked by a relative path to the fork's Node build. It isn't
vendored and isn't published:

```json
"nemo-wasm": "link:../../../../../../nemo/nemo-wasm/pkg-node"
```

The path is relative to this `package.json` in the
`.claude/worktrees/atomic-brewing-owl` worktree, with the fork checked out at
`~/vieirin/nemo`. From the main checkout, it would be `../../../nemo/nemo-wasm/pkg-node`.

To build the fork's packages (in Docker, with no Rust on the host):

```sh
cd ~/vieirin/nemo && docker build -f nemo-wasm/Dockerfile --output type=local,dest=nemo-wasm .
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
