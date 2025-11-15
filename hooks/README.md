# Git Hooks

This directory contains git hooks for the project.

## Setup

To install the pre-push hook (runs tests before allowing push):

```bash
cp hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

Or run the setup script:

```bash
./hooks/setup.sh
```

## Available Hooks

### pre-push

Runs the test suite (`npm test`) before allowing a push. If tests fail, the push is aborted.

**To bypass the hook (not recommended):**
```bash
git push --no-verify
```

