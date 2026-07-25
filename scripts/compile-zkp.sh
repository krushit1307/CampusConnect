#!/usr/bin/env bash
set -euo pipefail

# ZKP Circuit Compilation Script
# Generates the .wasm, .zkey, and verification_key.json files needed
# by the verify-vote edge function and the client-side zkp.ts module.
#
# Prerequisites:
#   - Node.js 18+
#   - circom 2.1.0+ (https://docs.circom.io/getting-started/installation/)
#   - snarkjs (npm install -g snarkjs)
#
# Usage:
#   bash scripts/compile-zkp.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CIRCUIT_DIR="$PROJECT_ROOT/supabase/functions/verify-vote/circuits"
OUTPUT_DIR="$PROJECT_ROOT/public/zkp"

CIRCUIT_FILE="$CIRCUIT_DIR/vote.circom"
R1CS_OUT="$OUTPUT_DIR/vote.r1cs"
WASM_OUT="$OUTPUT_DIR/vote.wasm"
ZKEY_OUT="$OUTPUT_DIR/vote_final.zkey"
VKEY_OUT="$CIRCUIT_DIR/../verification_key.json"
PTAU_URL="https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau"

echo "=== ZKP Circuit Compilation ==="
echo "Circuit: $CIRCUIT_FILE"
echo "Output:  $OUTPUT_DIR"
echo ""

# Step 1: Create output directory
mkdir -p "$OUTPUT_DIR"

# Step 2: Compile the circuit
echo ">> Compiling circuit..."
circom "$CIRCUIT_FILE" --r1cs --wasm --output "$OUTPUT_DIR"
echo "   Done."

# Step 3: Download Powers of Tau file (if not present)
if [ ! -f "$OUTPUT_DIR/powersOfTau28_hez_final_12.ptau" ]; then
    echo ">> Downloading Powers of Tau file..."
    curl -L "$PTAU_URL" -o "$OUTPUT_DIR/powersOfTau28_hez_final_12.ptau"
    echo "   Done."
fi

# Step 4: Generate zkey
echo ">> Generating zkey..."
snarkjs groth16 setup "$R1CS_OUT" "$OUTPUT_DIR/powersOfTau28_hez_final_12.ptau" "$OUTPUT_DIR/vote_0000.zkey"
echo "   Done."

# Step 5: Contribute to the ceremony (non-interactive)
echo ">> Contributing to ceremony..."
echo "dummy" | snarkjs zkey contribute "$OUTPUT_DIR/vote_0000.zkey" "$ZKEY_OUT" --name="CampusConnect" -v
echo "   Done."

# Step 6: Export verification key
echo ">> Exporting verification key..."
snarkjs zkey export verificationkey "$ZKEY_OUT" "$VKEY_OUT"
echo "   Done."

# Step 7: Generate solidity verifier (optional)
echo ">> Generating Solidity verifier..."
snarkjs zkey export solidityverifier "$ZKEY_OUT" "$OUTPUT_DIR/verifier.sol"
echo "   Done."

# Cleanup intermediate files
rm -f "$OUTPUT_DIR/vote_0000.zkey"
rm -f "$OUTPUT_DIR/powersOfTau28_hez_final_12.ptau"

echo ""
echo "=== Compilation Complete ==="
echo "Generated files:"
ls -la "$OUTPUT_DIR/"
echo "Verification key: $VKEY_OUT"
