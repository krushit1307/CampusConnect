import type { VNode } from "./types";

let nextKey = 0;

export function h(
  tag: string,
  props: Record<string, unknown> | null,
  ...children: (VNode | string)[]
): VNode {
  const key = props?.key !== undefined ? String(props.key) : `__auto_${nextKey++}`;

  const normalized: VNode[] = children.map((c) => (typeof c === "string" ? text(c) : c));

  const { key: _k, ...rest } = props ?? {};

  return { tag, key, props: rest, children: normalized };
}

export function text(value: string): VNode {
  return {
    tag: "#text",
    key: `__t_${nextKey++}`,
    props: { nodeValue: value },
    children: [],
  };
}

export function createElement(vNode: VNode): HTMLElement | Text {
  if (vNode.tag === "#text") {
    const t = document.createTextNode(String(vNode.props.nodeValue ?? ""));
    vNode.el = t;
    return t;
  }

  const el = document.createElement(vNode.tag);
  vNode.el = el;

  applyProps(el, {}, vNode.props);

  for (const child of vNode.children) {
    el.appendChild(createElement(child));
  }

  return el;
}

export function applyProps(
  el: HTMLElement | Text,
  oldProps: Record<string, unknown>,
  newProps: Record<string, unknown>,
): void {
  if (el instanceof Text) return;

  for (const key of Object.keys(newProps)) {
    if (key === "key") continue;
    const val = newProps[key];
    const old = oldProps[key];
    if (val === old) continue;

    if (key === "style" && typeof val === "object" && val !== null) {
      const oldStyle = (typeof old === "object" && old !== null ? old : {}) as Record<
        string,
        string
      >;
      applyStyle(el as HTMLElement, oldStyle, val as Record<string, string>);
    } else if (key === "class") {
      (el as HTMLElement).className = String(val ?? "");
    } else if (key.startsWith("on") && typeof val === "function") {
      const event = key.slice(2).toLowerCase();
      if (typeof old === "function") {
        el.removeEventListener(event, old as EventListener);
      }
      el.addEventListener(event, val as EventListener);
    } else if (val === false || val === null || val === undefined) {
      el.removeAttribute(key);
    } else {
      el.setAttribute(key, String(val));
    }
  }

  for (const key of Object.keys(oldProps)) {
    if (key === "key") continue;
    if (key in newProps) continue;
    if (key === "style") continue;
    if (key === "class") {
      (el as HTMLElement).className = "";
    } else if (key.startsWith("on") && typeof oldProps[key] === "function") {
      const event = key.slice(2).toLowerCase();
      el.removeEventListener(event, oldProps[key] as EventListener);
    } else {
      el.removeAttribute(key);
    }
  }
}

function applyStyle(
  el: HTMLElement,
  oldStyle: Record<string, string>,
  newStyle: Record<string, string>,
): void {
  const s = el.style as unknown as Record<string, string>;
  for (const prop of Object.keys(newStyle)) {
    if (oldStyle[prop] !== newStyle[prop]) {
      s[prop] = newStyle[prop];
    }
  }
  for (const prop of Object.keys(oldStyle)) {
    if (!(prop in newStyle)) {
      s[prop] = "";
    }
  }
}
