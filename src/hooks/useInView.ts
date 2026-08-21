import { useCallback, useEffect, useRef, useState, type RefCallback } from "react";

const PRELOAD_MARGIN = "200px 0px 200px 0px";

type Subscriber = (isIntersecting: boolean) => void;

interface ObservedTarget {
  subscribers: Set<Subscriber>;
  intersected: boolean;
}

const targets = new Map<Element, ObservedTarget>();
let observer: IntersectionObserver | null = null;

function ensureObserver() {
  if (observer || typeof IntersectionObserver === "undefined") return observer;

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const target = targets.get(entry.target);
        if (!target || !entry.isIntersecting) continue;

        target.intersected = true;
        for (const subscriber of target.subscribers) {
          subscriber(true);
        }

        // This element never needs to be observed again.
        observer?.unobserve(entry.target);
      }
    },
    { root: null, rootMargin: PRELOAD_MARGIN, threshold: 0 },
  );

  return observer;
}

function subscribe(element: Element, subscriber: Subscriber) {
  const current = targets.get(element);

  if (current) {
    current.subscribers.add(subscriber);
    if (current.intersected) subscriber(true);
    return;
  }

  targets.set(element, {
    subscribers: new Set([subscriber]),
    intersected: false,
  });

  ensureObserver()?.observe(element);
}

function unsubscribe(element: Element, subscriber: Subscriber) {
  const current = targets.get(element);
  if (!current) return;

  current.subscribers.delete(subscriber);

  if (current.subscribers.size === 0) {
    targets.delete(element);
    observer?.unobserve(element);
  }

  if (targets.size === 0) {
    observer?.disconnect();
    observer = null;
  }
}

export interface UseInViewOptions {
  /**
   * CampusConnect's shared observer intentionally uses a fixed 200px vertical
   * preload window so every observed element is handled by one observer.
   */
  rootMargin?: string;
  initialInView?: boolean;
}

export interface UseInViewResult<T extends Element = HTMLElement> {
  ref: RefCallback<T>;
  inView: boolean;
  hasIntersected: boolean;
}

/**
 * Observe an element 200px before it enters the viewport.
 *
 * All instances share one IntersectionObserver, which avoids creating one
 * observer per image/card in large lists.
 */
export function useInView<T extends Element = HTMLElement>(
  options: UseInViewOptions = {},
): UseInViewResult<T> {
  const { rootMargin = PRELOAD_MARGIN, initialInView = false } = options;

  if (rootMargin !== PRELOAD_MARGIN && typeof window !== "undefined") {
    if (import.meta.env?.DEV) {
      console.warn(
        `useInView uses the shared ${PRELOAD_MARGIN} observer. ` +
          `Received rootMargin "${rootMargin}".`,
      );
    }
  }

  const [inView, setInView] = useState(initialInView);
  const elementRef = useRef<T | null>(null);

  const ref = useCallback<RefCallback<T>>(
    (element) => {
      const previous = elementRef.current;
      if (previous) {
        // Subscriber is stable for the lifetime of this hook.
        unsubscribe(previous, setInView);
      }

      elementRef.current = element;

      if (!element || initialInView) return;
      subscribe(element, setInView);
    },
    [initialInView],
  );

  useEffect(() => {
    return () => {
      if (elementRef.current && !initialInView) {
        unsubscribe(elementRef.current, setInView);
      }
    };
  }, [initialInView]);

  return {
    ref,
    inView,
    hasIntersected: inView,
  };
}

export const IN_VIEW_ROOT_MARGIN = PRELOAD_MARGIN;
