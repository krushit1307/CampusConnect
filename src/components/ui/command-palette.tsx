import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import { Search, Calendar, Users, Settings, User, Bookmark, Home } from "lucide-react";

export const CommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  // Global Cmd+K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global Command Menu"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-white/20 bg-white/70 dark:bg-gray-900/80 p-2 shadow-2xl backdrop-blur-xl dark:border-gray-800/50">
        <div className="flex items-center border-b border-gray-200/50 dark:border-gray-800/50 px-3 pb-2 pt-1">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command or search clubs, events..."
            className="flex h-10 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-gray-500 dark:placeholder:text-gray-400"
          />
        </div>

        <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
          <Command.Empty className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No results found.
          </Command.Empty>

          <Command.Group
            heading="Navigation"
            className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400"
          >
            <Command.Item
              onSelect={() => runCommand(() => navigate("/"))}
              className="flex cursor-pointer items-center rounded-lg px-2 py-2 text-sm hover:bg-gray-100/80 dark:hover:bg-gray-800/80 data-[selected=true]:bg-blue-600 data-[selected=true]:text-white"
            >
              <Home className="mr-2 h-4 w-4" />
              <span>Home</span>
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => navigate("/clubs"))}
              className="flex cursor-pointer items-center rounded-lg px-2 py-2 text-sm hover:bg-gray-100/80 dark:hover:bg-gray-800/80 data-[selected=true]:bg-blue-600 data-[selected=true]:text-white"
            >
              <Users className="mr-2 h-4 w-4" />
              <span>Browse Clubs</span>
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => navigate("/events"))}
              className="flex cursor-pointer items-center rounded-lg px-2 py-2 text-sm hover:bg-gray-100/80 dark:hover:bg-gray-800/80 data-[selected=true]:bg-blue-600 data-[selected=true]:text-white"
            >
              <Calendar className="mr-2 h-4 w-4" />
              <span>Upcoming Events</span>
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => navigate("/bookmarks"))}
              className="flex cursor-pointer items-center rounded-lg px-2 py-2 text-sm hover:bg-gray-100/80 dark:hover:bg-gray-800/80 data-[selected=true]:bg-blue-600 data-[selected=true]:text-white"
            >
              <Bookmark className="mr-2 h-4 w-4" />
              <span>Saved Bookmarks</span>
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading="Account & Settings"
            className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400"
          >
            <Command.Item
              onSelect={() => runCommand(() => navigate("/profile"))}
              className="flex cursor-pointer items-center rounded-lg px-2 py-2 text-sm hover:bg-gray-100/80 dark:hover:bg-gray-800/80 data-[selected=true]:bg-blue-600 data-[selected=true]:text-white"
            >
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => navigate("/settings"))}
              className="flex cursor-pointer items-center rounded-lg px-2 py-2 text-sm hover:bg-gray-100/80 dark:hover:bg-gray-800/80 data-[selected=true]:bg-blue-600 data-[selected=true]:text-white"
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Command.Item>
          </Command.Group>
        </Command.List>
      </div>
    </Command.Dialog>
  );
};
