import { useEffect, useRef } from "react";
import type { LinkProps } from "react-router-dom";
import { HoverLink } from "@/components/ui/HoverLink";
import { useOnScreen } from "@/hooks/useOnScreen";

type SmartLinkProps = LinkProps & {
  /** Called once, the first time this link is worth prefetching. */
  prefetch?: () => void | Promise<void>;
};

// A link must stay on screen this long before we prefetch it. Stops a
// fast scroll through a long list from firing a burst of requests for
// links the user only scrolled past.
const VISIBILITY_DEBOUNCE_MS = 100;

// Start watching a little before the link reaches the viewport, so the
// prefetch has a small head start.
const OBSERVER_ROOT_MARGIN = "200px";

export function SmartLink({ prefetch, ...props }: SmartLinkProps) {
  const [ref, isIntersecting] = useOnScreen<HTMLAnchorElement>({
    rootMargin: OBSERVER_ROOT_MARGIN,
  });
  const hasPrefetchedRef = useRef(false);

  useEffect(() => {
    if (!isIntersecting || hasPrefetchedRef.current || !prefetch) return;

    const timer = setTimeout(() => {
      hasPrefetchedRef.current = true;
      void prefetch();
    }, VISIBILITY_DEBOUNCE_MS);

    // The link scrolled out of view before the debounce fired — the
    // user was scrolling past, not looking at it. Cancel the prefetch.
    return () => clearTimeout(timer);
  }, [isIntersecting, prefetch]);

  return <HoverLink ref={ref} prefetch={prefetch} {...props} />;
}
