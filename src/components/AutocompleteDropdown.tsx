import { useEffect, useRef, useState } from "react";
import { highlightMatch, HighlightSegment } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface AutocompleteResult {
  id: string;
  title: string;
  subtitle?: string;
  [key: string]: unknown;
}

interface AutocompleteDropdownProps {
  query: string;
  isOpen: boolean;
  isLoading: boolean;
  results: AutocompleteResult[];
  onSelect: (result: AutocompleteResult) => void;
  onClose: () => void;
}

export function AutocompleteDropdown({
  query,
  isOpen,
  isLoading,
  results,
  onSelect,
  onClose,
}: AutocompleteDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [results, query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (event.key === "Enter") {
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          event.preventDefault();
          onSelect(results[selectedIndex]);
        }
      } else if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, results, selectedIndex, onClose, onSelect]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="neu-border absolute left-0 top-full z-50 mt-1 max-h-80 w-full overflow-y-auto bg-white shadow-[4px_4px_0_0_#000000]"
    >
      {isLoading ? (
        <div className="flex items-center justify-center p-4 text-neutral-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : results.length > 0 ? (
        <ul className="flex flex-col py-1">
          {results.map((result, index) => {
            const isSelected = index === selectedIndex;
            return (
              <li
                key={result.id}
                onClick={() => onSelect(result)}
                className={`cursor-pointer px-4 py-2 hover:bg-cream ${
                  isSelected ? "bg-cream" : ""
                }`}
              >
                <div className="font-mono text-xs font-bold text-black">
                  {highlightMatch(result.title, query).map((segment, i) => (
                    <span
                      key={i}
                      className={segment.highlight ? "bg-yellow font-extrabold text-black" : ""}
                    >
                      {segment.text}
                    </span>
                  ))}
                </div>
                {result.subtitle && (
                  <div className="mt-0.5 font-mono text-[10px] text-neutral-500 line-clamp-1">
                    {highlightMatch(result.subtitle, query).map((segment, i) => (
                      <span
                        key={i}
                        className={segment.highlight ? "bg-yellow text-black font-extrabold" : ""}
                      >
                        {segment.text}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : query.trim().length > 0 ? (
        <div className="p-4 text-center font-mono text-xs text-neutral-500">
          No results found for "{query}"
        </div>
      ) : null}
    </div>
  );
}
