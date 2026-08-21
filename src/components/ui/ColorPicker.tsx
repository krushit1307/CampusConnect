import React, { useState, useRef, useEffect } from "react";

// --- Utility Functions for Conversion ---
const hslToHex = (h: number, s: number, l: number) => {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
};

const hexToHsl = (hex: string) => {
  let r = 0,
    g = 0,
    b = 0;
  if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16) / 255;
    g = parseInt(hex.substring(3, 5), 16) / 255;
    b = parseInt(hex.substring(5, 7), 16) / 255;
  }
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);

  // FIXED: 'l' is now a const since it's never reassigned, keeping ESLint happy
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

export const ColorPicker = () => {
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [lightness, setLightness] = useState(50);
  const [hex, setHex] = useState("#FF0000");
  const [isDragging, setIsDragging] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  // Sync Hex when HSL changes (unless user is typing in Hex field)
  useEffect(() => {
    setHex(hslToHex(hue, saturation, lightness));
  }, [hue, saturation, lightness]);

  // Handle Dragging on the Wheel
  const handleMove = (e: MouseEvent | React.MouseEvent) => {
    if (!isDragging && e.type !== "mousedown") return;
    if (!wheelRef.current) return;

    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate X and Y relative to the center of the wheel
    const x = e.clientX - rect.left - centerX;
    const y = e.clientY - rect.top - centerY;

    // 1. Calculate Hue using Math.atan2 (angle)
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    // 2. Calculate Saturation using distance from center
    const maxRadius = centerX;
    const distance = Math.min(Math.sqrt(x * x + y * y), maxRadius);
    const newSaturation = (distance / maxRadius) * 100;

    setHue(Math.round(angle));
    setSaturation(Math.round(newSaturation));
  };

  // Attach and detach global mouse listeners for smooth dragging
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMove(e);
    const onMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  // Handle typing in the Hex input
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHex = e.target.value;
    setHex(newHex);
    // Only update the wheel if it's a valid complete hex code
    if (/^#[0-9A-Fa-f]{6}$/i.test(newHex)) {
      const { h, s, l } = hexToHsl(newHex);
      setHue(h);
      setSaturation(s);
      setLightness(l);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 border rounded-xl shadow-lg w-72 bg-white">
      {/* Dynamic Color Preview */}
      <div
        className="w-full h-12 rounded-md border shadow-inner"
        style={{ backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)` }}
      />

      {/* The HSL Wheel */}
      <div
        ref={wheelRef}
        onMouseDown={(e) => {
          setIsDragging(true);
          handleMove(e);
        }}
        className="relative rounded-full cursor-pointer shadow-md"
        style={{
          width: "200px",
          height: "200px",
          // Conical gradient creates the color wheel effect
          background: `conic-gradient(from 90deg, red, yellow, lime, aqua, blue, magenta, red)`,
        }}
      >
        {/* White/Grey overlay for saturation gradient */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle closest-side, #fff, transparent)" }}
        />

        {/* The Draggable Thumb */}
        <div
          className="absolute w-4 h-4 bg-white border-2 border-gray-800 rounded-full shadow-sm"
          style={{
            // Math to position the thumb based on state
            left: `calc(50% + ${Math.cos((hue - 90) * (Math.PI / 180)) * (saturation / 100) * 100}px - 8px)`,
            top: `calc(50% + ${Math.sin((hue - 90) * (Math.PI / 180)) * (saturation / 100) * 100}px - 8px)`,
            pointerEvents: "none", // Prevents thumb from interfering with mouse events
          }}
        />
      </div>

      {/* Lightness Slider */}
      <div className="w-full flex flex-col gap-2">
        <div className="flex justify-between">
          <label className="text-sm font-semibold text-gray-700">Lightness</label>
          <span className="text-sm text-gray-500">{lightness}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={lightness}
          onChange={(e) => setLightness(Number(e.target.value))}
          className="w-full cursor-pointer"
        />
      </div>

      {/* Hex Input (Accessible as requested) */}
      <div className="w-full flex flex-col gap-2">
        <label className="text-sm font-semibold text-gray-700">Hex Code</label>
        <input
          type="text"
          value={hex}
          onChange={handleHexChange}
          className="border border-gray-300 p-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={7}
        />
      </div>
    </div>
  );
};
