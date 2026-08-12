import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Search from "lucide-react/dist/esm/icons/search";
import SlidersHorizontal from "lucide-react/dist/esm/icons/sliders-horizontal";
import CheckCheck from "lucide-react/dist/esm/icons/check-check";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import X from "lucide-react/dist/esm/icons/x";

export type NotificationCategory = "all" | "unread" | "event" | "club" | "reply" | "security";

interface NotificationFilterToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeCategory: NotificationCategory;
  onCategoryChange: (category: NotificationCategory) => void;
  unreadCount: number;
  onMarkAllRead: () => void;
  onOpenPreferences: () => void;
}

export const NotificationFilterToolbar: React.FC<NotificationFilterToolbarProps> = ({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  unreadCount,
  onMarkAllRead,
  onOpenPreferences,
}) => {
  const categories: { id: NotificationCategory; label: string; count?: number }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread", count: unreadCount },
    { id: "event", label: "Events" },
    { id: "club", label: "Clubs" },
    { id: "reply", label: "Mentions" },
    { id: "security", label: "Security" },
  ];

  return (
    <div className="space-y-4 p-4 border-2 border-black bg-cream shadow-[4px_4px_0_0_var(--color-ink)]">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="text"
            placeholder="Filter notifications..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-8 border-2 border-black font-mono text-xs bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-2.5 text-gray-500 hover:text-black cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={onMarkAllRead}
              className="border-2 border-black bg-lime hover:bg-lime/80 font-mono text-xs uppercase font-bold shrink-0 shadow-[2px_2px_0_0_var(--color-ink)]"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark All Read ({unreadCount})
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={onOpenPreferences}
            className="border-2 border-black bg-white hover:bg-yellow-200 font-mono text-xs uppercase font-bold shrink-0 shadow-[2px_2px_0_0_var(--color-ink)]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1" /> Preferences
          </Button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoryChange(cat.id)}
            className={`px-3 py-1.5 border-2 border-black font-mono text-xs font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
              activeCategory === cat.id
                ? "bg-black text-cream shadow-[2px_2px_0_0_var(--color-ink)]"
                : "bg-white text-black hover:bg-yellow-100"
            }`}
          >
            {cat.label}
            {cat.count !== undefined && cat.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[10px]">
                {cat.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
