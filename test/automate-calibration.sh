#!/usr/bin/env bash
# test/automate-calibration.sh
# Multi-CID calibration → aggregation → threshold recalibration
# ProofBridge Liner probabilistic evidentiary layer

set -euo pipefail

# -------------------------------------------------------------------
# Config
# -------------------------------------------------------------------

STRENGTH="${STRENGTH:-10}"
GAMMA="${GAMMA:-10}"
CYCLES="${CYCLES:-100}"

CALIBRATE_SCRIPT="test/calibrate-prior.js"
AGGREGATE_SCRIPT="test/aggregate-calibration.js"
RECALIBRATE_SCRIPT="test/recalibrate-thresholds.js"

RUN_DIR="test/calibration-runs"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="$RUN_DIR/$TIMESTAMP"

mkdir -p "$OUT_DIR"

# -------------------------------------------------------------------
# Known-valid calibration assets
# Format: "CID|EXPECTED_HASH"
# Replace placeholders before running.
# -------------------------------------------------------------------

ASSETS=(
  "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354|0x182991846b0591fc8b36580884d247afeb695bb9271ed7e53fd68e977f7be8ed"
)

# -------------------------------------------------------------------
# Preflight checks
# -------------------------------------------------------------------

for script in "$CALIBRATE_SCRIPT" "$AGGREGATE_SCRIPT" "$RECALIBRATE_SCRIPT"; do
  if [[ ! -f "$script" ]]; then
    echo "Missing required script: $script"
    exit 1
  fi
done

for asset in "${ASSETS[@]}"; do
  IFS="|" read -r cid expected_hash <<< "$asset"

  if [[ "$cid" == REPLACE_* || "$expected_hash" == REPLACE_* ]]; then
    echo "Replace placeholder asset before running:"
    echo "$asset"
    exit 1
  fi

  if [[ ! "$expected_hash" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
    echo "Invalid expected hash format for CID $cid:"
    echo "$expected_hash"
    exit 1
  fi
done

echo "Calibration run: $TIMESTAMP"
echo "Cycles per CID: $CYCLES"
echo "Prior strength: $STRENGTH"
echo "False-negative cost gamma: $GAMMA"
echo "Output directory: $OUT_DIR"
echo

# -------------------------------------------------------------------
# Phase 1: Multi-CID calibration
# -------------------------------------------------------------------

echo "Phase 1: Multi-CID empirical calibration"

count=1
for asset in "${ASSETS[@]}"; do
  IFS="|" read -r cid expected_hash <<< "$asset"

  echo
  echo "[$count/${#ASSETS[@]}] Calibrating CID:"
  echo "$cid"

  TARGET_CID="$cid" \
  TARGET_HASH="$expected_hash" \
  node "$CALIBRATE_SCRIPT" \
    --cycles "$CYCLES" \
    --strength "$STRENGTH"

  src="test/calibration-data.json"
  dst="$OUT_DIR/calibration-data-$count.json"

  if [[ ! -f "$src" ]]; then
    echo "Expected calibration output not found: $src"
    exit 1
  fi

  mv "$src" "$dst"

  echo "Saved: $dst"
  count=$((count + 1))
done

# -------------------------------------------------------------------
# Phase 2: Aggregate empirical priors
# -------------------------------------------------------------------

echo
echo "Phase 2: Aggregate priors"

AGG_OUTPUT=$(
  CALIBRATION_DIR="$OUT_DIR" \
  STRENGTH="$STRENGTH" \
  node "$AGGREGATE_SCRIPT"
)

echo "$AGG_OUTPUT" | tee "$OUT_DIR/aggregate-output.txt"

ALPHA=$(echo "$AGG_OUTPUT" | awk -F': ' '/Suggested alpha:/ {print $2}' | tail -n 1)
BETA=$(echo "$AGG_OUTPUT" | awk -F': ' '/Suggested beta:/ {print $2}' | tail -n 1)

if [[ -z "${ALPHA:-}" || -z "${BETA:-}" ]]; then
  echo "Could not extract alpha/beta from aggregator output."
  exit 1
fi

echo
echo "Extracted prior:"
echo "alpha=$ALPHA"
echo "beta=$BETA"

# -------------------------------------------------------------------
# Phase 3: Recompute stratified thresholds
# -------------------------------------------------------------------

echo
echo "Phase 3: Recalibrate thresholds"

node "$RECALIBRATE_SCRIPT" \
  --alpha "$ALPHA" \
  --beta "$BETA" \
  --gamma "$GAMMA" \
  | tee "$OUT_DIR/recalibration-output.txt"

# -------------------------------------------------------------------
# Phase 4: Archive run metadata
# -------------------------------------------------------------------

cat > "$OUT_DIR/run-metadata.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "cyclesPerCid": $CYCLES,
  "strength": $STRENGTH,
  "gamma": $GAMMA,
  "alpha": "$ALPHA",
  "beta": "$BETA",
  "assetCount": ${#ASSETS[@]}
}
EOF

echo
echo "Calibration complete."
echo "Artifacts written to: $OUT_DIR"
echo "Review:"
echo "- $OUT_DIR/aggregate-output.txt"
echo "- $OUT_DIR/recalibration-output.txt"
echo "- $OUT_DIR/run-metadata.json"