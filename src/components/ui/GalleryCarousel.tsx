import React, { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { motion } from "framer-motion";
import Pause from "lucide-react/dist/esm/icons/pause";
import Play from "lucide-react/dist/esm/icons/play";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import { ProgressBar } from "./ProgressBar";

export interface GallerySlide {
  id: string;
  imageUrl: string;
  altText: string;
}

interface GalleryCarouselProps {
  slides: GallerySlide[];
  autoplayDelayMs?: number;
  className?: string;
}

/**
 * GalleryCarousel Component
 * A fluid, auto-advancing image carousel using Embla Carousel.
 * Features:
 * - Autoplay with 5000ms default delay
 * - Visual progress bar indicating time until next slide
 * - Pause on hover/pointer down
 * - Manual navigation buttons
 * - Accessibility: Pause button and prefers-reduced-motion support
 */
export const GalleryCarousel: React.FC<GalleryCarouselProps> = ({
  slides,
  autoplayDelayMs = 5000,
  className = "",
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Initialize Embla with Autoplay plugin
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: "center",
      containScroll: "trimSnaps",
    },
    [
      Autoplay({
        delay: autoplayDelayMs,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
    ],
  );

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Disable autoplay entirely if user prefers reduced motion
  useEffect(() => {
    if (emblaApi && prefersReducedMotion) {
      emblaApi.plugins().autoplay?.stop();
    }
  }, [emblaApi, prefersReducedMotion]);

  // Sync active index for progress bar reset
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setActiveIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    // Reset progress bar animation instantly on manual slide change
    emblaApi.on("select", onSelect);
    emblaApi.on("pointerDown", () => {
      setIsPaused(true);
      if (emblaApi.plugins().autoplay) {
        emblaApi.plugins().autoplay.stop();
      }
    });
    emblaApi.on("pointerUp", () => {
      if (!prefersReducedMotion) {
        setIsPaused(false);
        if (emblaApi.plugins().autoplay) {
          emblaApi.plugins().autoplay.play();
        }
      }
    });

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("pointerDown", () => {});
      emblaApi.off("pointerUp", () => {});
    };
  }, [emblaApi, onSelect, prefersReducedMotion]);

  const scrollPrev = useCallback(() => {
    if (emblaApi) {
      emblaApi.scrollPrev();
      setIsPaused(true);
      setTimeout(() => setIsPaused(false), 500);
    }
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) {
      emblaApi.scrollNext();
      setIsPaused(true);
      setTimeout(() => setIsPaused(false), 500);
    }
  }, [emblaApi]);

  const toggleAutoplay = useCallback(() => {
    if (!emblaApi) return;
    const autoplayPlugin = emblaApi.plugins().autoplay;
    if (!autoplayPlugin) return;

    if (isPaused) {
      autoplayPlugin.play();
      setIsPaused(false);
    } else {
      autoplayPlugin.stop();
      setIsPaused(true);
    }
  }, [emblaApi, isPaused]);

  if (!slides || slides.length === 0) {
    return (
      <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">No images available</span>
      </div>
    );
  }

  return (
    <div className={`relative w-full group ${className}`}>
      {/* Main Carousel Viewport */}
      <div
        className="overflow-hidden rounded-xl"
        ref={emblaRef}
        onPointerDown={() => setIsPaused(true)}
        onPointerUp={() => {
          if (!prefersReducedMotion) setIsPaused(false);
        }}
        role="region"
        aria-roledescription="carousel"
        aria-label="Event image gallery"
      >
        <div className="flex touch-pan-y">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className="flex-[0_0_100%] min-w-0 relative"
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${index + 1} of ${slides.length}: ${slide.altText}`}
            >
              <img
                src={slide.imageUrl}
                alt={slide.altText}
                className="w-full h-64 md:h-96 object-cover select-none pointer-events-none"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Buttons */}
      <button
        onClick={scrollPrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={scrollNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Next slide"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Pause/Play Button (Accessibility Requirement) */}
      <button
        onClick={toggleAutoplay}
        className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label={isPaused ? "Play slideshow" : "Pause slideshow"}
        aria-pressed={isPaused}
      >
        {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
      </button>

      {/* Progress Bar */}
      <div className="px-4 pb-4">
        <ProgressBar
          durationMs={autoplayDelayMs}
          isPaused={isPaused || prefersReducedMotion}
          isActive={true}
        />
      </div>

      {/* Slide Indicators */}
      <div className="flex justify-center gap-2 pb-4">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              emblaApi?.scrollTo(index);
              setIsPaused(true);
              setTimeout(() => setIsPaused(false), 500);
            }}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === activeIndex
                ? "bg-primary w-6"
                : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400"
            }`}
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === activeIndex ? "true" : "false"}
          />
        ))}
      </div>
    </div>
  );
};
