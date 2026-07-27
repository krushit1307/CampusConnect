import type { Groth16Proof, PublicSignals } from "snarkjs";

export interface VoteProof {
  proof: Groth16Proof;
  publicSignals: PublicSignals;
}

/**
 * Generates a Zero-Knowledge Proof (ZKP) in the browser for a vote.
 *
 * Requires compiled Circom artifacts to exist at the expected paths.
 * See `scripts/compile-zkp.sh` and `supabase/functions/verify-vote/circuits/`
 * for build instructions.
 *
 * @param secret The user's secret membership token.
 * @param electionId The ID of the election being voted in.
 * @param voteChoice The user's vote choice.
 * @returns A promise that resolves to the generated ZKP and public signals.
 */
export async function generateVoteProof(
  secret: string | number,
  electionId: string | number,
  voteChoice: string | number,
): Promise<VoteProof> {
  const wasmFile = "/zkp/vote.wasm";
  const zkeyFile = "/zkp/vote_final.zkey";

  const input = { secret, electionId, voteChoice };

  try {
    const snarkjs = await import("snarkjs");
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmFile, zkeyFile);
    return { proof, publicSignals };
  } catch (error) {
    console.error("Failed to generate vote ZKP:", error);
    if (error instanceof Error && error.message.includes("ENOENT")) {
      throw new Error(
        "ZKP circuit artifacts not found. Run `bash scripts/compile-zkp.sh` to generate vote.wasm and vote_final.zkey in the public/zkp directory.",
      );
    }
    throw new Error("Proof generation failed. Ensure your membership token is valid.");
  }
}
