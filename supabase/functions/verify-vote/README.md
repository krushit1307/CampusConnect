# verify-vote Edge Function

Verifies zero-knowledge proofs for anonymous voting using Groth16 on BN128.

## Prerequisites

- [circom](https://docs.circom.io/getting-started/installation/) 2.1.0+
- [snarkjs](https://github.com/iden3/snarkjs) (`npm install -g snarkjs`)

## Generating ZKP Artifacts

Run the build script from the project root:

```bash
bash scripts/compile-zkp.sh
```

This generates:

- `public/zkp/vote.wasm` — WebAssembly circuit
- `public/zkp/vote_final.zkey` — proving key
- `verification_key.json` — verifying key (used by this function)

## Circuit

The voting circuit (`circuits/vote.circom`) accepts three private inputs:

- `secret` — user's membership token
- `electionId` — election identifier
- `voteChoice` — selected option

And produces one public output:

- `nullifier` — hash to prevent double voting
