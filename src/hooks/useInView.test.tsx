import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LazyComponent } from "@/components/ui/LazyComponent";
import { IN_VIEW_ROOT_MARGIN, useInView } from "./useInView";

type ObserverEntry = {
  target: Element;
  isIntersecting: boolean;
};

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  readonly callback: IntersectionObserverCallback;
  readonly options: IntersectionObserverInit;
  observed = new Set<Element>();
  observe = vi.fn((element: Element) => this.observed.add(element));
  unobserve = vi.fn((element: Element) => this.observed.delete(element));
  disconnect = vi.fn(() => this.observed.clear());

  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  trigger(entries: ObserverEntry[]) {
    this.callback(
      entries as unknown as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    );
  }
}

function Probe() {
  const { ref, hasIntersected } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="probe">
      {hasIntersected ? "loaded" : "waiting"}
    </div>
  );
}

describe("useInView", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("uses the required 200px preload margin", () => {
    render(<Probe />);
    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.instances[0].options?.rootMargin).toBe(IN_VIEW_ROOT_MARGIN);
  });

  it("shares one observer across multiple elements", () => {
    render(
      <>
        <Probe />
        <Probe />
        <Probe />
      </>,
    );

    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.instances[0].observe).toHaveBeenCalledTimes(3);
  });

  it("renders as intersected after the observer fires", () => {
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("waiting");

    const observer = MockIntersectionObserver.instances[0];
    const target = screen.getByTestId("probe");

    act(() => {
      observer.trigger([{ target, isIntersecting: true }]);
    });

    expect(screen.getByTestId("probe")).toHaveTextContent("loaded");
    expect(observer.unobserve).toHaveBeenCalledWith(target);
  });

  it("disconnects the shared observer when the final target is removed", () => {
    const { unmount } = render(<Probe />);
    const observer = MockIntersectionObserver.instances[0];

    unmount();

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("LazyComponent", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not render heavy children before the preload threshold", () => {
    render(
      <LazyComponent fallback={<span>Loading</span>}>
        <img src="/heavy-image.jpg" alt="Heavy" />
      </LazyComponent>,
    );

    expect(screen.queryByRole("img", { name: "Heavy" })).not.toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("renders heavy children once the threshold is reached", () => {
    render(
      <LazyComponent>
        <img src="/heavy-image.jpg" alt="Heavy" />
      </LazyComponent>,
    );

    const observer = MockIntersectionObserver.instances[0];
    const wrapper = screen.getByRole("img", { name: "Heavy" }).parentElement!;

    act(() => {
      observer.trigger([{ target: wrapper, isIntersecting: true }]);
    });

    expect(screen.getByRole("img", { name: "Heavy" })).toBeInTheDocument();
  });
});
