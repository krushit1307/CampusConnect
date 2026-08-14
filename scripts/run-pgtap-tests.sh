#!/usr/bin/env bash
#
# run-pgtap-tests.sh
#
# Runs pgTAP database tests against the local Supabase stack.
#
# Uses the Supabase CLI's built-in `supabase test db` command, which executes
# pgTAP test files with pg_prove in a container (pgTAP is preconfigured in the
# Supabase local development environment).
#
# Usage:
#   ./scripts/run-pgtap-tests.sh                 # run every test in supabase/tests
#   ./scripts/run-pgtap-tests.sh <file.sql> ...  # run specific test file(s)
#
# Requirements:
#   - Supabase CLI (https://supabase.com/docs/guides/cli)
#   - Local Supabase stack running: `supabase start`
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TARGETS=("$@")

# Default to every pgTAP test file under supabase/tests.
if [ "${#TARGETS[@]}" -eq 0 ]; then
  TARGETS=(supabase/tests)
fi

echo ">>> Running pgTAP tests: ${TARGETS[*]}"
supabase test db "${TARGETS[@]}"

echo ">>> All pgTAP tests passed."
