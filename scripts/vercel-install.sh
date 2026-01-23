#!/bin/bash
set -e

# Enable corepack (comes with Node.js)
corepack enable

# Prepare and activate pnpm 8.15.0
corepack prepare pnpm@8.15.0 --activate

# Verify pnpm version
pnpm --version

# Install dependencies
pnpm install --no-frozen-lockfile

