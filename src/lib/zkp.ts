// @ts-expect-error: snarkjs has no types
import * as snarkjs from "snarkjs";

export interface VoteProof {
  proof: Record<string, unknown>;
  publicSignals: string[];
}

/**
 * Generates a Zero-Knowledge Proof (ZKP) in the browser for a vote.
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
  // In a real implementation, the secret would be hashed or formatted as required by the circuit.
  // The WASM and ZKEY files should be served statically (e.g., in the public directory).
  const wasmFile = "/zkp/vote.wasm";
  const zkeyFile = "/zkp/vote_final.zkey";

  // The input to the circuit. Must match the signals defined in the Circom circuit.
  const input = {
    secret,
    electionId,
    voteChoice,
  };

  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmFile, zkeyFile);

    return { proof, publicSignals };
  } catch (error) {
    console.error("Failed to generate vote ZKP:", error);
    throw new Error("Proof generation failed. Ensure your membership token is valid.");
  }
}
