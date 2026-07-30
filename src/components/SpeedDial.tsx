import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Calendar, FileText, MessageCircle } from "lucide-react";

interface Action {
  label: string;
  icon: typeof Calendar;
  route: string;
}

const actions: Action[] = [
  { label: "Create Event", icon: Calendar, route: "/events" },
  { label: "Create Post", icon: FileText, route: "/feed" },
  { label: "New Message", icon: MessageCircle, route: "/messages" },
];

export function SpeedDial() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const mainBtnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    mainBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, close]);

  const handleAction = (route: string) => {
    close();
    navigate(route);
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.8 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { delay: i * 0.05, type: "spring", stiffness: 300, damping: 25 },
    }),
    exit: { opacity: 0, y: 20, scale: 0.8, transition: { duration: 0.15 } },
  };

  return (
    <div ref={menuRef} className="fixed bottom-6 right-6 z-50 md:hidden">
      <AnimatePresence>
        {isOpen && (
          <>
            {actions.map((action, i) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.label}
                  custom={i}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  onClick={() => handleAction(action.route)}
                  className="absolute bottom-0 right-0 flex items-center gap-2 rounded-full bg-white pr-5 pl-4 h-12 shadow-lg border border-gray-200 hover:bg-gray-50 active:scale-95 transition-colors cursor-pointer whitespace-nowrap"
                  style={{
                    transformOrigin: "bottom right",
                    translate: `0 ${-(i + 1) * 64}px`,
                  }}
                  aria-label={action.label}
                >
                  <Icon size={20} className="shrink-0 text-brand-blue-dark" />
                  <span className="font-mono text-sm font-bold text-brand-blue-dark">
                    {action.label}
                  </span>
                </motion.button>
              );
            })}
          </>
        )}
      </AnimatePresence>

      <button
        ref={mainBtnRef}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-blue-dark text-white shadow-lg hover:bg-brand-blue-alt active:scale-95 transition-all cursor-pointer"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Plus size={28} />
        </motion.div>
      </button>
    </div>
  );
}
