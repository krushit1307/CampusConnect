import { ReactNode, useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

export function BottomSheet({ children, onClose, className }: BottomSheetProps) {
  const navigate = useNavigate();
  const y = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canDrag, setCanDrag] = useState(true);

  // Overlay fades as sheet is dragged down
  // window.innerHeight is not available during SSR, so we default to 800
  const height = typeof window !== "undefined" ? window.innerHeight : 800;
  const overlayOpacity = useTransform(y, [0, height * 0.5], [0.5, 0]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate("/events");
    }
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const shouldClose = info.offset.y > height * 0.4 || info.velocity.y > 600;

    if (shouldClose) {
      handleClose();
    }
  };

  // Touch arbitration logic:
  // If the content is scrolled down, disable dragging the sheet.
  // Re-enable when scrolled back to the top.
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    if (scrollTop > 0 && canDrag) {
      setCanDrag(false);
    } else if (scrollTop <= 0 && !canDrag) {
      setCanDrag(true);
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
      {/* Background Overlay */}
      <motion.div
        style={{ opacity: overlayOpacity }}
        className="fixed inset-0 bg-black"
        onClick={handleClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
      />

      {/* Sheet Content */}
      <motion.div
        drag={canDrag ? "y" : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ y }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className={cn(
          "relative z-10 flex w-full flex-col bg-white rounded-t-[20px] shadow-xl",
          "h-[90dvh]", // Default height
          className,
        )}
      >
        {/* Drag Handle */}
        <div className="flex w-full items-center justify-center p-3 cursor-grab active:cursor-grabbing touch-none">
          <div className="h-1.5 w-12 rounded-full bg-gray-300" />
        </div>

        {/* Header / Close Button */}
        <div className="absolute top-2 right-2 z-20">
          <button
            onClick={handleClose}
            className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Area */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 overscroll-contain"
        >
          {children}
        </div>
      </motion.div>
    </div>
  );
}
