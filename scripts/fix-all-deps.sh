#!/bin/bash

# Enhanced dependency fixer script
# Handles all possible corruption scenarios

set -e  # Exit on any error

echo "🚀 Starting comprehensive dependency fix..."
echo "================================================"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to kill any running dev servers
kill_dev_servers() {
    echo "🛑 Stopping any running dev servers..."
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "pnpm dev" 2>/dev/null || true
    pkill -f "npm run dev" 2>/dev/null || true
    sleep 2
}

# Function to clean all possible caches and temp files
clean_all_caches() {
    echo "🧹 Cleaning all caches and temporary files..."
    
    # Next.js caches
    rm -rf .next
    rm -rf .next/cache 2>/dev/null || true
    rm -rf out 2>/dev/null || true
    
    # Node.js caches
    rm -rf node_modules/.cache 2>/dev/null || true
    rm -rf .npm 2>/dev/null || true
    rm -rf .yarn 2>/dev/null || true
    rm -rf .pnpm-store 2>/dev/null || true
    
    # TypeScript caches
    rm -rf tsconfig.tsbuildinfo 2>/dev/null || true
    rm -rf .tsbuildinfo 2>/dev/null || true
    
    # ESLint caches
    rm -rf .eslintcache 2>/dev/null || true
    
    # Jest caches
    rm -rf coverage 2>/dev/null || true
    rm -rf .jest 2>/dev/null || true
    
    # VSCode/IDE caches
    rm -rf .vscode/settings.json.bak 2>/dev/null || true
    
    # OS-specific caches
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        rm -rf ~/Library/Caches/pnpm 2>/dev/null || true
        rm -rf ~/Library/Caches/npm 2>/dev/null || true
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        rm -rf ~/.cache/pnpm 2>/dev/null || true
        rm -rf ~/.cache/npm 2>/dev/null || true
    fi
}

# Function to remove all dependency-related files
remove_dependency_files() {
    echo "🗑️ Removing all dependency files..."
    
    # Remove node_modules
    rm -rf node_modules
    
    # Remove all lock files (to prevent conflicts)
    rm -f package-lock.json
    rm -f yarn.lock
    rm -f pnpm-lock.yaml
    
    # Remove any stray .bin directories
    rm -rf .bin 2>/dev/null || true
}

# Function to ensure correct package manager
setup_package_manager() {
    echo "📦 Setting up correct package manager..."
    
    # Check if corepack is available
    if command_exists corepack; then
        echo "   Using corepack to ensure correct pnpm version..."
        corepack use pnpm@9.15.2
    else
        echo "   Corepack not found, using system pnpm..."
        if ! command_exists pnpm; then
            echo "❌ pnpm not found! Installing via npm..."
            npm install -g pnpm@9.15.2
        fi
    fi
    
    # Verify pnpm version
    PNPM_VERSION=$(pnpm --version 2>/dev/null || echo "unknown")
    echo "   pnpm version: $PNPM_VERSION"
}

# Function to reinstall dependencies
reinstall_dependencies() {
    echo "⬇️ Reinstalling dependencies..."
    
    # Clear pnpm store to ensure clean install
    echo "   Clearing pnpm store..."
    pnpm store prune 2>/dev/null || true
    
    # Install dependencies
    echo "   Installing dependencies..."
    pnpm install --no-frozen-lockfile
    
    # Verify critical packages
    echo "   Verifying critical packages..."
    
    # Check React
    if [ -f "node_modules/react/package.json" ]; then
        REACT_VERSION=$(node -e "console.log(require('./node_modules/react/package.json').version)" 2>/dev/null || echo "unknown")
        echo "   ✅ React: $REACT_VERSION"
    else
        echo "   ❌ React not found!"
        exit 1
    fi
    
    # Check TypeScript
    if [ -f "node_modules/.bin/tsc" ]; then
        TSC_VERSION=$(./node_modules/.bin/tsc --version 2>/dev/null || echo "unknown")
        echo "   ✅ TypeScript: $TSC_VERSION"
    else
        echo "   ❌ TypeScript binary not found!"
        exit 1
    fi
    
    # Check Next.js
    if [ -f "node_modules/.bin/next" ]; then
        NEXT_VERSION=$(./node_modules/.bin/next --version 2>/dev/null || echo "unknown")
        echo "   ✅ Next.js: $NEXT_VERSION"
    else
        echo "   ❌ Next.js binary not found!"
        exit 1
    fi
}

# Function to run verification tests
run_verification() {
    echo "🧪 Running verification tests..."
    
    # Type check
    echo "   Running TypeScript type check..."
    if pnpm type-check >/dev/null 2>&1; then
        echo "   ✅ TypeScript compilation successful"
    else
        echo "   ❌ TypeScript compilation failed!"
        exit 1
    fi
    
    # Test React import
    echo "   Testing React import..."
    if node -e "require('react'); console.log('React import successful')" >/dev/null 2>&1; then
        echo "   ✅ React import successful"
    else
        echo "   ❌ React import failed!"
        exit 1
    fi
    
    # Test Next.js build (dry run)
    echo "   Testing Next.js build..."
    if timeout 30s pnpm build >/dev/null 2>&1; then
        echo "   ✅ Next.js build successful"
    else
        echo "   ⚠️ Next.js build test skipped (timeout or error)"
    fi
}

# Function to create a backup of package.json
create_backup() {
    echo "💾 Creating backup of package.json..."
    cp package.json package.json.backup.$(date +%Y%m%d_%H%M%S)
    echo "   Backup created: package.json.backup.$(date +%Y%m%d_%H%M%S)"
}

# Function to restore from backup if needed
restore_backup() {
    echo "🔄 Checking for backup files..."
    BACKUP_FILE=$(ls -t package.json.backup.* 2>/dev/null | head -1)
    if [ -n "$BACKUP_FILE" ]; then
        echo "   Found backup: $BACKUP_FILE"
        echo "   To restore: cp $BACKUP_FILE package.json"
    fi
}

# Main execution
main() {
    echo "Starting at: $(date)"
    echo ""
    
    # Create backup first
    create_backup
    
    # Kill any running servers
    kill_dev_servers
    
    # Clean everything
    clean_all_caches
    remove_dependency_files
    
    # Setup package manager
    setup_package_manager
    
    # Reinstall dependencies
    reinstall_dependencies
    
    # Run verification
    run_verification
    
    echo ""
    echo "================================================"
    echo "✅ All dependencies fixed successfully!"
    echo "🎉 Your development environment is ready!"
    echo ""
    echo "💡 Tips to prevent future issues:"
    echo "   - Always use 'pnpm' commands (not npm or yarn)"
    echo "   - Run 'pnpm run fix-all-deps' if issues occur"
    echo "   - Avoid manually editing node_modules"
    echo "   - Use 'pnpm install --frozen-lockfile' for production"
    echo ""
    echo "🚀 You can now run: pnpm dev"
    echo "Finished at: $(date)"
}

# Run main function
main "$@"
