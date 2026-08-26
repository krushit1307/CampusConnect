import { useEffect, useRef, useState, KeyboardEvent, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  full_name: string | null;
  handle: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionSelect?: (handle: string) => void;
  placeholder?: string;
  clubId?: string;
  className?: string;
  textareaProps?: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
}

export function MentionInput({
  value,
  onChange,
  onMentionSelect,
  placeholder = "Type @ to mention someone...",
  clubId,
  className = "",
  textareaProps = {},
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const [suggestionsPosition, setSuggestionsPosition] = useState({ top: 0, left: 0 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Fetch club members when @ is typed
  const fetchClubMembers = useCallback(
    async (query: string) => {
      if (!clubId) return [];

      const { data, error } = await supabase
        .from("club_members")
        .select("profiles!inner(id, full_name, handle)")
        .eq("club_id", clubId)
        .eq("status", "approved");

      if (error || !data) return [];

      const profiles = data
        .map((member) => member.profiles as unknown as Profile)
        .filter((profile): profile is Profile => profile !== null && profile.handle !== null);

      // Filter by query if provided
      if (query) {
        const lowerQuery = query.toLowerCase();
        return profiles.filter(
          (p) =>
            p.handle?.toLowerCase().includes(lowerQuery) ||
            p.full_name?.toLowerCase().includes(lowerQuery),
        );
      }

      return profiles;
    },
    [clubId, supabase],
  );

  // Handle text changes and detect @ mentions
  const handleTextChange = async (text: string) => {
    onChange(text);

    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);

    // Find the last @ before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    // Check if we're in a mention context
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

      // Only show suggestions if there's no space after @
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setMentionQuery(textAfterAt);
        setMentionStartPos(lastAtIndex);

        // Calculate position for suggestions dropdown
        const coords = getCaretCoordinates(textarea, lastAtIndex);
        setSuggestionsPosition({
          top: coords.top + 20,
          left: coords.left,
        });

        // Fetch matching members
        const members = await fetchClubMembers(textAfterAt);
        setSuggestions(members);
        setShowSuggestions(members.length > 0);
        setSelectedIndex(0);
        return;
      }
    }

    setShowSuggestions(false);
  };

  // Get caret coordinates for positioning dropdown
  function getCaretCoordinates(
    element: HTMLTextAreaElement,
    position: number,
  ): { top: number; left: number } {
    const div = document.createElement("div");
    const style = getComputedStyle(element);
    const properties = [
      "boxSizing",
      "width",
      "height",
      "overflowX",
      "overflowY",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "fontStyle",
      "fontVariant",
      "fontWeight",
      "fontStretch",
      "fontSize",
      "lineHeight",
      "fontFamily",
      "textAlign",
      "textTransform",
      "textIndent",
      "textDecoration",
      "letterSpacing",
      "wordSpacing",
    ];

    properties.forEach((prop) => {
      div.style.setProperty(prop, style.getPropertyValue(prop));
    });

    div.style.position = "absolute";
    div.style.visibility = "hidden";
    div.style.whiteSpace = "pre-wrap";
    div.style.wordWrap = "break-word";

    div.textContent = element.value.substring(0, position);
    document.body.appendChild(div);

    const span = document.createElement("span");
    span.textContent = element.value.substring(position) || ".";
    div.appendChild(span);

    const rect = element.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();

    document.body.removeChild(div);

    return {
      top: spanRect.top - rect.top,
      left: spanRect.left - rect.left,
    };
  }

  // Handle mention selection
  const selectMention = (profile: Profile) => {
    if (!textareaRef.current || mentionStartPos === null) return;

    const beforeMention = value.slice(0, mentionStartPos);
    const afterMention = value.slice(textareaRef.current.selectionStart);
    const mentionText = `@${profile.handle}`;

    const newValue = `${beforeMention}${mentionText} ${afterMention}`;
    onChange(newValue);

    // Move cursor after the mention
    const newCursorPos = mentionStartPos + mentionText.length + 1;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);

    setShowSuggestions(false);
    setMentionStartPos(null);

    if (onMentionSelect && profile.handle) {
      onMentionSelect(profile.handle);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case "Enter":
      case "Tab":
        if (suggestions.length > 0) {
          e.preventDefault();
          selectMention(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowSuggestions(false);
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (showSuggestions && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.querySelector(
        `[data-index="${selectedIndex}"]`,
      );
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, showSuggestions]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => handleTextChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        {...textareaProps}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="neu-border absolute z-50 max-h-60 w-64 overflow-y-auto bg-white shadow-lg"
          style={{
            top: `${suggestionsPosition.top}px`,
            left: `${suggestionsPosition.left}px`,
          }}
          role="listbox"
          aria-label="Mention suggestions"
        >
          {suggestions.map((profile, index) => (
            <button
              key={profile.id}
              type="button"
              data-index={index}
              onClick={() => selectMention(profile)}
              className={`flex w-full items-center gap-2 border-b border-black p-3 text-left transition-colors hover:bg-lime ${
                index === selectedIndex ? "bg-cream" : ""
              }`}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <div className="flex-1">
                <div className="font-mono text-sm font-bold">{profile.full_name}</div>
                <div className="font-mono text-xs text-gray-600">@{profile.handle}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
