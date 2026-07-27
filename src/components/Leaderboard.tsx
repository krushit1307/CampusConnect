import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { LeaderboardRenderer } from "@/lib/leaderboard/renderer";
import type { LeaderboardEntry } from "@/lib/leaderboard/types";
import "@/components/Leaderboard.css";

const ROW_HEIGHT = 60;

export interface LeaderboardHandle {
  update: (entries: LeaderboardEntry[]) => void;
}

interface LeaderboardProps {
  className?: string;
  initialEntries?: LeaderboardEntry[];
}

export const Leaderboard = forwardRef<LeaderboardHandle, LeaderboardProps>(function Leaderboard(
  { className, initialEntries },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<LeaderboardRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const renderer = new LeaderboardRenderer(containerRef.current, ROW_HEIGHT);
    rendererRef.current = renderer;
    if (initialEntries && initialEntries.length > 0) {
      renderer.update(initialEntries);
    }
    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    update: (entries: LeaderboardEntry[]) => {
      rendererRef.current?.update(entries);
    },
  }));

  return (
    <div className={`lb-container${className ? ` ${className}` : ""}`}>
      <div ref={containerRef} className="lb-viewport" />
    </div>
  );
});
