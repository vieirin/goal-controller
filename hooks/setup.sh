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

echo ""
echo "Git hooks installed successfully!"
echo ""
echo "The pre-push hook will now run tests before allowing pushes."
echo "To bypass the hook (not recommended), use: git push --no-verify"

