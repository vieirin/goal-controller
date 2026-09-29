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

Blocks the push unless, for source files in the commits being pushed:

1. `oxfmt --check` passes
2. `oxlint` passes (generated `antlr` trees ignored)
3. `pnpm test` passes

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
