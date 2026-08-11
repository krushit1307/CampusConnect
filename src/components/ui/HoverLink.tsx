import { forwardRef, useCallback, useRef } from "react";
import { Link, type LinkProps } from "react-router-dom";

type HoverLinkProps = LinkProps & {
  prefetch?: () => void | Promise<void>;
};

export const HoverLink = forwardRef<HTMLAnchorElement, HoverLinkProps>(function HoverLink(
  { prefetch, onMouseEnter, onMouseLeave, onTouchStart, onFocus, ...props },
  ref,
) {
  const hasPrefetchedRef = useRef(false);
  const triggerPrefetch = useCallback(() => {
    if (!prefetch || hasPrefetchedRef.current) return;

    hasPrefetchedRef.current = true;
    void prefetch();
  }, [prefetch]);

  const handleMouseEnter = useCallback<NonNullable<LinkProps["onMouseEnter"]>>(
    (event) => {
      onMouseEnter?.(event);
      triggerPrefetch();
    },
    [onMouseEnter, triggerPrefetch],
  );

  const handleMouseLeave = useCallback<NonNullable<LinkProps["onMouseLeave"]>>(
    (event) => {
      onMouseLeave?.(event);
    },
    [onMouseLeave],
  );

  const handleTouchStart = useCallback<NonNullable<LinkProps["onTouchStart"]>>(
    (event) => {
      onTouchStart?.(event);
      triggerPrefetch();
    },
    [onTouchStart, triggerPrefetch],
  );

  const handleFocus = useCallback<NonNullable<LinkProps["onFocus"]>>(
    (event) => {
      onFocus?.(event);
      triggerPrefetch();
    },
    [onFocus, triggerPrefetch],
  );

  return (
    <Link
      ref={ref}
      {...props}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onFocus={handleFocus}
    />
  );
});
