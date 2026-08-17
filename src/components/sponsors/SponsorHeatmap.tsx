import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

interface HeatmapPoint {
  x_grid: number;
  y_grid: number;
  value: number;
}

interface SponsorHeatmapProps {
  bannerId: string;
  imageUrl: string;
}

export const SponsorHeatmap: React.FC<SponsorHeatmapProps> = ({ bannerId, imageUrl }) => {
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const fetchHeatmapData = async () => {
      const { data } = await supabase
        .from("sponsor_banner_heatmap_rollups")
        .select("x_grid, y_grid, value")
        .eq("banner_id", bannerId);

      if (data) setPoints(data);
    };

    fetchHeatmapData();
  }, [bannerId]);

  const drawHeatmap = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || points.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const maxValue = Math.max(...points.map((p) => p.value), 1);

    points.forEach(({ x_grid, y_grid, value }) => {
      const x = (x_grid / 100) * canvas.width;
      const y = (y_grid / 100) * canvas.height;
      const intensity = value / maxValue;
      const radius = Math.max(15, canvas.width * 0.03);

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(255, 0, 0, ${intensity * 0.8})`);
      gradient.addColorStop(0.5, `rgba(255, 255, 0, ${intensity * 0.5})`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  return (
    <div className="relative inline-block w-full">
      <img
        ref={imgRef}
        src={imageUrl}
        alt="Sponsor Banner"
        onLoad={drawHeatmap}
        className="w-full h-auto rounded-lg"
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none rounded-lg"
      />
    </div>
  );
};
