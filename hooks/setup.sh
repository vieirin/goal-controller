#!/bin/bash

# Install git hooks from this directory into .git/hooks

HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_HOOKS_DIR="$HOOKS_DIR/../.git/hooks"

echo "Installing git hooks..."

install_hook() {
  local name="$1"
  local required="${2:-true}"
  if [ -f "$HOOKS_DIR/$name" ]; then
    cp "$HOOKS_DIR/$name" "$GIT_HOOKS_DIR/$name"
    chmod +x "$GIT_HOOKS_DIR/$name"
    echo "✅ Installed $name hook"
  elif [ "$required" = true ]; then
    echo "❌ $name hook not found"
    exit 1
  else
    echo "⚠️  $name hook not found (optional)"
  fi
}

install_hook pre-push true
install_hook post-commit true

echo ""
echo "Git hooks installed."
echo "  post-commit — oxfmt + oxlint --fix, amend if needed"
echo "  pre-push    — oxfmt --check, oxlint, then pnpm test"
echo ""
echo "Bypass (not recommended): git push --no-verify"
