import { useEffect } from "react";

type EffectFn = {
  (): void;
  depsSets: Set<Set<EffectFn>>;
};

let activeEffect: EffectFn | null = null;
const targetMap = new WeakMap<object, Map<string | symbol, Set<EffectFn>>>();

function track(target: object, key: string | symbol): void {
  if (!activeEffect) return;

  let depsMap = targetMap.get(target);
  if (!depsMap) {
    depsMap = new Map();
    targetMap.set(target, depsMap);
  }

  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Set();
    depsMap.set(key, dep);
  }

  if (!dep.has(activeEffect)) {
    dep.add(activeEffect);
    activeEffect.depsSets.add(dep);
  }
}

function trigger(target: object, key: string | symbol): void {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  const dep = depsMap.get(key);
  if (!dep) return;

  const effectsToRun = new Set(dep);
  effectsToRun.forEach((effect) => {
    if (effect !== activeEffect) {
      effect();
    }
  });
}

function cleanupDeps(effect: EffectFn): void {
  for (const dep of effect.depsSets) {
    dep.delete(effect);
  }
  effect.depsSets.clear();
}

export function createEffect(fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);

  const execute: EffectFn = () => {
    if (typeof cleanup === "function") {
      cleanup();
      cleanup = undefined;
    }

    cleanupDeps(execute);

    const prevEffect = activeEffect;
    activeEffect = execute;
    try {
      cleanup = fn();
    } finally {
      activeEffect = prevEffect;
    }
  };

  execute.depsSets = new Set();
  execute();

  return () => {
    if (typeof cleanup === "function") {
      cleanup();
      cleanup = undefined;
    }
    cleanupDeps(execute);
  };
}

export type SignalGetter<T> = {
  (): T;
  value: T;
  peek: () => T;
  subscribe: (fn: (val: T) => void) => () => void;
};

export type SignalSetter<T> = (val: T | ((prev: T) => T)) => void;

export type Signal<T> = [SignalGetter<T>, SignalSetter<T>];

export function createSignal<T>(initialValue: T): Signal<T> {
  const state = { value: initialValue };

  const proxy = new Proxy(state, {
    get(target, prop, receiver) {
      if (prop === "value") {
        track(target, prop);
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      const oldValue = target.value;
      if (Object.is(oldValue, value)) {
        return true;
      }
      const result = Reflect.set(target, prop, value, receiver);
      if (prop === "value") {
        trigger(target, prop);
      }
      return result;
    },
  });

  const get = function (): T {
    return proxy.value;
  } as SignalGetter<T>;

  const set: SignalSetter<T> = function (val) {
    if (typeof val === "function") {
      const updateFn = val as (prev: T) => T;
      proxy.value = updateFn(proxy.value);
    } else {
      proxy.value = val;
    }
  };

  Object.defineProperty(get, "value", {
    get() {
      return get();
    },
    set(v: T) {
      set(v);
    },
    enumerable: true,
    configurable: true,
  });

  get.peek = () => state.value;

  get.subscribe = (fn: (val: T) => void) => {
    let isFirstRun = true;
    return createEffect(() => {
      const val = get();
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      fn(val);
    });
  };

  return [get, set];
}

export function createReactiveObject<T extends object>(initialObj: T): T {
  const proxyMap = new WeakMap<object, object>();

  function createProxy<O extends object>(obj: O): O {
    if (proxyMap.has(obj)) {
      return proxyMap.get(obj) as O;
    }

    const proxy = new Proxy(obj, {
      get(target, prop, receiver) {
        track(target, prop);
        const val = Reflect.get(target, prop, receiver);
        if (val !== null && typeof val === "object") {
          return createProxy(val as object);
        }
        return val;
      },
      set(target, prop, value, receiver) {
        const oldValue = Reflect.get(target, prop, receiver);
        if (Object.is(oldValue, value)) {
          return true;
        }
        const res = Reflect.set(target, prop, value, receiver);
        trigger(target, prop);
        return res;
      },
    });

    proxyMap.set(obj, proxy);
    return proxy;
  }

  return createProxy(initialObj);
}

export function bindSignalToDOM(
  node: HTMLElement | Text | null,
  accessor: () => unknown,
  prop: string = "textContent",
): () => void {
  if (!node) return () => {};

  return createEffect(() => {
    const val = accessor();
    const formattedVal = val === null || val === undefined ? "" : String(val);

    if (node.nodeType === 3) {
      node.nodeValue = formattedVal;
    } else if (prop in node) {
      (node as unknown as Record<string, unknown>)[prop] = formattedVal;
    } else {
      node.textContent = formattedVal;
    }
  });
}

export function useBindSignal(
  ref: React.RefObject<HTMLElement | Text | null>,
  accessor: () => unknown,
  prop: string = "textContent",
): void {
  useEffect(() => {
    if (!ref.current) return;
    const cleanup = bindSignalToDOM(ref.current, accessor, prop);
    return cleanup;
  }, [ref, accessor, prop]);
}
