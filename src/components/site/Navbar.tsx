import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { localizedPath } from "@/lib/i18n";
import { Bookmark } from "lucide-react";

import { ThemeToggle } from "../ThemeToggle";
import { NavbarNotificationDropdown } from "./NavbarNotificationDropdown";
import { UserAvatarWidget } from "./UserAvatarWidget";
import { BookmarksPanel } from "@/components/BookmarksPanel";

import { Menu, X, WifiOff, Bookmark } from "lucide-react";
import { useAuthHydration } from "@/hooks/useAuthHydration";
import { useScrollSentinel } from "@/hooks/useScrollSentinel";
import { ProfileHeaderSkeleton } from "@/components/ProfileHeaderSkeleton";

export function Navbar() {
  const { user, isInitializing } = useAuthHydration();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const currentPath = location.pathname;

  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // --- Glassmorphism scroll-aware navbar ---------------------------------
  // `sentinelRef` marks a 1px element at the true top of the page. Once it
  // scrolls out of view we know the user is no longer at the top, so we
  // switch the navbar to its frosted-glass appearance. This is driven by
  // IntersectionObserver (see useScrollSentinel) instead of a scroll
  // listener, since re-rendering on every scroll pixel just to flip one
  // boolean is wasted work — and `backdrop-filter` is expensive to
  // composite on mobile GPUs, so it should only be paid for when it's
  // actually visible over content.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isScrolled = useScrollSentinel(sentinelRef);

  // Because the navbar is `position: fixed` (removed from normal flow),
  // we measure its rendered height and render a same-height spacer right
  // after it so page content doesn't start out hidden underneath it. A
  // ResizeObserver keeps this in sync when the navbar's height changes
  // (e.g. the mobile menu opening, text wrapping, font loading).
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const links = [
    {
      to: localizedPath(i18n.language, "/events"),
      label: t("navbar.events"),
    },
    {
      to: localizedPath(i18n.language, "/clubs"),
      label: t("navbar.clubs"),
    },
    {
      to: localizedPath(i18n.language, "/feed"),
      label: t("navbar.feed"),
    },
    {
      to: localizedPath(i18n.language, "/directory"),
      label: t("navbar.directory"),
    },
    {
      to: localizedPath(i18n.language, "/challenge"),
      label: t("navbar.challenge"),
    },
    {
      to: localizedPath(i18n.language, "/certificates"),
      label: t("navbar.certificates"),
    },
    {
      to: localizedPath(i18n.language, "/dashboard"),
      label: t("navbar.dashboard"),
    },
    {
      to: localizedPath(i18n.language, "/messages"),
      label: t("navbar.messages"),
    },
  ];

  const landingLinks = [
    { href: "#features", label: t("navbar.features") },
    { href: "#faq", label: t("navbar.faq") },
    { href: "#contact", label: t("navbar.contact") },
  ];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bookmarksPanelOpen, setBookmarksPanelOpen] = useState(false);

  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setHeaderHeight(entry.contentRect.height);
    });

    observer.observe(header);
    return () => observer.disconnect();
  }, []);

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
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      {/*
        Sentinel: a 1px element in normal document flow at the very top of
        the page. The fixed header below is out of flow, so this sits at
        true document y=0 regardless of JSX order. IntersectionObserver
        watches it (see useScrollSentinel) to detect the top-of-page state.
      */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      <header
        ref={headerRef}
        className={`fixed inset-x-0 top-0 z-50 border-b-2 border-black text-black transition-colors duration-200 dark:border-cream dark:text-cream ${
          isScrolled
            ? "navbar-glass bg-white/70 dark:bg-black/60"
            : "bg-white dark:bg-black"
        }`}
      >
      <div className="mx-auto flex min-w-0 max-w-7xl items-center justify-between gap-2 px-2 py-3 sm:px-4 md:px-6">
        {/* Logo */}
        <Link
          to={localizedPath(i18n.language, "/")}
          className="min-w-0 flex-1 truncate font-display text-sm font-bold sm:flex-none sm:text-xl md:text-2xl navbar-logo"
        >
          <span style={{ letterSpacing: "0.04em" }}>CAMPUS</span>
          <span className="bg-black px-1 text-cream dark:bg-cream dark:text-black">CONNECT</span>
        </Link>

        {/* Desktop Navbar */}
        <nav aria-label="Main navigation" className="hidden items-center gap-6 md:flex">
          {/* Landing page section links */}
          {currentPath === "/" &&
            landingLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="font-mono text-sm font-bold uppercase hover:underline"
                style={{ letterSpacing: "0.05em" }}
              >
                {link.label}
              </a>
            ))}

          {/* Route links */}
          {links.map((link) => {
            const isActive = currentPath === link.to || currentPath.startsWith(link.to + "/");

            return (
              <Link
                key={link.to}
                to={link.to}
                id={`nav-link-${link.label.toLowerCase()}`}
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
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {isOffline && (
            <div
              data-testid="offline-indicator"
              className="flex items-center gap-1.5 rounded bg-amber-500 px-2 py-1 font-mono text-xs font-bold text-black"
            >
              <WifiOff className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Offline Mode</span>
            </div>
          )}

          <ThemeToggle />

          {user && <NavbarNotificationDropdown />}
          {user && (
            <button
              type="button"
              aria-label="Open bookmarks"
              onClick={() => setBookmarksPanelOpen(true)}
              className="neu-border flex h-8 w-8 items-center justify-center bg-white text-black transition-colors hover:bg-lime dark:bg-black dark:text-cream"
            >
              <Bookmark size={16} />
            </button>
          )}

          {isInitializing ? <ProfileHeaderSkeleton /> : <UserAvatarWidget />}
        </div>

          {user && <NavbarNotificationDropdown />}
          {user && (
            <button
              type="button"
              aria-label="Open bookmarks"
              onClick={() => setBookmarksPanelOpen(true)}
              className="neu-border flex h-8 w-8 items-center justify-center bg-white text-black transition-colors hover:bg-lime dark:bg-black dark:text-cream"
            >
              <Bookmark size={16} />
            </button>
          )}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="User menu"
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-lime font-mono text-xs font-bold uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:focus-visible:ring-cream"
                >
                  {user.email?.[0]?.toUpperCase() ?? "U"}
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="break-all text-xs">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/messages">Messages</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600">
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/auth"
              id="nav-signin-button"
              className="neu-border neu-press bg-black px-3 py-1.5 font-mono text-xs font-bold uppercase text-cream hover:bg-cream hover:text-black dark:bg-cream dark:text-black dark:hover:bg-black dark:hover:text-cream"
              style={{ letterSpacing: "0.08em" }}
            >
              Sign in
            </Link>
          )}
        </div>

      <BookmarksPanel open={bookmarksPanelOpen} onOpenChange={setBookmarksPanelOpen} user={user} />

      <BookmarksPanel
        open={bookmarksPanelOpen}
        onOpenChange={setBookmarksPanelOpen}
        user={user ?? null}
      />

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
            {currentPath === "/" &&
              landingLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="neu-border w-full px-4 py-2.5 text-left font-mono text-sm font-bold uppercase bg-white text-black hover:bg-lime"
                  style={{ letterSpacing: "0.05em" }}
                >
                  {link.label}
                </a>
              ))}

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

      {/*
        Spacer: reserves the fixed header's live height in the document
        flow so page content doesn't render underneath it. Kept in sync
        via ResizeObserver above.
      */}
      <div style={{ height: headerHeight }} aria-hidden="true" />
    </>
  );
}
