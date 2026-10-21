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
3. Package tests run only for packages touched by the push, plus dependents along `dialect ← goal-language ← goal-tree ← lib ← ui`. Builds only what those suites need. A push that touches none of `packages/*` skips tests.

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
