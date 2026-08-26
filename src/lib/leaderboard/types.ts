export interface LeaderboardEntry {
  key: string;
  rank: number;
  name: string;
  score: number;
  avatarUrl?: string;
  delta?: number;
}

export interface VNode {
  tag: string;
  key: string | number;
  props: Record<string, unknown>;
  children: VNode[];
  el?: HTMLElement | Text;
}

export type PatchOp =
  | { type: "remove"; el: HTMLElement | Text }
  | { type: "move"; el: HTMLElement | Text; before: Node | null }
  | { type: "create"; vNode: VNode; before: Node | null }
  | {
      type: "updateProps";
      el: HTMLElement | Text;
      props: Record<string, unknown>;
      oldProps: Record<string, unknown>;
    }
  | { type: "updateChildren"; el: HTMLElement | Text; oldChildren: VNode[]; newChildren: VNode[] };

export interface DiffResult {
  patches: PatchOp[];
  newChildren: VNode[];
}
