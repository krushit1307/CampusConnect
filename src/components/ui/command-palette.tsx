import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Compass, Home, Settings, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./command";

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

  return (
    <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
            <CommandItem key={path} value={label} onSelect={() => handleSelect(path)}>
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
        {recentEvents.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent Events">
              {recentEvents.map((event) => (
                <CommandItem
                  key={event.id}
                  value={event.title}
                  onSelect={() => handleSelect(`/events/${event.id}`)}
                >
                  <Zap className="mr-2 h-4 w-4" />
                  {event.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
