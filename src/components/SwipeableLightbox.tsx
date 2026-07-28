import { useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface SwipeableLightboxProps {
  images: { url: string; caption?: string }[];
  initialIndex?: number;
  onClose: () => void;
}

const swipeConfidenceThreshold = 10000;
const swipeDistanceThreshold = 80;

export function SwipeableLightbox({ images, initialIndex = 0, onClose }: SwipeableLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [[page, direction], setPage] = useState([initialIndex, 0]);

  const paginate = (newDirection: number) => {
    const nextIndex = index + newDirection;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    setPage([nextIndex, newDirection]);
    setIndex(nextIndex);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    const swipe = Math.abs(offset.x) * velocity.x;
    if (swipe < -swipeConfidenceThreshold || offset.x < -swipeDistanceThreshold) {
      paginate(1);
    } else if (swipe > swipeConfidenceThreshold || offset.x > swipeDistanceThreshold) {
      paginate(-1);
    }
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  if (images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 select-none"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 transition-colors"
        onClick={onClose}
        aria-label="Close lightbox"
      >
        <X size={32} />
      </button>

      {images.length > 1 && (
        <>
          <button
            className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:text-gray-300 transition-colors ${
              index === 0 ? "opacity-30 pointer-events-none" : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              paginate(-1);
            }}
            aria-label="Previous image"
          >
            <ChevronLeft size={40} />
          </button>
          <button
            className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:text-gray-300 transition-colors ${
              index === images.length - 1 ? "opacity-30 pointer-events-none" : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              paginate(1);
            }}
            aria-label="Next image"
          >
            <ChevronRight size={40} />
          </button>
        </>
      )}

      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={page}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={handleDragEnd}
            className="flex items-center justify-center"
          >
            <img
              src={images[index].url}
              alt={images[index].caption || "Gallery image"}
              className="max-w-full max-h-[85vh] object-contain neu-border"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>

        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setPage([i, i > index ? 1 : -1]);
                  setIndex(i);
                }}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i === index ? "bg-white scale-125" : "bg-white/50 hover:bg-white/80"
                }`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
