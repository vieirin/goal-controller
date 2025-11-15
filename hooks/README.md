# Git Hooks

This directory contains git hooks for the project.

## Setup

To install all hooks, run the setup script:

```bash
./hooks/setup.sh
```

Or manually install hooks:

```bash
cp hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push

cp hooks/post-commit .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

## Available Hooks

### pre-push

Runs the test suite (`npm test`) before allowing a push. If tests fail, the push is aborted.

**To bypass the hook (not recommended):**
```bash
git push --no-verify
```

### post-commit

Automatically runs Prettier on committed TypeScript/JavaScript files and amends the commit with formatted code. This ensures all committed code is properly formatted.

**What it does:**
1. Gets the files from the last commit
2. Runs Prettier on TypeScript/JavaScript files
3. If formatting changes are made, amends the commit automatically

**Note:** The hook uses `--no-verify` when amending to prevent infinite loops with other hooks.

