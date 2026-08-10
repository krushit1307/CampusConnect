import type { VNode, PatchOp } from "./types";
import { createElement } from "./vdom";

export interface DiffResult {
  patches: PatchOp[];
  finalChildren: VNode[];
}

export function diffChildren(oldChildren: VNode[], newChildren: VNode[]): DiffResult {
  const patches: PatchOp[] = [];

  const oldKeyMap = new Map<string, { vNode: VNode; index: number }>();
  for (let i = 0; i < oldChildren.length; i++) {
    oldKeyMap.set(String(oldChildren[i].key), { vNode: oldChildren[i], index: i });
  }

  const sources: (number | -1)[] = new Array(newChildren.length).fill(-1);

  for (let j = 0; j < newChildren.length; j++) {
    const nc = newChildren[j];
    const entry = oldKeyMap.get(String(nc.key));
    if (entry) {
      sources[j] = entry.index;
      nc.el = entry.vNode.el;
      patches.push({
        type: "updateProps",
        el: entry.vNode.el!,
        props: nc.props,
        oldProps: entry.vNode.props,
      });
      patches.push({
        type: "updateChildren",
        el: entry.vNode.el!,
        oldChildren: entry.vNode.children,
        newChildren: nc.children,
      });
      oldKeyMap.delete(String(nc.key));
    }
  }

  for (const remaining of oldKeyMap.values()) {
    patches.push({ type: "remove", el: remaining.vNode.el! });
  }

  const lisIndices = longestIncreasingSubsequence(sources);
  const lisSet = new Set(lisIndices);

  const finalChildren: VNode[] = [];
  const refNodes: (Node | null)[] = new Array(newChildren.length).fill(null);

  for (let j = newChildren.length - 1; j >= 0; j--) {
    const nc = newChildren[j];
    const src = sources[j];

    if (src === -1) {
      const el = createElement(nc);
      const before = findInsertRef(j, newChildren, sources, lisSet);
      patches.push({ type: "create", vNode: nc, before });
      refNodes[j] = el as Node;
    } else if (!lisSet.has(j)) {
      const before = findInsertRef(j, newChildren, sources, lisSet);
      patches.push({ type: "move", el: nc.el!, before });
      refNodes[j] = nc.el as Node;
    } else {
      refNodes[j] = nc.el as Node;
    }

    finalChildren[j] = nc;
  }

  return { patches, finalChildren };
}

function findInsertRef(
  j: number,
  newChildren: VNode[],
  sources: (number | -1)[],
  lisSet: Set<number>,
): Node | null {
  for (let k = j + 1; k < newChildren.length; k++) {
    if (lisSet.has(k) || sources[k] !== -1) {
      return newChildren[k].el as Node;
    }
    if (sources[k] === -1 && newChildren[k].el) {
      return newChildren[k].el as Node;
    }
  }
  return null;
}

function longestIncreasingSubsequence(arr: (number | -1)[]): number[] {
  const n = arr.length;
  if (n === 0) return [];

  const tails: number[] = [];
  const tailIndices: number[] = [];
  const predecessors: number[] = new Array(n).fill(-1);

  for (let i = 0; i < n; i++) {
    if (arr[i] === -1) continue;

    const val = arr[i] as number;
    let lo = 0;
    let hi = tails.length;

    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (tails[mid] < val) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    if (lo === tails.length) {
      tails.push(val);
      tailIndices.push(i);
    } else {
      tails[lo] = val;
      tailIndices[lo] = i;
    }

    predecessors[i] = lo > 0 ? tailIndices[lo - 1] : -1;
  }

  const result: number[] = [];
  let k = tailIndices[tailIndices.length - 1];
  while (k >= 0 && arr[k] !== -1) {
    result.unshift(k);
    k = predecessors[k];
  }

  return result;
}
