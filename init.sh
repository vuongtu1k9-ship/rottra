#!/bin/bash
set -e

echo "=== Harness Initialization ==="

echo "=== bun install ==="
bun install

echo "=== bun run format ==="
bun run format || true

echo "=== bun x tsc --noEmit ==="
bun x tsc --noEmit || true

echo "=== bun run build ==="
bun run build

echo "=== bun scripts/build-tools/validate-harness.ts ==="
bun scripts/build-tools/validate-harness.ts

echo "=== Verification Complete ==="
echo ""
echo "Next steps:"
echo "1. Read feature_list.json to see current feature state"
echo "2. Pick ONE unfinished feature to work on"
echo "3. Implement only that feature"
echo "4. Re-run verification before claiming done"
