import React, { useRef, useEffect, useState, ReactNode } from "react";
import styles from "./ScratchTicket.module.css";

export interface ScratchTicketProps {
  children: ReactNode;
  brushSize?: number;
  revealThreshold?: number;
  overlayColor?: string;
  onRevealed?: () => void;
}

export default function ScratchTicket({
  children,
  brushSize = 22,
  revealThreshold = 60,
  overlayColor = "#C0C0C0",
  onRevealed,
}: ScratchTicketProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isRevealed, setIsRevealed] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  // Ref for scratch state
  const isDrawing = useRef(false);
  const scratchCount = useRef(0);
  const revealedRef = useRef(false);

  // Initialize canvas
  const initCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    // Set actual size in memory (scaled for retina)
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // Normalize coordinate system to use CSS pixels
    ctx.scale(dpr, dpr);

    // Fill with overlay color
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = overlayColor;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw "Scratch Me" text
    ctx.font = "bold 24px sans-serif";
    ctx.fillStyle = "#333333";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Scratch Me!", rect.width / 2, rect.height / 2);

    // Reset scratch progress
    scratchCount.current = 0;
  };

  const getCoordinates = (e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (e.type.includes("touch")) {
      clientX = (e as TouchEvent).touches[0].clientX;
      clientY = (e as TouchEvent).touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const checkReveal = () => {
    const canvas = canvasRef.current;
    // willReadFrequently optimization for frequent getImageData calls
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !ctx) return;

    // High DPI scaling means internal pixels are larger
    const width = canvas.width;
    const height = canvas.height;

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    let transparentPixels = 0;
    // Check every 4th value (alpha channel)
    // Step by 32 to skip some pixels and optimize calculation
    const step = 4 * 8;
    for (let i = 3; i < pixels.length; i += step) {
      if (pixels[i] < 128) {
        transparentPixels++;
      }
    }

    const totalPixelsChecked = Math.floor(pixels.length / step);
    const percentRevealed = (transparentPixels / totalPixelsChecked) * 100;

    if (percentRevealed >= revealThreshold) {
      setIsRevealed(true);
      revealedRef.current = true;
      onRevealed?.();

      // Wait for fade out transition (300ms)
      setTimeout(() => {
        setIsHidden(true);
      }, 300);
    }
  };

  const scratch = (e: MouseEvent | TouchEvent) => {
    if (!isDrawing.current || revealedRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { x, y } = getCoordinates(e);

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();

    scratchCount.current += 1;

    // Throttle calculation
    if (scratchCount.current % 15 === 0) {
      checkReveal();
    }
  };

  useEffect(() => {
    if (isHidden) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Setup initial canvas
    initCanvas();

    // Event Handlers
    const handleDown = (e: MouseEvent | TouchEvent) => {
      isDrawing.current = true;
      if (e.cancelable && e.type === "touchstart") {
        e.preventDefault();
      }
      scratch(e);
    };

    const handleUp = () => {
      isDrawing.current = false;
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing.current) return;
      if (e.cancelable) {
        e.preventDefault();
      }
      scratch(e);
    };

    // Native listeners for passive: false to prevent scrolling
    canvas.addEventListener("mousedown", handleDown);
    canvas.addEventListener("mousemove", handleMove, { passive: false });
    window.addEventListener("mouseup", handleUp);

    canvas.addEventListener("touchstart", handleDown, { passive: false });
    canvas.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    window.addEventListener("touchcancel", handleUp);

    // ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      // Re-initialize canvas on resize if not revealed
      if (!revealedRef.current) {
        initCanvas();
      }
    });

    resizeObserver.observe(container);

    return () => {
      canvas.removeEventListener("mousedown", handleDown);
      canvas.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);

      canvas.removeEventListener("touchstart", handleDown);
      canvas.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
      window.removeEventListener("touchcancel", handleUp);

      resizeObserver.disconnect();
    };
  }, [isHidden]); // We only re-run if it's hidden (which unmounts)

  return (
    <div ref={containerRef} className={styles.container}>
      {children}
      {!isHidden && (
        <canvas ref={canvasRef} className={styles.canvas} style={{ opacity: isRevealed ? 0 : 1 }} />
      )}
    </div>
  );
}
