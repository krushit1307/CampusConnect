import React, { useState, useRef, useEffect, useCallback } from "react";
import CampusMapSVG from "../../assets/campus-map.svg?"; // Vite SVG component import
import styles from "./CampusMap.module.css";

interface CampusMapProps {
  activeLocationId?: string;
  onLocationClick?: (locationId: string) => void;
  className?: string;
}

export const CampusMap: React.FC<CampusMapProps> = ({
  activeLocationId,
  onLocationClick,
  className = "",
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState({ visible: false, text: "", x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const onLocationClickRef = useRef(onLocationClick);

  // Keep callback ref fresh to prevent stale closures in event listeners
  useEffect(() => {
    onLocationClickRef.current = onLocationClick;
  }, [onLocationClick]);

  const resetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Reset zoom & pan whenever activeLocationId updates
  useEffect(() => {
    if (activeLocationId) {
      resetView();
    }
  }, [activeLocationId, resetView]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale((prev) => Math.min(Math.max(prev + delta, 0.5), 3));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Primary click only
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  // Attach hover/click events & apply active classes to SVG nodes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const buildings = container.querySelectorAll<SVGGElement>(".building, [id]");

    const handleBuildingClick = (e: MouseEvent) => {
      const target = e.currentTarget as SVGGElement;
      if (target.id && onLocationClickRef.current) {
        onLocationClickRef.current(target.id);
      }
    };

    const handleBuildingHover = (e: MouseEvent) => {
      const target = e.currentTarget as SVGGElement;
      const buildingName = target.getAttribute("data-name") || target.id || "Building";
      const rect = target.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      setTooltip({
        visible: true,
        text: buildingName,
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top - containerRect.top - 8,
      });
    };

    const handleBuildingLeave = () => {
      setTooltip((prev) => ({ ...prev, visible: false }));
    };

    buildings.forEach((building) => {
      // Toggle active highlight class
      if (activeLocationId && building.id === activeLocationId) {
        building.classList.add(styles.activeBuilding);
      } else {
        building.classList.remove(styles.activeBuilding);
      }

      building.addEventListener("click", handleBuildingClick);
      building.addEventListener("mouseenter", handleBuildingHover);
      building.addEventListener("mouseleave", handleBuildingLeave);
    });

    return () => {
      buildings.forEach((building) => {
        building.removeEventListener("click", handleBuildingClick);
        building.removeEventListener("mouseenter", handleBuildingHover);
        building.removeEventListener("mouseleave", handleBuildingLeave);
      });
    };
  }, [activeLocationId]);

  return (
    <div
      ref={containerRef}
      className={`${styles.mapContainer} ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
      onWheel={handleWheel}
    >
      <button
        type="button"
        className={styles.resetButton}
        onClick={resetView}
        aria-label="Reset map view"
      >
        Reset View
      </button>

      <div
        className={styles.svgWrapper}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
        }}
      >
        <CampusMapSVG className={styles.svgContent} />
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.controlButton}
          onClick={handleZoomIn}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className={styles.controlButton}
          onClick={handleZoomOut}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      <div
        className={`${styles.tooltip} ${tooltip.visible ? styles.tooltipVisible : ""}`}
        style={{ left: tooltip.x, top: tooltip.y }}
      >
        {tooltip.text}
      </div>
    </div>
  );
};

export default CampusMap;
