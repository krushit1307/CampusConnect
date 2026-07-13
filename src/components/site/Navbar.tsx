import { Link, useLocation } from "@tanstack/react-router";
import { ThemeToggle } from "../ThemeToggle";

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

  return (
    <header className="sticky top-0 z-40 border-b-2 border-black bg-white text-black dark:border-cream dark:bg-black dark:text-cream">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link to="/" className="font-display text-xl font-bold md:text-2xl">
          <span style={{ letterSpacing: "0.04em" }}>CAMPUS</span>
          <span className="bg-black px-1 text-cream dark:bg-cream dark:text-black">CONNECT</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => {
            const isActive =
              l.to === "/"
                ? currentPath === "/"
                : currentPath === l.to || currentPath.startsWith(l.to + "/");

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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/auth"
            className="neu-border neu-press bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-cream hover:bg-cream hover:text-black dark:bg-cream dark:text-black dark:hover:bg-black dark:hover:text-cream"
            style={{ letterSpacing: "0.08em" }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
