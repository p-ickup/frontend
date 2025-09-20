#!/bin/bash

echo "🔧 Fixing dependency issues..."

# Clear caches
echo "📦 Clearing caches..."
pnpm store prune
rm -rf .next
rm -rf node_modules/.cache 2>/dev/null || true

# Remove corrupted modules
echo "🗑️ Removing corrupted node_modules..."
rm -rf node_modules
rm pnpm-lock.yaml

# Reinstall with correct version
echo "⬇️ Reinstalling dependencies..."
corepack use pnpm@9.15.2
pnpm install

echo "✅ Dependencies fixed!"
echo "💡 Tip: Consider running 'pnpm install --frozen-lockfile' for production builds"
