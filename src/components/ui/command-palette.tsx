import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Compass from "lucide-react/dist/esm/icons/compass";
import Home from "lucide-react/dist/esm/icons/home";
import Settings from "lucide-react/dist/esm/icons/settings";
import Search from "lucide-react/dist/esm/icons/search";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import User from "lucide-react/dist/esm/icons/user";
import Bookmark from "lucide-react/dist/esm/icons/bookmark";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import { createClient } from "@/lib/supabase/client";
import { useCommandPalette } from "@/components/CommandPaletteProvider";
import { useCommandPaletteSearch } from "@/hooks/useCommandPaletteSearch";

export interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ open: externalOpen, onOpenChange }: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
const [query, setQuery] = React.useState("");
const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);
const [dateFilter, setDateFilter] = React.useState<"this_week" | null>(null);  const [pages, setPages] = React.useState<string[]>(["home"]);
  const activePage = pages[pages.length - 1];

  const navigate = useNavigate();
  const { commands } = useCommandPalette();

  const isOpen = externalOpen ?? internalOpen;
  const setIsOpen = React.useCallback(
    (value: boolean) => {
      setInternalOpen(value);
      onOpenChange?.(value);
      if (!value) {
setQuery("");
setPages(["home"]);
setCategoryFilter(null);
setDateFilter(null);      }
    },
    [onOpenChange],
  );

  const previousActiveElement = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    } else {
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen]);

  const [fallbackClubs, setFallbackClubs] = React.useState<any[]>([]);
  const [fallbackEvents, setFallbackEvents] = React.useState<any[]>([]);
  const [fallbackUsers, setFallbackUsers] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!isOpen) return;
    const supabase = createClient();
    if (activePage === "clubs" && fallbackClubs.length === 0) {
      supabase
        .from("clubs")
        .select("id, name, slug")
        .limit(10)
        .then(({ data }) => {
          if (data) setFallbackClubs(data);
        });
    }
    if (activePage === "events" && fallbackEvents.length === 0) {
      supabase
        .from("events")
        .select("id, title")
        .order("event_date", { ascending: false })
        .limit(10)
        .then(({ data }) => {
          if (data) setFallbackEvents(data);
        });
    }
    if (activePage === "users" && fallbackUsers.length === 0) {
      supabase
        .from("profiles")
        .select("id, handle, first_name, last_name")
        .limit(10)
        .then(({ data }) => {
          if (data) setFallbackUsers(data);
        });
    }
  }, [isOpen, activePage, fallbackClubs.length, fallbackEvents.length, fallbackUsers.length]);

const searchQuery = activePage === "home" ? query : `${activePage}:${query}`;

