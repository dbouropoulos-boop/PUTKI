#!/usr/bin/env bash
# PUTKI HQ - background pytest runner.
#
# The broad-run suite has 720+ tests; some sweeps exceed the 120s
# `execute_bash` foreground timeout. This script backgrounds the run
# into /tmp/pytest-putki.log so the agent can poll for completion
# without blocking on a single subprocess.
#
# Usage:
#   bash backend/scripts/run_tests.sh                   # full suite
#   bash backend/scripts/run_tests.sh tests/test_foo.py # subset
#   bash backend/scripts/run_tests.sh -- -n 4           # parallel
#   tail -f /tmp/pytest-putki.log                       # follow output
#   cat /tmp/pytest-putki.log | tail -50                # final summary
#
# Exit codes mirror pytest's: 0 = pass, non-zero = some failures.
# Check the log + `wait $(cat /tmp/pytest-putki.pid)` from the caller.
set -euo pipefail

cd "$(dirname "$0")/.."

LOG=/tmp/pytest-putki.log
PIDFILE=/tmp/pytest-putki.pid

# Skip the known-flaky external-dep test by default. Override by passing
# a path to a specific test.
DEFAULT_IGNORES=(
  --ignore=tests/test_iter62_avatar_refresh.py  # Cloudflare 403 flake on Kick
)

# If first arg starts with -- or -n etc, pass everything through. If it's
# a test path, pass it through too.
ARGS=("$@")
if [[ ${#ARGS[@]} -eq 0 ]]; then
  ARGS=("tests/")
fi

: > "$LOG"
nohup python -m pytest "${ARGS[@]}" "${DEFAULT_IGNORES[@]}" --tb=short -q \
  >>"$LOG" 2>&1 &
echo $! > "$PIDFILE"

echo "pytest backgrounded: pid=$(cat "$PIDFILE")  log=$LOG"
echo "Tail with:  tail -f $LOG"
echo "Wait with:  wait $(cat "$PIDFILE")"
