// src/components/events/AddToCalendarDropdown.tsx
import { useEffect, useRef, useState } from "react";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Apple from "lucide-react/dist/esm/icons/apple";
import Globe from "lucide-react/dist/esm/icons/globe";
import Check from "lucide-react/dist/esm/icons/check";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import {
  downloadIcsFile,
  getGoogleCalendarUrl,
  getYahooCalendarUrl,
  type CalendarEvent,
} from "@/lib/addToCalendar";

interface AddToCalendarDropdownProps {
  event: CalendarEvent;
  /** Optional class to control button width / size. */
  className?: string;
  /** Render variant. "default" = filled, "outline" = bordered. */
  variant?: "default" | "outline";
}

type CalendarProvider = "apple" | "google" | "outlook" | "yahoo";

/**
 * The unified "Add to Calendar" dropdown component (Issue #2688).
 *
 * Renders a button with a dropdown menu offering:
 *   - Apple Calendar (downloads .ics, opens in native calendar app)
 *   - Google Calendar (opens pre-filled event in a new tab)
 *   - Outlook (downloads .ics — Outlook and Apple Calendar both use
 *     the same .ics format)
 *   - Yahoo Calendar (opens pre-filled event in a new tab)
 *
 * Behavior:
 *   - Apple / Outlook / Yahoo use the `downloadIcsFile()` helper
 *     which creates a Blob and triggers a download via an invisible
 *     <a> tag.
 *   - Google Calendar opens `getGoogleCalendarUrl()` in a new tab.
 *
 * Accessibility:
 *   - The trigger button exposes `aria-haspopup="menu"` and
 *     `aria-expanded`.
 *   - Each menu item is a real <button> with a descriptive
 *     `aria-label`.
 *   - The dropdown closes on outside-click and Escape.
 */
export function AddToCalendarDropdown({
  event,
  className = "",
  variant = "default",
}: AddToCalendarDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [flash, setFlash] = useState<CalendarProvider | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Close on outside click ───────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // ── Close on Escape ──────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const handleSelect = (provider: CalendarProvider) => {
    switch (provider) {
      case "google": {
        const url = getGoogleCalendarUrl(event);
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
        }
        break;
      }
      case "yahoo": {
        const url = getYahooCalendarUrl(event);
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
        }
        break;
      }
      case "apple":
      case "outlook": {
        downloadIcsFile(event);
        break;
      }
    }

    // Briefly show a checkmark so the user gets feedback the
    // action was triggered (especially for .ics download which
    // has no visible confirmation otherwise).
    setFlash(provider);
    setTimeout(() => setFlash(null), 1500);
    setIsOpen(false);
  };

  const variantClass =
    variant === "outline"
      ? "border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
      : "bg-indigo-600 text-white hover:bg-indigo-700";

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Add to calendar"
        className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${variantClass}`}
      >
        <Calendar className="h-4 w-4" aria-hidden="true" />
        {flash ? (
          <>
            <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <span>Added!</span>
          </>
        ) : (
          <>
            <span>Add to Calendar</span>
            <ChevronDown
              className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Choose calendar provider"
          className="absolute right-0 z-50 mt-2 w-56 origin-top-right overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <MenuItem
            onClick={() => handleSelect("apple")}
            icon={<Apple className="h-4 w-4" aria-hidden="true" />}
            label="Apple Calendar"
            hint=".ics download"
          />
          <MenuItem
            onClick={() => handleSelect("google")}
            icon={<Globe className="h-4 w-4" aria-hidden="true" />}
            label="Google Calendar"
            hint="opens in new tab"
          />
          <MenuItem
            onClick={() => handleSelect("outlook")}
            icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
            label="Outlook"
            hint=".ics download"
          />
          <MenuItem
            onClick={() => handleSelect("yahoo")}
            icon={<Globe className="h-4 w-4" aria-hidden="true" />}
            label="Yahoo Calendar"
            hint="opens in new tab"
          />
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}

function MenuItem({ onClick, icon, label, hint }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none dark:hover:bg-slate-800 dark:focus:bg-slate-800"
    >
      <span className="text-slate-500 dark:text-slate-400">{icon}</span>
      <span className="flex-1">
        <span className="block font-medium text-slate-900 dark:text-slate-100">{label}</span>
        <span className="block text-[10px] text-slate-400 dark:text-slate-500">{hint}</span>
      </span>
    </button>
  );
}
