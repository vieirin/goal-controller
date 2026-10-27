# Git Hooks

## Setup

```bash
pnpm setup-hooks
# or
./hooks/setup.sh
```

## Hooks

### post-commit

Runs `oxfmt` and `oxlint --fix` on files in the new commit. If anything changes, amends the commit (`--no-verify` so hooks do not loop). Skips amend when `HEAD` is already on the remote.

### pre-push

Blocks the push unless, for files in the commits being pushed:

1. `oxfmt --check` passes on the changed source-like files
2. `oxlint` passes on the changed JS/TS files
3. Package tests run only for packages touched by the push, plus dependents along `dialect ← goal-language ← goal-tree ← lib ← ui`. Compiles (via each package's `compile` script, not `build`, so it never deletes `out/` and races a running dev watcher) only what those suites need. A push that touches none of `packages/*` skips tests.

"The commits being pushed" are those after the remote branch's tip. For a branch that is new on the remote, they are the commits no `origin` branch has yet, so a branch cut from a pushed branch other than main (e.g. an integration branch) is checked for its own commits only.

Bypass (not recommended):

```bash
git push --no-verify
```


## Manual commands

```bash
pnpm format       # write formatting
pnpm format:check
pnpm lint
pnpm lint:fix
```
