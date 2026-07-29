import React, { useState } from "react";
import { RefreshCw } from "lucide-react";

export default function PullToRefresh({ children, onRefresh }) {
  const [startY, setStartY] = useState(0);
  const [pullChange, setPullChange] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // How far the user needs to drag to trigger the refresh
  const pullThreshold = 60;

  const handleTouchStart = (e) => {
    // Only register the pull if the user is at the very top of the feed
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e) => {
    if (startY === 0 || window.scrollY > 0) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;

    // Only allow pulling downwards
    if (deltaY > 0) {
      // Add a resistance factor (0.4) so the drag feels heavy and natural
      setPullChange(Math.min(deltaY * 0.4, pullThreshold + 20));
    }
  };

  const handleTouchEnd = async () => {
    if (pullChange >= pullThreshold) {
      setIsRefreshing(true);
      setPullChange(pullThreshold); // Lock the UI open at the threshold

      // Wait for the data fetching Promise to resolve
      await onRefresh();

      setIsRefreshing(false);
    }
    // Spring back to the top
    setPullChange(0);
    setStartY(0);
  };

  return (
    <div
      className="relative w-full h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Hidden Loading Indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center items-center overflow-hidden transition-opacity duration-300 z-10"
        style={{
          height: `${pullThreshold}px`,
          top: `-${pullThreshold}px`,
          transform: `translateY(${pullChange}px)`,
          opacity: pullChange > 10 ? 1 : 0,
        }}
      >
        <RefreshCw
          className={`text-gray-500 w-6 h-6 ${isRefreshing ? "animate-spin" : ""}`}
          style={{ transform: `rotate(${pullChange * 2}deg)` }}
        />
      </div>

      {/* Main Feed Content */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{ transform: `translateY(${pullChange}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
