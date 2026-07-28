import type { LeaderboardEntry, VNode, PatchOp } from "./types";
import { h, applyProps, createElement } from "./vdom";
import { diffChildren } from "./diff";

const DEFAULT_ROW_HEIGHT = 60;

const POOL_MAX = 256;

export class LeaderboardRenderer {
  private container: HTMLElement;
  private children: VNode[] = [];
  private pool: HTMLElement[] = [];
  private rafId: number | null = null;
  private pendingEntries: LeaderboardEntry[] | null = null;
  private rowHeight: number;
  private disposed = false;

  constructor(container: HTMLElement, rowHeight: number = DEFAULT_ROW_HEIGHT) {
    this.container = container;
    this.rowHeight = rowHeight;
  }

  update(entries: LeaderboardEntry[]): void {
    if (this.disposed) return;
    this.pendingEntries = entries;
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.flush);
    }
  }

  flush = (): void => {
    this.rafId = null;
    const entries = this.pendingEntries;
    if (!entries) return;
    this.pendingEntries = null;

    const newChildren = entries.map((e, i) => this.entryToVNode(e, i));
    const { patches, finalChildren } = diffChildren(this.children, newChildren);
    this.children = finalChildren;

    for (const patch of patches) {
      this.applyPatch(patch);
    }

    this.applyTransforms();
  };

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    this.pool.length = 0;
    this.children = [];
  }

  private entryToVNode(entry: LeaderboardEntry, index: number): VNode {
    const rankText = `#${entry.rank}`;
    const scoreText = formatScore(entry.score);

    const children: VNode[] = [
      h("span", { class: "lb-rank" }, rankText),
      h("span", { class: "lb-name" }, entry.name),
      h("span", { class: "lb-score" }, scoreText),
    ];

    if (entry.delta !== undefined && entry.delta !== 0) {
      const sign = entry.delta > 0 ? "+" : "";
      const cls = entry.delta > 0 ? "lb-delta lb-delta-up" : "lb-delta lb-delta-down";
      children.push(h("span", { class: cls }, `${sign}${entry.delta}`));
    }

    if (entry.avatarUrl) {
      children.unshift(h("img", { class: "lb-avatar", src: entry.avatarUrl, alt: entry.name }));
    }

    return h(
      "div",
      { class: "lb-row", key: entry.key, "data-rank": String(entry.rank) },
      ...children,
    );
  }

  private applyPatch(patch: PatchOp): void {
    switch (patch.type) {
      case "create": {
        let el: HTMLElement;
        if (this.pool.length > 0) {
          el = this.pool.pop()!.cloneNode(false) as HTMLElement;
          applyProps(el, {}, patch.vNode.props);
          for (const child of patch.vNode.children) {
            el.appendChild(createElement(child));
          }
          patch.vNode.el = el;
        } else {
          el = createElement(patch.vNode) as HTMLElement;
        }
        this.container.insertBefore(el, patch.before);
        break;
      }
      case "remove": {
        const el = patch.el;
        if (el instanceof HTMLElement) {
          this.container.removeChild(el);
          if (this.pool.length < POOL_MAX) {
            el.innerHTML = "";
            while (el.attributes.length > 0) {
              el.removeAttribute(el.attributes[0].name);
            }
            this.pool.push(el);
          }
        } else if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
        break;
      }
      case "move": {
        this.container.insertBefore(patch.el, patch.before);
        break;
      }
      case "updateProps": {
        applyProps(patch.el as HTMLElement, patch.oldProps, patch.props);
        break;
      }
      case "updateChildren": {
        this.patchChildren(patch.el as HTMLElement, patch.oldChildren, patch.newChildren);
        break;
      }
    }
  }

  private applyTransforms(): void {
    for (let i = 0; i < this.children.length; i++) {
      const nc = this.children[i];
      const el = nc.el;
      if (el && el instanceof HTMLElement) {
        const targetY = i * this.rowHeight;
        el.style.transform = `translateY(${targetY}px)`;
      }
    }
  }

  private patchChildren(parent: HTMLElement, oldChildren: VNode[], newChildren: VNode[]): void {
    const maxLen = Math.max(oldChildren.length, newChildren.length);

    for (let i = 0; i < maxLen; i++) {
      const oldChild = oldChildren[i];
      const newChild = newChildren[i];

      if (!oldChild) {
        const el = createElement(newChild);
        newChild.el = el;
        parent.appendChild(el);
      } else if (!newChild) {
        if (oldChild.el?.parentNode === parent) {
          parent.removeChild(oldChild.el);
        }
      } else if (oldChild.tag === newChild.tag && oldChild.el) {
        if (oldChild.tag === "#text") {
          const val = String(newChild.props.nodeValue ?? "");
          if ((oldChild.el as Text).nodeValue !== val) {
            (oldChild.el as Text).nodeValue = val;
          }
          newChild.el = oldChild.el;
        } else {
          applyProps(oldChild.el as HTMLElement, oldChild.props, newChild.props);
          newChild.el = oldChild.el;
          this.patchChildren(oldChild.el as HTMLElement, oldChild.children, newChild.children);
        }
      } else {
        const el = createElement(newChild);
        newChild.el = el;
        if (oldChild.el) {
          parent.insertBefore(el, oldChild.el);
          parent.removeChild(oldChild.el);
        } else {
          parent.appendChild(el);
        }
      }
    }
  }
}

function formatScore(score: number): string {
  if (score >= 1_000_000) {
    return `${(score / 1_000_000).toFixed(1)}M`;
  }
  if (score >= 1_000) {
    return `${(score / 1_000).toFixed(1)}K`;
  }
  return String(score);
}
