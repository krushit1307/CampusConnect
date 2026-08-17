import React from "react";
import { supabase } from "@/utils/supabaseClient";

interface SponsorBannerProps {
  bannerId: string;
  imageUrl: string;
  altText: string;
  targetUrl: string;
  userId?: string;
}

export const SponsorBanner: React.FC<SponsorBannerProps> = ({
  bannerId,
  imageUrl,
  altText,
  targetUrl,
  userId,
}) => {
  const handleClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // Calculate relative percentage (0 - 100%)
    const xPct = Number(((offsetX / rect.width) * 100).toFixed(2));
    const yPct = Number(((offsetY / rect.height) * 100).toFixed(2));

    // Asynchronously log click without blocking navigation
    supabase.functions.invoke("track-banner-click", {
      body: {
        banner_id: bannerId,
        user_id: userId,
        x_pct: xPct,
        y_pct: yPct,
        viewport_width: window.innerWidth,
      },
    }).catch((err) => console.error("Failed to track click:", err));
  };

  return (
    <a href={targetUrl} target="_blank" rel="noopener noreferrer" className="block relative">
      <img
        src={imageUrl}
        alt={altText}
        onClick={handleClick}
        className="w-full h-auto cursor-pointer rounded-lg shadow-sm"
      />
    </a>
  );
};
