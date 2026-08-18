import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import FileText from "lucide-react/dist/esm/icons/file-text";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle";
import Plus from "lucide-react/dist/esm/icons/plus";
import { useNavigate } from "react-router-dom";
import { getRadialOffset } from "./radialFabUtils";

const ACTION_ANGLES = [90, 135, 180];

const actions = [
  { label: "Create Event", icon: Calendar, route: "/events" },
  { label: "Create Post", icon: FileText, route: "/feed" },
  { label: "New Message", icon: MessageCircle, route: "/messages" },
];

export function RadialFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleAction = (route: string) => {
    setIsOpen(false);
    navigate(route);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.button
            type="button"
            aria-label="Close creation menu"
            data-testid="radial-fab-backdrop"
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 right-6 z-50 md:hidden">
        <AnimatePresence>
          {isOpen &&
            actions.map((action, index) => {
              const Icon = action.icon;
              const offset = getRadialOffset(ACTION_ANGLES[index]);

              return (
                <motion.button
                  key={action.label}
                  type="button"
                  aria-label={action.label}
                  className="absolute bottom-0 right-0 flex h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-white text-black shadow-[3px_3px_0_0_#000] transition-colors hover:bg-lime"
                  initial={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    x: offset.x,
                    y: offset.y,
                    transition: {
                      type: "spring",
                      stiffness: 340,
                      damping: 22,
                      delay: index * 0.04,
                    },
                  }}
                  exit={{ opacity: 0, scale: 0.5, x: 0, y: 0, transition: { duration: 0.15 } }}
                  onClick={() => handleAction(action.route)}
                >
                  <Icon aria-hidden="true" size={20} strokeWidth={2.5} />
                  <span className="sr-only">{action.label}</span>
                </motion.button>
              );
            })}
        </AnimatePresence>

        <motion.button
          type="button"
          aria-label={isOpen ? "Close creation menu" : "Open creation menu"}
          aria-expanded={isOpen}
          className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-2 border-black bg-lime text-black shadow-[4px_4px_0_0_#000] transition-colors hover:bg-yellow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
          onClick={() => setIsOpen((current) => !current)}
        >
          <motion.span
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 22 }}
          >
            <Plus aria-hidden="true" size={28} strokeWidth={3} />
          </motion.span>
        </motion.button>
      </div>
    </>
  );
}
