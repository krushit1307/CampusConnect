import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Compass,
  Home,
  Search,
  Settings,
  ShieldAlert,
  User,
  Users,
  Building2,
  Bookmark,
} from "lucide-react";
import { useCommandPaletteSearch } from "@/hooks/useCommandPaletteSearch";
export interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ open: externalOpen, onOpenChange }: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const navigate = useNavigate();
  const { results: searchResults, isLoading: isSearching } = useCommandPaletteSearch(query);

  const isOpen = externalOpen ?? internalOpen;
  const setIsOpen = React.useCallback(
    (value: boolean) => {
      setInternalOpen(value);
      onOpenChange?.(value);
    },
    [onOpenChange],
  );

  const handleSelect = React.useCallback(
    (path: string) => {
      setIsOpen(false);
      setQuery("");
      navigate(path);
    },
    [navigate, setIsOpen],
  );

  const navigationItems = [
    { label: "Home", path: "/", icon: Home, group: "Navigation" },
    { label: "Explore Clubs", path: "/clubs", icon: Compass, group: "Navigation" },
    { label: "Events Calendar", path: "/events", icon: Calendar, group: "Navigation" },
    { label: "Saved Bookmarks", path: "/bookmarks", icon: Bookmark, group: "Navigation" },
    { label: "User Settings", path: "/settings", icon: Settings, group: "Navigation" },
    { label: "Profile", path: "/profile", icon: User, group: "Navigation" },
    { label: "Admin Panel", path: "/admin/clubs/pending", icon: ShieldAlert, group: "Navigation" },
  ];

  const searchItems = searchResults.map((result) => ({
    label: result.label,
    path: result.path,
    icon: result.type === "club" ? Building2 : result.type === "event" ? Calendar : Users,
    group: result.sublabel,
  }));

  const filteredNavItems = navigationItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()),
  );

  // "events: hackathon" scopes results to that table only; a plain word
  // shows matching nav links plus live search results.
  const filteredItems = query.includes(":") ? searchItems : [...filteredNavItems, ...searchItems];

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Toggle palette with Cmd+K or Ctrl+K, and handle in-palette keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(!isOpen);
        return;
      }

      if (!isOpen) return;

      if (e.key === "Escape") {
        setIsOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (filteredItems.length ? (prev + 1) % filteredItems.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          filteredItems.length ? (prev - 1 + filteredItems.length) % filteredItems.length : 0,
        );
      } else if (e.key === "Enter" && filteredItems[activeIndex]) {
        e.preventDefault();
        handleSelect(filteredItems[activeIndex].path);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen, activeIndex, filteredItems, handleSelect]);

  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-background shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-border px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            type="text"
placeholder="Search, or type events: / clubs: / users: to filter..."            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            autoFocus
          />
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

<div className="max-h-[300px] overflow-y-auto p-2">
          {isSearching && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">Searching…</div>
          )}
          {filteredItems.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No results found.</div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={`${item.group}-${item.path}-${index}`}
                    onClick={() => handleSelect(item.path)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors text-left ${
                      index === activeIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{item.group}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>      </div>
    </div>
  );
}
