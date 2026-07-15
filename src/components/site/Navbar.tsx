import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { ThemeToggle } from "../ThemeToggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Menu, X } from "lucide-react";

const links = [
  { to: "/events", label: "Events" },
  { to: "/clubs", label: "Clubs" },
  { to: "/feed", label: "Feed" },
  { to: "/certificates", label: "Certificates" },
  { to: "/dashboard", label: "Dashboard" },
] as const;

export function Navbar() {
  const location = useLocation();
  const currentPath = location.pathname;
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close mobile menu when location changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-black bg-white text-black dark:border-cream dark:bg-black dark:text-cream">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-4 md:px-6">
        <Link to="/" className="font-display text-lg font-bold sm:text-xl md:text-2xl shrink-0">
          <span style={{ letterSpacing: "0.04em" }}>CAMPUS</span>
          <span className="bg-black px-1 text-cream dark:bg-cream dark:text-black">CONNECT</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-6 md:flex">
          {links.map((l) => {
            const isActive = currentPath === l.to || currentPath.startsWith(l.to + "/");

            return (
              <Link
                key={l.to}
                to={l.to}
                className={`font-mono text-sm font-bold uppercase hover:underline ${
                  isActive ? "underline underline-offset-4 decoration-2" : ""
                }`}
                style={{ letterSpacing: "0.05em" }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          {user && <NotificationBell />}

          {user ? (
            <Link
              to="/dashboard"
              aria-label="Dashboard"
              className="flex items-center gap-2 shrink-0"
            >
              <div
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-lime font-mono text-xs font-bold uppercase"
              >
                {user.email?.[0].toUpperCase() ?? "U"}
              </div>
            </Link>
          ) : (
            <Link
              to="/auth"
              className="neu-border neu-press bg-black px-3 py-1.5 font-mono text-xs font-bold uppercase text-cream hover:bg-cream hover:text-black dark:bg-cream dark:text-black dark:hover:bg-black dark:hover:text-cream"
              style={{ letterSpacing: "0.08em" }}
            >
              Sign in
            </Link>
          )}

          {/* Mobile Hamburger menu */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="neu-border flex h-8 w-8 items-center justify-center bg-white p-1 text-black transition-colors hover:bg-lime dark:bg-black dark:text-cream md:hidden shrink-0"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile navigation panel */}
      {mobileMenuOpen && (
        <nav className="border-t-2 border-black bg-cream p-4 dark:border-cream dark:bg-black md:hidden">
          <div className="flex flex-col gap-2">
            {links.map((l) => {
              const isActive = currentPath === l.to || currentPath.startsWith(l.to + "/");

              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`neu-border w-full px-4 py-2.5 font-mono text-sm font-bold uppercase text-left transition-colors ${
                    isActive
                      ? "bg-black text-cream dark:bg-cream dark:text-black"
                      : "bg-white text-black hover:bg-lime dark:bg-[#1a1a1a] dark:text-cream dark:hover:bg-lime/25"
                  }`}
                  style={{ letterSpacing: "0.05em" }}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const notifications: string[] = [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={buttonRef}
            onClick={() => setOpen((o) => !o)}
            className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-white transition-colors hover:bg-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            aria-label="Notifications"
            aria-expanded={open}
            aria-haspopup="true"
          >
            🔔
            {notifications.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-black bg-peach font-mono text-[9px] font-bold">
                {notifications.length}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>

      {open && (
        <div
          role="menu"
          aria-label="Notifications menu"
          className="neu-border absolute right-0 top-10 z-50 w-72 bg-white"
        >
          <div className="border-b-2 border-black px-4 py-2">
            <p
              className="font-mono text-xs font-bold uppercase"
              style={{ letterSpacing: "0.05em" }}
            >
              Notifications
            </p>
          </div>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
              <span className="text-3xl">✅</span>
              <p className="font-display font-bold text-gray-500">You're all caught up!</p>
              <p className="font-mono text-xs text-gray-400">No new notifications right now.</p>
            </div>
          ) : (
            <ul className="divide-y-2 divide-black">
              {notifications.map((n, i) => (
                <li key={i} role="menuitem" className="px-4 py-3 font-mono text-sm">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
