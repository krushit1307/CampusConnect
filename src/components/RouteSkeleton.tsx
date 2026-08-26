import React from "react";
import { PageSkeletonLoader } from "@/components/skeletons/LayoutSkeletons";

/**
 * RouteSkeleton (#1736)
 * Dynamic, route-matching skeleton loader fallback used during React.lazy route transitions
 * and code-splitting boundaries. Delays 200ms to prevent flickering on fast loads.
 */
export function RouteSkeleton() {
  return <PageSkeletonLoader delayMs={200} />;
}

export default RouteSkeleton;
