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
it there and change the URL, as below.

To try an unreleased build of a local checkout of the fork, link it instead,
without committing the change:

```sh
pnpm --filter @goal-controller/pool-nemo add nemo-wasm@link:<path to the fork>/nemo-wasm/pkg-node
```

## Releasing a new build of the fork

Releases are made from a checkout of `vieirin/nemo` (here `~/vieirin/nemo`),
with Docker and Node.js. No Rust toolchain is needed on the host.

1. Commit and push the change to the fork's `wasm-fast-reevaluation` branch
   (`git push origin wasm-fast-reevaluation`). Releases are only for pushed
   commits. Push to `origin` (`vieirin/nemo`) only, never to `upstream`
   (`knowsys/nemo`).

2. Build the packages and run the smoke test:

   ```sh
   cd ~/vieirin/nemo
   docker build -f nemo-wasm/Dockerfile --output type=local,dest=nemo-wasm .
   node nemo-wasm/tests/smoke.mjs
   ```

3. Choose the version: Nemo's version with a `-fork.<n>` suffix, where `<n>`
   is one more than the last release (see `gh release list --repo vieirin/nemo`).
   Pack both packages outside the repository:

   ```sh
   V=0.10.1-fork.2
   OUT=$(mktemp -d)
   node nemo-wasm/pack.mjs pkg-node $V $OUT   # nemo-wasm-node-$V.tgz
   node nemo-wasm/pack.mjs pkg-web $V $OUT    # nemo-wasm-web-$V.tgz
   ```

4. Tag the commit and publish the release, with both tarballs attached.
   `--repo` is required: for a fork, `gh` defaults to the upstream repository.

   ```sh
   git tag -a nemo-wasm-v$V -m "nemo-wasm $V"
   git push origin nemo-wasm-v$V
   gh release create nemo-wasm-v$V --repo vieirin/nemo --verify-tag --prerelease \
     --title "nemo-wasm $V" --notes "Built from wasm-fast-reevaluation at $(git rev-parse --short HEAD)." \
     $OUT/nemo-wasm-node-$V.tgz $OUT/nemo-wasm-web-$V.tgz
   ```

5. In this repository, change the URL of `nemo-wasm` in `package.json` (and in
   "The dependency" above) to the new asset,
   `https://github.com/vieirin/nemo/releases/download/nemo-wasm-v$V/nemo-wasm-node-$V.tgz`,
   then install and check it:

   ```sh
   pnpm install
   pnpm --filter @goal-controller/pool-nemo gates
   ```

   Edit the URL by hand: `pnpm add nemo-wasm@<url>` (pnpm 8) writes the
   version (`"0.10.1-fork.1"`) into `package.json` instead of the URL, which
   would then be looked up on the npm registry.

   Gate 1 must pass. Then commit `package.json`, this README's URL and
   `pnpm-lock.yaml` together.

Don't replace the assets of an existing release. The lockfile records only
the tarball's URL, not its checksum, so a replaced asset would change what
installs without any change here. Publish a new version instead.

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
