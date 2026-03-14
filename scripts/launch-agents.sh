#!/usr/bin/env bash
# Usage: ./scripts/launch-agents.sh [-l|--loop] [COUNT]
#
# Launches COUNT agents (default 3) staggered 30s apart.
# With --loop, waits for all agents to finish then launches a new batch.
#
# Ctrl-C once:  stop launching new agents/batches, let running ones finish
# Ctrl-C twice: stop all running containers immediately

set -euo pipefail

LOOP=false
COUNT=3

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -l|--loop) LOOP=true; shift ;;
    *)         COUNT="$1"; shift ;;
  esac
done

CONTAINER_IDS=()
STOP_REQUESTED=false

# First Ctrl-C: set flag to stop new launches, let running containers finish.
# Second Ctrl-C: kill running containers and exit.
on_interrupt() {
  if $STOP_REQUESTED; then
    echo ""
    echo "Second interrupt — stopping running containers..."
    for cid in "${CONTAINER_IDS[@]}"; do
      if docker inspect --format='{{.State.Running}}' "$cid" 2>/dev/null | grep -q true; then
        echo "  Stopping ${cid:0:12}..."
        docker stop "$cid" >/dev/null 2>&1 || true
      fi
    done
    echo "All containers stopped. Exiting."
    exit 1
  fi

  STOP_REQUESTED=true
  echo ""
  echo "Interrupt received — finishing current batch, no new agents will launch."
  echo "Press Ctrl-C again to stop running containers immediately."
}

trap on_interrupt SIGINT SIGTERM

launch_batch() {
  local batch="$1"
  CONTAINER_IDS=()

  echo "=== Batch $batch: launching $COUNT agent(s) ==="

  for i in $(seq 1 "$COUNT"); do
    if $STOP_REQUESTED; then
      echo "[Batch $batch] Stop requested — skipping remaining launches."
      break
    fi
    echo "[Batch $batch] Launching agent $i of $COUNT..."
    cid=$(docker compose run --rm -d agent)
    CONTAINER_IDS+=("$cid")
    echo "  Container: ${cid:0:12}"
    if [ "$i" -lt "$COUNT" ] && ! $STOP_REQUESTED; then
      echo "  Waiting 30s before next agent..."
      sleep 30 || true
    fi
  done

  if [ ${#CONTAINER_IDS[@]} -eq 0 ]; then
    echo "[Batch $batch] No agents were launched."
    return
  fi

  echo "[Batch $batch] ${#CONTAINER_IDS[@]} agent(s) running. Waiting for them to finish..."

  local failed=0
  for cid in "${CONTAINER_IDS[@]}"; do
    exit_code=$(docker wait "$cid" 2>/dev/null) || exit_code="unknown"
    if [ "$exit_code" = "0" ]; then
      echo "  Container ${cid:0:12} finished (exit 0)"
    else
      echo "  Container ${cid:0:12} finished (exit $exit_code)"
      failed=$((failed + 1))
    fi
  done

  local launched=${#CONTAINER_IDS[@]}
  echo "[Batch $batch] Batch complete: $((launched - failed))/$launched succeeded, $failed failed."
}

batch=1
launch_batch $batch

while $LOOP && ! $STOP_REQUESTED; do
  batch=$((batch + 1))
  echo ""
  echo "Starting next batch in 10s... (Ctrl-C to stop)"
  sleep 10 || true
  if $STOP_REQUESTED; then
    break
  fi
  launch_batch $batch
done
