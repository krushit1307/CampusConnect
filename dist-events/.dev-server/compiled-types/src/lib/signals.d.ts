/**
 * Creates a reactive effect that automatically runs when tracked signal dependencies change.
 *
 * @param fn The callback function to run reactively.
 * @returns A cleanup function to unsubscribe and stop the effect.
 */
export declare function createEffect(fn: () => void | (() => void)): () => void;
export type SignalGetter<T> = {
    (): T;
    value: T;
    peek: () => T;
    subscribe: (fn: (val: T) => void) => () => void;
};
export type SignalSetter<T> = (val: T | ((prev: T) => T)) => void;
export type Signal<T> = [SignalGetter<T>, SignalSetter<T>];
/**
 * Creates a fine-grained reactive signal tracked via JavaScript Proxies.
 *
 * @param initialValue The starting value of the signal.
 * @returns A [getter, setter] tuple. Accessing getter() or getter.value tracks dependency.
 */
export declare function createSignal<T>(initialValue: T): Signal<T>;
/**
 * Creates a reactive proxy object that tracks property reads/writes fine-grainedly.
 */
export declare function createReactiveObject<T extends object>(initialObj: T): T;
/**
 * Directly binds a signal accessor to a DOM Node (HTMLElement or Text node),
 * bypassing React's render cycle completely when the signal value updates.
 *
 * @param node The DOM node (HTMLElement or Text node) to update.
 * @param accessor Function returning the current signal value.
 * @param prop The property on the node to mutate (default: "textContent").
 * @returns Unsubscribe function to tear down the DOM binding effect.
 */
export declare function bindSignalToDOM(node: HTMLElement | Text | null, accessor: () => unknown, prop?: string): () => void;
/**
 * React hook that binds a signal accessor directly to a ref's DOM node,
 * mutating the DOM node directly on signal updates without triggering React re-renders.
 */
export declare function useBindSignal(ref: React.RefObject<HTMLElement | Text | null>, accessor: () => unknown, prop?: string): void;
