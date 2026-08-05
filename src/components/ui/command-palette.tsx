import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Compass, Home, Settings, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Calendar,
  Compass,
  Home,
  Search,
  Settings,
  ShieldAlert,
  User,
  Bookmark,
} from "lucide-react";
import { useCommandPalette } from "@/components/CommandPaletteProvider";

export interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface RecentEvent {
  id: string;
  title: string;
}

const NAV_ITEMS = [
  { label: "Home", path: "/", icon: Home },
  { label: "Calendar", path: "/calendar", icon: Calendar },
  { label: "Clubs", path: "/clubs", icon: Compass },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function CommandPalette({ open: externalOpen, onOpenChange }: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [recentEvents, setRecentEvents] = React.useState<RecentEvent[]>([]);
  const navigate = useNavigate();
  const { commands } = useCommandPalette();

  const isOpen = externalOpen ?? internalOpen;
  const setIsOpen = React.useCallback(
    (value: boolean) => {
      setInternalOpen(value);
      onOpenChange?.(value);
    },
    [onOpenChange],
  );

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

  React.useEffect(() => {
    if (!isOpen) return;
    const supabase = createClient();
    supabase
      .from("events")
      .select("id, title")
      .order("event_date", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setRecentEvents(data);
      });
  }, [isOpen]);

  const handleSelect = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleCommand = (action: () => void) => {
    setIsOpen(false);
    setQuery("");
    action();
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

  const normalizedQuery = query.trim().toLowerCase();

  const filteredItems = navigationItems.filter((item) =>
    item.label.toLowerCase().includes(normalizedQuery),
  );

  const filteredCommands = commands.filter((command) => {
    if (command.title.toLowerCase().includes(normalizedQuery)) return true;
    return (command.keywords || []).some((keyword) =>
      keyword.toLowerCase().includes(normalizedQuery),
    );
  });

  const hasResults = filteredItems.length > 0 || filteredCommands.length > 0;

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
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            autoFocus
          />
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-[300px] overflow-y-auto p-2">
          {!hasResults ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No results found.</div>
          ) : (
            <div className="space-y-1">
              {filteredCommands.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Actions
                  </div>
                  {filteredCommands.map((command) => {
                    const Icon = command.icon;
                    return (
                      <button
                        key={command.id}
                        onClick={() => handleCommand(command.action)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                      >
                        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                        <span>{command.title}</span>
                      </button>
                    );
                  })}
                </>
              )}

              {filteredItems.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Navigation
                  </div>
                  {filteredItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleSelect(item.path)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
