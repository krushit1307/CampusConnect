import React, { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export interface Parallax3DCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number; // max tilt angle in degrees, default 15
  glareEnable?: boolean;
  "data-testid"?: string;
}

const getInitialHoverSupport = () => {
  if (typeof window !== "undefined" && window.matchMedia) {
    try {
      return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    } catch {
      return true;
    }
  }
  return true;
};

export function Parallax3DCard({
  children,
  className = "",
  maxTilt = 15,
  glareEnable = true,
  "data-testid": dataTestId,
}: Parallax3DCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHoverSupported, setIsHoverSupported] = useState(getInitialHoverSupport);
  const [isHovered, setIsHovered] = useState(false);

  // Motion values for normalized mouse positions (-0.5 to +0.5)
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth springs for return-to-center physics
  const mouseX = useSpring(x, { stiffness: 300, damping: 20 });
  const mouseY = useSpring(y, { stiffness: 300, damping: 20 });

  // Map mouse positions to 3D rotation angles (rotateX is inverted relative to mouse Y)
  const rotateX = useTransform(mouseY, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-maxTilt, maxTilt]);

  // Dynamic glare position coordinates
  const glareX = useTransform(mouseX, [-0.5, 0.5], ["20%", "80%"]);
  const glareY = useTransform(mouseY, [-0.5, 0.5], ["20%", "80%"]);

  useEffect(() => {
    // Listen for hover media query changes
    if (typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
      const handler = (e: MediaQueryListEvent) => setIsHoverSupported(e.matches);
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handler);
        return () => mediaQuery.removeEventListener("change", handler);
      }
    }
  }, []);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isHoverSupported || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const mouseXPos = event.clientX - rect.left;
    const mouseYPos = event.clientY - rect.top;

    const xPct = mouseXPos / rect.width - 0.5;
    const yPct = mouseYPos / rect.height - 0.5;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseEnter = () => {
    if (isHoverSupported) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  if (!isHoverSupported) {
    return (
      <div className={className} data-testid={dataTestId}>
        {children}
      </div>
    );
  }

  return (
    <div
      style={{ perspective: "1000px" }}
      className="inline-block w-full h-full"
      data-testid={dataTestId}
    >
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
        className={`relative h-full w-full ${className}`}
      >
        {children}

        {/* Subtle Glare/Shine Overlay */}
        {glareEnable && (
          <motion.div
            data-testid="parallax-glare"
            style={{
              background: `radial-gradient(circle at ${glareX.get()} ${glareY.get()}, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 75%)`,
              opacity: isHovered ? 1 : 0,
            }}
            className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300 z-20"
          />
        )}
      </motion.div>
    </div>
  );
}
