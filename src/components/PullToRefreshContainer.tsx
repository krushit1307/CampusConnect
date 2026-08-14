import React from "react";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { usePullToRefresh } from "../hooks/usePullToRefresh";

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown>;
  children: React.ReactNode;
}

export const PullToRefreshContainer: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const { containerRef, pullDistance, isRefreshing, isThresholdMet } =
    usePullToRefresh<HTMLDivElement>({ onRefresh });

  return (
    <div ref={containerRef} className="relative overflow-hidden touch-pan-y">
      <div
        className="absolute left-0 right-0 top-0 flex items-center justify-center transition-transform duration-200 ease-out z-10 pointer-events-none"
        style={{
          transform: `translateY(${pullDistance - 40}px)`,
          opacity: pullDistance > 10 ? 1 : 0,
        }}
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-background border shadow-md">
          <Loader2
            className={`w-5 h-5 text-primary ${
              isRefreshing
                ? "animate-spin"
                : isThresholdMet
                  ? "rotate-180 transition-transform"
                  : "transition-transform"
            }`}
          />
        </div>
      </div>

      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pullDistance === 0 ? "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
};
