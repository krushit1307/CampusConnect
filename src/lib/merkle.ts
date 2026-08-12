export const PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function hash1(x: bigint): bigint {
  return ((x + 5n) * (x + 13n) + 23n) % PRIME;
}

export function hash2(a: bigint, b: bigint): bigint {
  return ((a + 17n) * (b + 31n) + 79n) % PRIME;
}

export function stringToBigInt(str: string): bigint {
  let hash = 0n;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31n + BigInt(str.charCodeAt(i))) % PRIME;
  }
  return hash;
}

export class MerkleTree {
  public leaves: bigint[];
  public levels: bigint[][];
  public depth: number;

  constructor(depth: number, leaves: bigint[]) {
    this.depth = depth;
    const maxLeaves = 1 << depth;

    // Fill up to maxLeaves with 0n
    this.leaves = [...leaves];
    while (this.leaves.length < maxLeaves) {
      this.leaves.push(0n);
    }

    this.levels = [this.leaves];
    this.buildTree();
  }

  private buildTree() {
    for (let d = 0; d < this.depth; d++) {
      const currentLevel = this.levels[d];
      const nextLevel: bigint[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        nextLevel.push(hash2(currentLevel[i], currentLevel[i + 1]));
      }
      this.levels.push(nextLevel);
    }
  }

  public getRoot(): bigint {
    return this.levels[this.levels.length - 1][0];
  }

  public getProof(index: number): { pathElements: string[]; pathIndices: number[] } {
    const pathElements: string[] = [];
    const pathIndices: number[] = [];

    let currentIndex = index;
    for (let d = 0; d < this.depth; d++) {
      const level = this.levels[d];
      const isRight = currentIndex & 1;
      const siblingIndex = currentIndex ^ 1;

      pathElements.push(level[siblingIndex].toString());
      pathIndices.push(isRight);

      currentIndex = currentIndex >> 1;
    }

    return { pathElements, pathIndices };
  }
}
