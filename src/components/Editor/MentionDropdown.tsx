import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface MentionSuggestion {
  id: string;
  handle: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface MentionDropdownProps {
  items: MentionSuggestion[];
  command: (item: { id: string; label: string }) => void;
}

export const MentionDropdown = forwardRef((props: MentionDropdownProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: item.handle });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }

      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }

      if (event.key === "Enter") {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  if (!props.items.length) {
    return (
      <div className="bg-background border rounded-lg shadow-md p-2 text-sm text-muted-foreground">
        No users found
      </div>
    );
  }

  return (
    <div className="bg-background border rounded-lg shadow-md overflow-hidden flex flex-col w-56">
      {props.items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className={`flex items-center gap-2 p-2 text-sm text-left transition-colors ${
            index === selectedIndex
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/50 text-foreground"
          }`}
          onClick={() => selectItem(index)}
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={item.avatar_url || ""} />
            <AvatarFallback>{item.handle.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col truncate">
            <span className="font-semibold truncate">{item.handle}</span>
            {item.full_name && (
              <span className="text-xs text-muted-foreground truncate">{item.full_name}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
});

MentionDropdown.displayName = "MentionDropdown";
