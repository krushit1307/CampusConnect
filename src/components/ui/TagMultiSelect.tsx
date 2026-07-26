import * as React from "react";
import { X, Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const DEFAULT_EVENT_TAGS = [
  "Tech",
  "Career",
  "Food",
  "Workshop",
  "Social",
  "Design",
  "Gaming",
  "Music",
  "Sports",
  "Networking",
  "AI/ML",
  "Hackathon",
  "Arts",
  "Academic",
];

export interface TagMultiSelectProps {
  value?: string[];
  onChange?: (tags: string[]) => void;
  options?: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowCustomTags?: boolean;
}

export function TagMultiSelect({
  value = [],
  onChange,
  options = DEFAULT_EVENT_TAGS,
  placeholder = "Select or type tags...",
  className,
  disabled = false,
  allowCustomTags = true,
}: TagMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Filter available options based on input
  const filteredOptions = React.useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    return options.filter(
      (option) => !value.includes(option) && (query === "" || option.toLowerCase().includes(query)),
    );
  }, [options, value, inputValue]);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (tag: string) => {
    const trimmed = tag.trim().replace(/^#/, "");
    if (!trimmed) return;
    if (!value.includes(trimmed)) {
      const updated = [...value, trimmed];
      onChange?.(updated);
    }
    setInputValue("");
  };

  const handleRemove = (tagToRemove: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = value.filter((t) => t !== tagToRemove);
    onChange?.(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      handleRemove(value[value.length - 1]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const query = inputValue.trim();
      if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0]);
      } else if (allowCustomTags && query !== "") {
        handleSelect(query);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown" && !open) {
      setOpen(true);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={cn(
          "neu-border flex min-h-[42px] w-full flex-wrap items-center gap-1.5 bg-white p-2 text-sm cursor-text transition-all focus-within:ring-2 focus-within:ring-black",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {value.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="neu-border bg-peach text-black flex items-center gap-1 font-mono text-xs font-bold px-2 py-0.5"
          >
            #{tag.replace(/^#/, "")}
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => handleRemove(tag, e)}
              aria-label={`Remove tag ${tag}`}
              className="ml-0.5 rounded-full hover:bg-black/10 p-0.5 transition-colors focus:outline-none"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          disabled={disabled}
          className="flex-1 min-w-[120px] border-none bg-transparent font-mono text-xs text-black placeholder:text-gray-400 focus:outline-none"
        />

        <div className="ml-auto flex items-center shrink-0">
          <ChevronsUpDown className="h-4 w-4 text-gray-400" />
        </div>
      </div>

      {open && !disabled && (
        <div className="neu-border absolute z-50 mt-1 max-h-60 w-full overflow-auto bg-white p-1 shadow-lg">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  handleSelect(option);
                  setOpen(true);
                  inputRef.current?.focus();
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left font-mono text-xs hover:bg-lime transition-colors"
              >
                <span>#{option.replace(/^#/, "")}</span>
                {value.includes(option) && <Check className="h-4 w-4" />}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 font-mono text-xs text-gray-500">
              {inputValue.trim() !== "" && allowCustomTags ? (
                <button
                  type="button"
                  onClick={() => {
                    handleSelect(inputValue.trim());
                    setOpen(true);
                    inputRef.current?.focus();
                  }}
                  className="flex w-full items-center gap-1.5 font-bold text-violet-900 hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Add custom tag "#
                  {inputValue.trim().replace(/^#/, "")}"
                </button>
              ) : (
                "No matching tags found."
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
