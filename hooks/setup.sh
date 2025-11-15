#!/bin/bash

# Setup script to install git hooks

HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_HOOKS_DIR="$HOOKS_DIR/../.git/hooks"

echo "Installing git hooks..."

# Install pre-push hook
if [ -f "$HOOKS_DIR/pre-push" ]; then
  cp "$HOOKS_DIR/pre-push" "$GIT_HOOKS_DIR/pre-push"
  chmod +x "$GIT_HOOKS_DIR/pre-push"
  echo "✅ Installed pre-push hook"
else
  echo "❌ pre-push hook not found"
  exit 1
fi

# Install post-commit hook
if [ -f "$HOOKS_DIR/post-commit" ]; then
  cp "$HOOKS_DIR/post-commit" "$GIT_HOOKS_DIR/post-commit"
  chmod +x "$GIT_HOOKS_DIR/post-commit"
  echo "✅ Installed post-commit hook"
else
  echo "⚠️  post-commit hook not found (optional)"
fi

echo ""
echo "Git hooks installed successfully!"
echo ""
echo "The pre-push hook will run tests before allowing pushes."
echo "The post-commit hook will format code with Prettier and amend commits."
echo ""
echo "To bypass hooks (not recommended):"
echo "  - Pre-push: git push --no-verify"
echo "  - Post-commit: git commit --no-verify (but this won't prevent the hook from running)"

