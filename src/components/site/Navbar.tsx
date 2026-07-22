import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { ThemeToggle } from "../ThemeToggle";
import { usePresence } from "@/hooks/usePresence";
import { NavbarNotificationDropdown } from "./NavbarNotificationDropdown";
import { UserDropdown } from "../Navigation/UserDropdown";

import { Menu, X } from "lucide-react";

const links = [
  { to: "/events", label: "Events" },
  { to: "/clubs", label: "Clubs" },
  { to: "/feed", label: "Feed" },
  { to: "/certificates", label: "Certificates" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/messages", label: "Messages" },
] as const;

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const onlineUsers = usePresence(user?.id);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (mobileMenuOpen) {
      const focusTimeout = setTimeout(() => {
        const firstLink = navRef.current?.querySelector("a");
        if (firstLink) {
          (firstLink as HTMLElement).focus();
        }
      }, 0);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setMobileMenuOpen(false);
          hamburgerRef.current?.focus();
          return;
        }

        if (e.key === "Tab") {
          const hamburger = hamburgerRef.current;
          const nav = navRef.current;
          if (!hamburger || !nav) return;

          const focusableLinks = Array.from(
            nav.querySelectorAll("a, button, [tabindex='0']"),
          ) as HTMLElement[];

          if (focusableLinks.length === 0) return;

          const firstLink = focusableLinks[0];
          const lastLink = focusableLinks[focusableLinks.length - 1];

          if (document.activeElement === hamburger && e.shiftKey) {
            e.preventDefault();
            lastLink.focus();
          } else if (document.activeElement === lastLink && !e.shiftKey) {
            e.preventDefault();
            hamburger.focus();
          } else if (document.activeElement === firstLink && e.shiftKey) {
            e.preventDefault();
            hamburger.focus();
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => {
        clearTimeout(focusTimeout);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [mobileMenuOpen]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out failed:", error.message);
      return;
    }

    navigate("/", { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b-2 border-black bg-white text-black dark:border-cream dark:bg-black dark:text-cream">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-4 md:px-6">
        {/* Logo */}
        <Link to="/" className="shrink-0 font-display text-lg font-bold sm:text-xl md:text-2xl">
          <span style={{ letterSpacing: "0.04em" }}>CAMPUS</span>
          <span className="bg-black px-1 text-cream dark:bg-cream dark:text-black">CONNECT</span>
        </Link>

        {/* Desktop Navbar */}
        <nav aria-label="Main navigation" className="hidden items-center gap-6 md:flex">
          {links.map((link) => {
            const isActive = currentPath === link.to || currentPath.startsWith(link.to + "/");

            return (
              <Link
                key={link.to}
                to={link.to}
                className={`font-mono text-sm font-bold uppercase hover:underline ${
                  isActive ? "underline underline-offset-4 decoration-2" : ""
                }`}
                style={{ letterSpacing: "0.05em" }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden rounded-full border border-black bg-lime px-2 py-1 text-xs font-mono font-bold md:flex dark:border-cream dark:text-black">
              🟢 {onlineUsers} online
            </div>

            <ThemeToggle />

            {user && <NavbarNotificationDropdown />}
            {user ? (
              <UserDropdown user={user} onSignOut={handleSignOut} />
            ) : (
              <Link
                to="/auth"
                className="neu-border neu-press bg-black px-3 py-1.5 font-mono text-xs font-bold uppercase text-cream hover:bg-cream hover:text-black dark:bg-cream dark:text-black dark:hover:bg-black dark:hover:text-cream"
                style={{ letterSpacing: "0.08em" }}
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile menu toggle button */}
          <button
            ref={hamburgerRef}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="neu-border flex h-8 w-8 shrink-0 items-center justify-center bg-white p-1 text-black transition-colors hover:bg-lime dark:bg-black dark:text-cream md:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav
          ref={navRef}
          id="mobile-navigation"
          role="dialog"
          aria-modal="true"
          className="border-t-2 border-black bg-cream p-4 dark:border-cream dark:bg-black md:hidden"
        >
          <div className="flex flex-col gap-2">
            {links.map((link) => {
              const isActive = currentPath === link.to || currentPath.startsWith(link.to + "/");

              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`neu-border w-full px-4 py-2.5 text-left font-mono text-sm font-bold uppercase ${
                    isActive
                      ? "bg-black text-cream dark:bg-cream dark:text-black"
                      : "bg-white text-black hover:bg-lime dark:bg-brand-gray-base-800 dark:text-cream"
                  }`}
                  style={{ letterSpacing: "0.05em" }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
