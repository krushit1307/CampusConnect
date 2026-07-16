import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SCROLL_THRESHOLD = 300;

// Circle geometry for the scroll-progress ring (#274)
const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > SCROLL_THRESHOLD);

      // How far down the page we are, as a 0–1 fraction, driving the ring fill (#274)
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
      setScrollProgress(Math.min(1, Math.max(0, progress)));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const ringOffset = RING_CIRCUMFERENCE * (1 - scrollProgress);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 h-14 w-14 transition-all duration-300",
            isVisible
              ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
              : "opacity-0 translate-y-4 scale-75 pointer-events-none",
          )}
        >
          {/* Scroll-progress ring: track + fill, kept behind the button and non-interactive (#274) */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 56 56"
            aria-hidden="true"
          >
            <circle
              cx="28"
              cy="28"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="2"
              className="stroke-black/15 dark:stroke-white/15"
            />
            <circle
              cx="28"
              cy="28"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              className="stroke-black transition-[stroke-dashoffset] duration-150 ease-out dark:stroke-white"
            />
          </svg>
          <button
            type="button"
            onClick={scrollToTop}
            aria-label="Back to top"
            className="neu-border neu-press absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-cream text-black transition-colors hover:bg-black hover:text-white dark:bg-black dark:text-white dark:hover:bg-white dark:hover:text-black"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent>Back to top</TooltipContent>
    </Tooltip>
  );
}
