# Dependency Fix Guide

## Quick Commands

### When dependencies are corrupted:

```bash
pnpm run fix-all-deps
```

### For lighter fixes (original script):

```bash
pnpm run fix-deps
```

### For basic cleanup:

```bash
pnpm run clean
```

## What the Enhanced Script Does

The `fix-all-deps` script handles **ALL** possible corruption scenarios:

### 🛑 Stops Running Servers

- Kills any running Next.js dev servers
- Prevents port conflicts during reinstall

### 🧹 Comprehensive Cache Cleaning

- Next.js caches (`.next`, `.next/cache`)
- Node.js caches (`node_modules/.cache`)
- Package manager caches (pnpm, npm, yarn stores)
- TypeScript build info (`tsconfig.tsbuildinfo`)
- ESLint cache (`.eslintcache`)
- Jest cache and coverage
- OS-specific caches (macOS/Linux)

### 🗑️ Complete Dependency Removal

- Removes `node_modules`
- Removes ALL lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`)
- Removes stray `.bin` directories

### 📦 Package Manager Setup

- Ensures correct pnpm version (9.15.2)
- Uses corepack when available
- Falls back to system pnpm
- Installs pnpm globally if missing

### ⬇️ Clean Reinstall

- Clears pnpm store
- Fresh install with `--no-frozen-lockfile`
- Verifies critical packages (React, TypeScript, Next.js)

### 🧪 Verification Tests

- TypeScript compilation test
- React import test
- Next.js build test (with timeout)
- Comprehensive error reporting

### 💾 Backup & Recovery

- Creates timestamped backup of `package.json`
- Shows how to restore from backup if needed

## Prevention Tips

1. **Always use pnpm**: Never mix npm/yarn with pnpm
2. **Use the safe install**: `pnpm run install-safe` for production
3. **Don't edit node_modules**: Let pnpm manage everything
4. **Regular maintenance**: Run `pnpm run fix-all-deps` weekly
5. **Check for conflicts**: Look for multiple lock files

## Common Corruption Causes

- Mixing package managers (npm + pnpm)
- Interrupted installations
- Manual node_modules edits
- Corrupted pnpm store
- OS-specific cache issues
- IDE interference with node_modules

## When to Use Each Script

| Script         | Use When             | What It Does                               |
| -------------- | -------------------- | ------------------------------------------ |
| `fix-all-deps` | **Major corruption** | Complete nuclear option - fixes everything |
| `fix-deps`     | Minor issues         | Basic cleanup and reinstall                |
| `clean`        | Quick cleanup        | Just removes caches                        |

## Emergency Recovery

If even `fix-all-deps` fails:

1. **Check your shell**: Make sure you're using bash/zsh
2. **Check permissions**: Ensure script is executable
3. **Manual steps**:
   ```bash
   rm -rf node_modules pnpm-lock.yaml package-lock.json yarn.lock
   rm -rf .next .eslintcache tsconfig.tsbuildinfo
   corepack use pnpm@9.15.2
   pnpm install
   ```

## Success Indicators

After running `fix-all-deps`, you should see:

- ✅ React: [version]
- ✅ TypeScript: [version]
- ✅ Next.js: [version]
- ✅ TypeScript compilation successful
- ✅ React import successful
- ✅ Next.js build successful

If any of these fail, the script will exit with an error message.

## Security Audit Exceptions

CI runs `pnpm audit:security` (`pnpm audit --audit-level high`). Vulnerable transitive packages are fixed by pinning patched versions in `pnpm.overrides` in `package.json`. An advisory is ignored through `pnpm.auditConfig.ignoreGhsas` only when no patched version exists, and every entry must be listed here.

| Advisory                                                                 | Package                                                          | Why it is ignored                                                                                                                    | Remove when                                                                          |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | `braces` 3.0.3 (via `tailwindcss` 3 > `chokidar` / `micromatch`) | No patched version is published. Only reached at build time, expanding glob patterns from our own Tailwind config, never user input. | A patched `braces` is released (then add an override) or the app moves to Tailwind 4 |
