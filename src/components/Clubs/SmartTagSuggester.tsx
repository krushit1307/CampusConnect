import React, { useEffect, useState, useRef } from "react";
import { TaxonomyMapperModal } from "./TaxonomyMapperModal";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Plus from "lucide-react/dist/esm/icons/plus";
import X from "lucide-react/dist/esm/icons/x";
import { createClient } from "@/lib/supabase/client";

interface SmartTagSuggesterProps {
  missionText: string;
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export const SmartTagSuggester: React.FC<SmartTagSuggesterProps> = ({
  missionText,
  selectedTags,
  onChange,
}) => {
  const supabase = createClient();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [pendingTag, setPendingTag] = useState<string | null>(null);
  const [checkingTag, setCheckingTag] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounced tag recommendation fetch logic
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!missionText || missionText.trim().length < 15) {
      setSuggestions([]);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("suggest-club-tags", {
          body: { text: missionText },
        });

        if (!error && data?.tags) {
          // Filter out tags that are already selected
          const filtered = (data.tags as string[]).filter(
            (tag) => !selectedTags.some((selected) => selected.toLowerCase() === tag.toLowerCase()),
          );
          setSuggestions(filtered);
        }
      } catch (err) {
        console.error("Failed to fetch suggested tags:", err);
      } finally {
        setLoading(false);
      }
    }, 600); // 600ms debounce

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [missionText, selectedTags, supabase.functions]);

  const handleApplyTag = async (tag: string) => {
    const formatted = tag.trim();
    if (!formatted) return;

    if (!selectedTags.some((t) => t.toLowerCase() === formatted.toLowerCase())) {
      setCheckingTag(true);
      // Check if it exists in standard taxonomy or custom mappings
      const { data: stdData } = await supabase
        .from("standard_taxonomy")
        .select("id")
        .ilike("name", formatted)
        .maybeSingle();

      if (stdData) {
        commitTag(formatted);
        setCheckingTag(false);
        return;
      }

      const { data: mapData } = await supabase
        .from("custom_tag_mappings")
        .select("id")
        .ilike("custom_tag", formatted)
        .maybeSingle();

      setCheckingTag(false);

      if (mapData) {
        commitTag(formatted);
      } else {
        setPendingTag(formatted);
      }
    }
  };

  const commitTag = (formatted: string) => {
    onChange([...selectedTags, formatted]);
    setSuggestions((prev) => prev.filter((t) => t.toLowerCase() !== formatted.toLowerCase()));
    setPendingTag(null);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(selectedTags.filter((t) => t !== tagToRemove));
  };

  const handleAddCustomTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const tag = newTagInput.trim();
      if (tag) {
        handleApplyTag(tag);
        setNewTagInput("");
      }
    }
  };

  return (
    <div className="space-y-4 rounded-lg border-2 border-black bg-cream p-4">
      <div>
        <label className="block font-mono text-xs font-bold uppercase text-black mb-1">
          Club Search Tags
        </label>
        <p className="font-mono text-[10px] text-gray-500 mb-2">
          Help students discover your club by applying relevant tags. Press Enter to add custom
          tags.
        </p>

        {/* Selected Tags list */}
        <div className="flex flex-wrap gap-1.5 min-h-8 mb-3">
          {selectedTags.length > 0 ? (
            selectedTags.map((tag) => (
              <span
                key={tag}
                className="neu-border bg-lime/30 px-2 py-0.5 font-mono text-[11px] font-bold text-black flex items-center gap-1"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-red-600 transition-colors cursor-pointer"
                  title="Remove tag"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          ) : (
            <span className="font-mono text-xs text-gray-400 italic">No tags selected yet</span>
          )}
        </div>

        {/* Manual tag entry */}
        <div className="flex max-w-xs items-center gap-2">
          <input
            type="text"
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            onKeyDown={handleAddCustomTag}
            placeholder="Add custom tag..."
            className="w-full neu-border bg-white px-2 py-1 font-mono text-xs text-black"
          />
          <button
            type="button"
            onClick={() => {
              if (newTagInput.trim()) {
                handleApplyTag(newTagInput.trim());
                setNewTagInput("");
              }
            }}
            className="neu-border bg-black text-white px-2 py-1 font-mono text-xs font-bold uppercase flex items-center gap-0.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* Suggested Tags cloud */}
      {(loading || suggestions.length > 0) && (
        <div className="border-t-2 border-dashed border-black pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-black" />
            <span className="font-mono text-[11px] font-bold uppercase text-black">
              Suggested Tags
            </span>
            {loading && (
              <span className="font-mono text-[9px] text-gray-500 animate-pulse">
                (analyzing...)
              </span>
            )}
          </div>

          {!loading && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleApplyTag(tag)}
                  className="neu-border hover:bg-black/5 bg-white px-2.5 py-0.5 font-mono text-[11px] font-bold text-black transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-2.5 w-2.5" />
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {pendingTag && (
        <TaxonomyMapperModal
          customTag={pendingTag}
          onMap={() => commitTag(pendingTag)}
          onCancel={() => setPendingTag(null)}
        />
      )}
    </div>
  );
};