const { results, isLoading } = useCommandPaletteSearch(
  searchQuery,
  activePage === "events" ? categoryFilter : null,
  activePage === "events" ? dateFilter : null,
);
  const handleSelect = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleCommand = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !query && pages.length > 1) {
      e.preventDefault();
      setPages((prev) => prev.slice(0, -1));
    }
  };

  const navigationItems = [
    { label: "Home", path: "/", icon: Home },
    { label: "Explore Clubs", path: "/clubs", icon: Compass },
    { label: "Events Calendar", path: "/events", icon: Calendar },
    { label: "Saved Bookmarks", path: "/bookmarks", icon: Bookmark },
    { label: "User Settings", path: "/settings", icon: Settings },
    { label: "Profile", path: "/profile", icon: User },
    { label: "Admin Panel", path: "/admin/clubs/pending", icon: ShieldAlert },
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden border-4 border-black bg-cream shadow-[8px_8px_0_0_#000] rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false} className="w-full">
          <div className="flex items-center border-b-4 border-black px-3 py-2 bg-white">
            <Search className="mr-2 h-5 w-5 shrink-0 text-black" />
            <Command.Input
              placeholder="Type a command or search..."
              value={query}
              onValueChange={setQuery}
              onKeyDown={handleKeyDown}
              className="flex h-11 w-full bg-transparent py-3 text-sm font-mono font-bold text-black outline-none placeholder:text-gray-500"
              autoFocus
            />
            {pages.length > 1 && (
              <button
                onClick={() => setPages((prev) => prev.slice(0, -1))}
                className="mr-2 p-1 border border-black bg-white font-mono text-xs font-bold flex items-center gap-0.5 hover:bg-peach cursor-pointer"
              >
                <ChevronLeft className="h-3 w-3" /> Back
              </button>
            )}
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 border border-black bg-white px-1.5 font-mono text-[10px] font-bold text-black">
              ESC
            </kbd>
          </div>
<Command.List className="max-h-[300px] overflow-y-auto p-2 bg-cream"></Command.List>
          {activePage === "events" && (
  <div className="flex flex-wrap gap-2 border-b-2 border-black bg-cream p-2">
    <button
      type="button"
      onClick={() => setDateFilter(dateFilter === "this_week" ? null : "this_week")}
      className={`border-2 border-black px-3 py-1 font-mono text-xs font-bold ${
        dateFilter === "this_week" ? "bg-lime" : "bg-white"
      }`}
    >
      This Week
    </button>

    <button
      type="button"
      onClick={() =>
        setCategoryFilter(categoryFilter === "Academic" ? null : "Academic")
      }
      className={`border-2 border-black px-3 py-1 font-mono text-xs font-bold ${
        categoryFilter === "Academic" ? "bg-lime" : "bg-white"
      }`}
    >
      Academic
    </button>

    <button
      type="button"
      onClick={() =>
        setCategoryFilter(categoryFilter === "Social" ? null : "Social")
      }
      className={`border-2 border-black px-3 py-1 font-mono text-xs font-bold ${
        categoryFilter === "Social" ? "bg-lime" : "bg-white"
      }`}
    >
      Social
    </button>
  </div>
)}
          <Command.List className="max-h-[300px] overflow-y-auto p-2 bg-cream">
            {isLoading && (
              <div className="px-3 py-2 font-mono text-xs text-gray-500">Searching...</div>
            )}

            {!isLoading && results.length === 0 && query && (
              <Command.Empty className="py-6 text-center font-mono text-sm text-gray-500">
                No results found.
              </Command.Empty>
            )}

            {activePage === "home" && !query && (
              <>
                <Command.Group heading="Sub-Searches" className="font-mono text-[10px] font-black uppercase text-gray-500 px-2 py-1">
                  <Command.Item
                    value="search-clubs"
                    onSelect={() => {
                      setQuery("");
                      setPages((prev) => [...prev, "clubs"]);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm font-mono font-bold text-black border-2 border-transparent data-[selected=true]:border-black data-[selected=true]:bg-lime data-[selected=true]:shadow-[2px_2px_0_0_#000] cursor-pointer text-left transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Compass className="h-4 w-4" />
                      <span>Search Clubs specifically...</span>
                    </div>
                    <ArrowRight className="h-4 w-4" />
                  </Command.Item>

                  <Command.Item
                    value="search-events"
                    onSelect={() => {
                      setQuery("");
                      setPages((prev) => [...prev, "events"]);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm font-mono font-bold text-black border-2 border-transparent data-[selected=true]:border-black data-[selected=true]:bg-lime data-[selected=true]:shadow-[2px_2px_0_0_#000] cursor-pointer text-left transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Search Events specifically...</span>
                    </div>
                    <ArrowRight className="h-4 w-4" />
                  </Command.Item>

                  <Command.Item
                    value="search-users"
                    onSelect={() => {
                      setQuery("");
                      setPages((prev) => [...prev, "users"]);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm font-mono font-bold text-black border-2 border-transparent data-[selected=true]:border-black data-[selected=true]:bg-lime data-[selected=true]:shadow-[2px_2px_0_0_#000] cursor-pointer text-left transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Search Users specifically...</span>
                    </div>
                    <ArrowRight className="h-4 w-4" />
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Navigation" className="font-mono text-[10px] font-black uppercase text-gray-500 px-2 py-1 mt-2">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Command.Item
                        key={item.path}
                        value={item.label}
                        onSelect={() => handleSelect(item.path)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-mono font-bold text-black border-2 border-transparent data-[selected=true]:border-black data-[selected=true]:bg-lime data-[selected=true]:shadow-[2px_2px_0_0_#000] cursor-pointer text-left transition-all"
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>

                {commands.length > 0 && (
                  <Command.Group heading="Actions" className="font-mono text-[10px] font-black uppercase text-gray-500 px-2 py-1 mt-2">
                    {commands.map((cmd) => {
                      const Icon = cmd.icon;
                      return (
                        <Command.Item
                          key={cmd.id}
                          value={cmd.title}
                          onSelect={() => handleCommand(cmd.action)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm font-mono font-bold text-black border-2 border-transparent data-[selected=true]:border-black data-[selected=true]:bg-lime data-[selected=true]:shadow-[2px_2px_0_0_#000] cursor-pointer text-left transition-all"
                        >
                          {Icon && <Icon className="h-4 w-4" />}
                          <span>{cmd.title}</span>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}
              </>
            )}

            {query && results.length > 0 && (
              <Command.Group heading="Results" className="font-mono text-[10px] font-black uppercase text-gray-500 px-2 py-1">
                {results.map((result) => (
                  <Command.Item
                    key={result.id}
                    value={result.label}
                    onSelect={() => handleSelect(result.path)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm font-mono font-bold text-black border-2 border-transparent data-[selected=true]:border-black data-[selected=true]:bg-lime data-[selected=true]:shadow-[2px_2px_0_0_#000] cursor-pointer text-left transition-all"
                  >
                    <span>{result.label}</span>
                    <span className="font-mono text-[10px] font-black uppercase text-gray-500 bg-white border border-black px-1">
                      {result.sublabel}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {!query && activePage === "clubs" && (
              <Command.Group heading="Popular Clubs" className="font-mono text-[10px] font-black uppercase text-gray-500 px-2 py-1">
                {fallbackClubs.map((club) => (
                  <Command.Item
                    key={club.id}
                    value={club.name}
                    onSelect={() => handleSelect(`/clubs/${club.slug}`)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm font-mono font-bold text-black border-2 border-transparent data-[selected=true]:border-black data-[selected=true]:bg-lime data-[selected=true]:shadow-[2px_2px_0_0_#000] cursor-pointer text-left transition-all"
                  >
                    <Compass className="h-4 w-4" />
                    <span>{club.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {!query && activePage === "events" && (
              <Command.Group heading="Recent Events" className="font-mono text-[10px] font-black uppercase text-gray-500 px-2 py-1">
                {fallbackEvents.map((evt) => (
                  <Command.Item
                    key={evt.id}
                    value={evt.title}
                    onSelect={() => handleSelect(`/events/${evt.id}`)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm font-mono font-bold text-black border-2 border-transparent data-[selected=true]:border-black data-[selected=true]:bg-lime data-[selected=true]:shadow-[2px_2px_0_0_#000] cursor-pointer text-left transition-all"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>{evt.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {!query && activePage === "users" && (
              <Command.Group heading="Recent Users" className="font-mono text-[10px] font-black uppercase text-gray-500 px-2 py-1">
                {fallbackUsers.map((user) => {
                  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
                  const displayName = name || `@${user.handle}`;
                  return (
                    <Command.Item
                      key={user.id}
                      value={displayName}
                      onSelect={() => handleSelect(`/profile/${user.handle}`)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm font-mono font-bold text-black border-2 border-transparent data-[selected=true]:border-black data-[selected=true]:bg-lime data-[selected=true]:shadow-[2px_2px_0_0_#000] cursor-pointer text-left transition-all"
                    >
                      <User className="h-4 w-4" />
                      <span>{displayName}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
