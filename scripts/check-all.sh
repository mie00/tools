#!/bin/bash

# Script to run pnpm format && pnpm check && pnpm lint efficiently
# Usage: ./check-all.sh [files...] - format specific files, or check changed/new files under src/

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run command and capture output
run_command() {
    local cmd="$1"
    local name="$2"
    
    echo -e "${YELLOW}Running $name...${NC}"
    
    if output=$(eval "$cmd" 2>&1); then
        echo -e "${GREEN}✓ $name passed${NC}"
        return 0
    else
        echo -e "${RED}✗ $name failed:${NC}"
        echo "$output"
        return 1
    fi
}

# Get files to process
if [ $# -gt 0 ]; then
    # Use provided files
    files="$*"
    echo -e "${YELLOW}Processing provided files: $files${NC}"
    
    # Run prettier format on specific files
    run_command "pnpm exec prettier --write $files" "format (specific files)"
else
    # Get changed and new files under src/ (excluding deleted files)
    if git rev-parse --git-dir > /dev/null 2>&1; then
        # We're in a git repo
        files=$(git diff --name-only --diff-filter=AM HEAD -- 'src/*' 2>/dev/null || true)
        staged_files=$(git diff --name-only --cached --diff-filter=AM -- 'src/*' 2>/dev/null || true)
        
        # Combine and deduplicate files
        all_files=$(echo -e "$files\n$staged_files" | sort -u | grep -v '^$' || true)
        
        if [ -z "$all_files" ]; then
            echo -e "${GREEN}No changed/new files found under src/. Running full check.${NC}"
            # Run prettier format on all files
            run_command "pnpm exec prettier --write ." "format (all files)"
        else
            echo -e "${YELLOW}Processing changed/new files under src/:${NC}"
            echo "$all_files"
            
            # Run prettier format on changed files only
            run_command "pnpm exec prettier --write $(echo "$all_files" | tr '\n' ' ')" "format (changed files)"
        fi
    else
        echo -e "${YELLOW}Not in a git repository. Running full check.${NC}"
        # Run prettier format on all files
        run_command "pnpm exec prettier --write ." "format (all files)"
    fi
fi

# Always run check and lint on the entire project
echo ""
run_command "pnpm exec svelte-kit sync && pnpm exec svelte-check --tsconfig ./jsconfig.json" "check"

echo ""
run_command "pnpm exec eslint ." "lint"

echo ""
echo -e "${GREEN}All checks completed!${NC}"