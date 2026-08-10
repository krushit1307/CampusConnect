/**
 * Merkle tree utilities for the certificate blockchain ledger (#1041).
 *
 * Every issued certificate gets a canonical leaf hash
 * `keccak256("campusconnect-certificate:v1:<eventId>:<userId>:<certId>")`.
 * Each UTC day, all leaf hashes are combined into a binary Merkle tree whose
 * root is anchored on-chain by the CertificateLedger contract. The stored
 * Merkle path lets any employer recompute the root from a single certificate
 * hash and prove membership without trusting our servers.
 */
import { ethers } from "https://esm.sh/ethers@6.13.4";

export const CERTIFICATE_LEDGER_PREFIX = "campusconnect-certificate:v1";

export const CERTIFICATE_LEDGER_ABI = [
  "function anchorDay(uint256 day, bytes32 root, uint256 certificateCount) external returns (uint256 blockNumber)",
  "function verifyRoot(uint256 day, bytes32 root) external view returns (bool)",
  "function getBatch(uint256 day) external view returns (tuple(bytes32 root, uint256 blockNumber, uint256 timestamp, uint256 certificateCount))",
  "function owner() external view returns (address)",
  "event RootAnchored(uint256 indexed day, bytes32 indexed root, uint256 certificateCount, uint256 blockNumber, uint256 timestamp)",
];

/** Canonical, deterministic leaf hash for a certificate record. */
export function computeCertificateLeafHash(
  eventId: string,
  userId: string,
  certificateId: string,
): string {
  return ethers.keccak256(
    ethers.toUtf8Bytes(`${CERTIFICATE_LEDGER_PREFIX}:${eventId}:${userId}:${certificateId}`),
  );
}

/** Hashes a sibling pair canonically (always sorts the pair first). */
export function hashPair(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return ethers.keccak256(ethers.concat([x, y]));
}

/**
 * Builds a binary Merkle tree from leaves. Leaves are sorted canonically and
 * the last leaf is duplicated when the count is odd, so the tree (and thus
 * the root) is deterministic regardless of insertion order.
 *
 * Returns the root and every tree layer (layer 0 = leaves) for proof building.
 */
export function buildMerkleTree(leaves: string[]): { root: string | null; layers: string[][] } {
  if (leaves.length === 0) {
    return { root: null, layers: [] };
  }

  const sorted = [...leaves].sort();
  const layers: string[][] = [sorted];

  while (layers[layers.length - 1].length > 1) {
    const current = layers[layers.length - 1];
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = current[i + 1] ?? current[i];
      next.push(hashPair(left, right));
    }
    layers.push(next);
  }

  return { root: layers[layers.length - 1][0] ?? null, layers };
}

export function getMerkleRoot(leaves: string[]): string | null {
  return buildMerkleTree(leaves).root;
}

/**
 * Returns the Merkle proof (sibling hashes + leaf index) for `leaf` within
 * `leaves`. Assumes `leaves` are the same set used to build the tree.
 */
export function getMerkleProof(
  leaves: string[],
  leaf: string,
): { index: number; path: string[] } | null {
  if (leaves.length === 0) return null;

  const sorted = [...leaves].sort();
  const index = sorted.indexOf(leaf);
  if (index === -1) return null;

  let idx = index;
  let layer = sorted;
  const path: string[] = [];

  while (layer.length > 1) {
    const siblingIndex = idx % 2 === 0 ? idx + 1 : idx - 1;
    const sibling = layer[siblingIndex] ?? layer[idx];
    path.push(sibling);
    idx = Math.floor(idx / 2);
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(hashPair(layer[i], layer[i + 1] ?? layer[i]));
    }
    layer = next;
  }

  return { index, path };
}

/**
 * Recomputes the root from a leaf + Merkle path (order-independent thanks to
 * canonical pair hashing) and compares it against the expected root.
 */
export function verifyMerkleProof(
  leaf: string,
  path: string[],
  root: string,
): boolean {
  let hash = leaf;
  for (const sibling of path) {
    hash = hashPair(hash, sibling);
  }
  return hash === root;
}

/** Converts an ISO date string to the contract's YYYYMMDD day number. */
export function isoDateToDayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  return Number(year) * 10000 + Number(month) * 100 + Number(day);
}
