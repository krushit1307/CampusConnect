import * as snarkjs from "snarkjs";

export interface VoteProofInputs {
  nullifier: string;
  trapdoor: string;
  merkleProof: {
    pathElements: string[];
    pathIndices: number[];
  };
}

export interface ZkProof {
  proof: object;
  publicSignals: string[];
}

/**
 * Generates a Zero-Knowledge Proof for anonymous voting in the browser.
 *
 * @param inputs The secret inputs (nullifier, trapdoor, and merkle proof)
 * @returns The ZK proof and the public signals (which includes the nullifier_hash)
 */
export async function generateVoteProof(inputs: VoteProofInputs): Promise<ZkProof> {
  const inputSignals = {
    nullifier: inputs.nullifier,
    trapdoor: inputs.trapdoor,
    pathElements: inputs.merkleProof.pathElements,
    pathIndices: inputs.merkleProof.pathIndices,
  };

  try {
    // Generate the proof using snarkjs
    // We assume the circuit.wasm and circuit_final.zkey are served from the public folder
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputSignals,
      "/zkp/vote_circuit.wasm",
      "/zkp/vote_circuit_final.zkey",
    );

    return { proof, publicSignals };
  } catch (error) {
    console.error("Error generating ZK proof:", error);
    throw new Error("Failed to generate Zero-Knowledge Proof for voting.");
  }
}
