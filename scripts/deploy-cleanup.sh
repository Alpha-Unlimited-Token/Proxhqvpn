#!/bin/bash
# deploy-cleanup.sh — runs after artifact builds, before image packaging.
# Removes directories that are large and unnecessary in the production image.
set -e

echo "[deploy-cleanup] Starting post-build cleanup..."

# 1. Prune pnpm store (removes unused packages from the content-addressable store)
pnpm store prune || true
echo "[deploy-cleanup] pnpm store pruned"

# 2. Remove git history — not needed at runtime (~1.7 GiB saved)
rm -rf .git
echo "[deploy-cleanup] .git removed"

# 3. Remove standalone platform build directory — desktop/CLI builds, not served (~2.1 GiB saved)
rm -rf standalone
echo "[deploy-cleanup] standalone/ removed"

# 4. Remove Electron desktop app — not deployed as part of web service
rm -rf artifacts/desktop
echo "[deploy-cleanup] artifacts/desktop removed"

# 5. Remove source maps from all dist directories (*.map files)
#    These help debugging but are not required at runtime and can be large.
find . -name "*.map" -path "*/dist/*" -not -path "./.git/*" -delete 2>/dev/null || true
echo "[deploy-cleanup] source maps removed from dist/"

# 6. Remove any node_modules/.cache directories
find . -type d -name ".cache" -path "*/node_modules/.cache" -exec rm -rf {} + 2>/dev/null || true
echo "[deploy-cleanup] node_modules/.cache directories removed"

echo "[deploy-cleanup] Cleanup complete."
