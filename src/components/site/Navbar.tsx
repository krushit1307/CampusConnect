import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { localizedPath } from "@/lib/i18n";
import { useScrollDirection } from "@/hooks/useScrollDirection";

import { ThemeToggle } from "../ThemeToggle";
import { NavbarNotificationDropdown } from "./NavbarNotificationDropdown";
import { BookmarksPanel } from "@/components/BookmarksPanel";
import { createClient } from "@/lib/supabase/client";

import Menu from "lucide-react/dist/esm/icons/menu";
import X from "lucide-react/dist/esm/icons/x";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import Bookmark from "lucide-react/dist/esm/icons/bookmark";
import Search from "lucide-react/dist/esm/icons/search";
import { useAuthHydration } from "@/hooks/useAuthHydration";
import { useProfileCompleteness } from "@/hooks/useProfileCompleteness";
import { ProfileCompletionAvatar } from "./ProfileCompletionAvatar";
import { ProfileHeaderSkeleton } from "@/components/ProfileHeaderSkeleton";
import { openCommandPalette } from "@/lib/commandPalette";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const links = [
  { to: "/events", label: "Events" },
  { to: "/clubs", label: "Clubs" },
  { to: "/feed", label: "Feed" },
  { to: "/gallery", label: "Gallery" },
  { to: "/certificates", label: "Certificates" },
  { to: "/dashboard", label: "Dashboard" },
] as const;

export function Navbar() {
  const { user, isInitializing } = useAuthHydration();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const currentPath = location.pathname;
  const supabase = createClient();
  const { data: completionPercentage } = useProfileCompleteness(user?.id ?? null);

  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Hide navbar on scroll down, show instantly on scroll up (mobile only)
  const { direction, scrollY } = useScrollDirection();
  // Hide only when scrolled past 50px and actively scrolling down
  const isNavbarHidden = direction === "down" && scrollY >= 50;

  const [isOffline, setIsOffline] = useState(!navigator.onLine);

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

  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setUserRole(null);
      return;
    }
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUserRole(data.role);
        }
      });
  }, [user, supabase]);

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
    {
      to: localizedPath(i18n.language, "/api-playground"),
      label: "Playground",
    },
  ];

  const dynamicLinks = [...links];
  if (userRole === "facility_manager" || userRole === "system_admin") {
    dynamicLinks.push({
      to: localizedPath(i18n.language, "/facility-dashboard"),
      label: "Facility",
    });
  }

  const landingLinks = [
    { href: "#features", label: t("navbar.features") },
    { href: "#faq", label: t("navbar.faq") },
    { href: "#contact", label: t("navbar.contact") },
  ];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bookmarksPanelOpen, setBookmarksPanelOpen] = useState(false);

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
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <header
      className={`sticky top-0 z-40 border-b-2 border-black bg-white text-black dark:border-cream dark:bg-black dark:text-cream
        transition-transform duration-200 ease-out
        ${isNavbarHidden ? "-translate-y-full md:translate-y-0" : "translate-y-0"}`}
      aria-hidden={isNavbarHidden}
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
          {dynamicLinks.map((link) => {
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

          {isInitializing ? (
            <ProfileHeaderSkeleton />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ProfileCompletionAvatar
                  initials={user.email?.[0]?.toUpperCase() ?? "U"}
                  percentage={completionPercentage}
                />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                {/* Email */}
                <DropdownMenuLabel className="break-all text-xs">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Dashboard */}
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </DropdownMenuItem>

                {/* Messages */}
                <DropdownMenuItem asChild>
                  <Link to="/messages">Messages</Link>
                </DropdownMenuItem>

                {/* Settings */}
                <DropdownMenuItem asChild>
                  <Link to="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {/* Sign Out */}
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
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

          {/* Global search (Cmd+K) trigger — highly visible on mobile where the
              keyboard shortcut does not exist */}
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Open global search"
            className="neu-border flex h-8 w-8 shrink-0 items-center justify-center bg-white p-1 text-black transition-colors hover:bg-lime dark:bg-black dark:text-cream"
          >
            <Search size={18} />
          </button>

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
              <ProfileCompletionAvatar
                initials={user.email?.[0]?.toUpperCase() ?? "U"}
                percentage={completionPercentage}
              />
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

      <BookmarksPanel
        open={bookmarksPanelOpen}
        onOpenChange={setBookmarksPanelOpen}
        user={user ?? null}
      />

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

            {dynamicLinks.map((link) => {
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
