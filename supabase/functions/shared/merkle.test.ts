// @ts-nocheck
import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildMerkleTree,
  computeCertificateLeafHash,
  getMerkleProof,
  getMerkleRoot,
  hashPair,
  isoDateToDayNumber,
  verifyMerkleProof,
} from "./merkle.ts";

Deno.test("leaf - is deterministic and canonical", () => {
  const a = computeCertificateLeafHash("evt-1", "usr-1", "cert-1");
  const b = computeCertificateLeafHash("evt-1", "usr-1", "cert-1");
  assertEquals(a, b);
  assert(a.startsWith("0x"));
  assert(a.length === 66);
  assert(
    a !== computeCertificateLeafHash("evt-1", "usr-1", "cert-2"),
    "different cert ids must differ",
  );
  assert(
    a !== computeCertificateLeafHash("evt-2", "usr-1", "cert-1"),
    "different event ids must differ",
  );
});

Deno.test("merkle - root is stable regardless of leaf order", () => {
  const leaves = ["a", "b", "c", "d"].map((n, i) =>
    computeCertificateLeafHash(`evt-${i}`, "usr", `cert-${i}`),
  );
  const root1 = getMerkleRoot([leaves[0], leaves[1], leaves[2], leaves[3]]);
  const root2 = getMerkleRoot([leaves[3], leaves[1], leaves[0], leaves[2]]);
  assertEquals(root1, root2);
});

Deno.test("merkle - single leaf root equals the leaf itself", () => {
  const leaf = computeCertificateLeafHash("evt-1", "usr-1", "cert-1");
  assertEquals(getMerkleRoot([leaf]), leaf);
});

Deno.test("merkle - empty leaves yield null root", () => {
  assertEquals(getMerkleRoot([]), null);
});

Deno.test("merkle - odd leaf count duplicates the last leaf", () => {
  const leaves = ["l1", "l2", "l3"];
  const { layers } = buildMerkleTree(leaves);
  assert(layers.length >= 2);
  assertEquals(layers[1].length, 2);
});

Deno.test("merkle - proof verifies against the root and rejects tampering", () => {
  const leaves = ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8"];
  const root = getMerkleRoot(leaves);

  for (const leaf of leaves) {
    const proof = getMerkleProof(leaves, leaf);
    assert(proof !== null, `proof for ${leaf}`);
    assertEquals(verifyMerkleProof(leaf, proof.path, root), true);
  }

  // A leaf not in the tree must not verify.
  const foreign = getMerkleProof(leaves, "l1");
  assertEquals(verifyMerkleProof("not-a-leaf", foreign.path, root), false);

  // A tampered sibling must break verification.
  const tampered = foreign.path.map((s) => (s === foreign.path[0] ? "0xdead" : s));
  assertEquals(verifyMerkleProof("l1", tampered, root), false);
});

Deno.test("merkle - proof for unknown leaf returns null", () => {
  assertEquals(getMerkleProof(["a", "b"], "unknown"), null);
  assertEquals(getMerkleProof([], "a"), null);
});

Deno.test("merkle - proof index matches sorted position", () => {
  const leaves = ["l1", "l2", "l3", "l4"];
  const sorted = [...leaves].sort();
  const proof = getMerkleProof(leaves, sorted[2]);
  assertEquals(proof.index, 2);
});

Deno.test("merkle - hashPair is canonical (order independent)", () => {
  assertEquals(hashPair("0x01", "0x02"), hashPair("0x02", "0x01"));
});

Deno.test("day - ISO date converts to YYYYMMDD", () => {
  assertEquals(isoDateToDayNumber("2026-08-04T12:00:00Z"), 20260804);
  assertEquals(isoDateToDayNumber("2026-01-01T00:00:00Z"), 20260101);
});
