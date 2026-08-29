import React, { useState } from "react";
import { useFormContext } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import X from "lucide-react/dist/esm/icons/x";

export const EventTagInput: React.FC = () => {
  const { watch, setValue } = useFormContext();
  const tags: string[] = watch("tags") || [];
  const [inputValue, setInputValue] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const supabase = createClient();

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      
      const rawTag = inputValue.trim().replace(/^#/, ""); // Strip '#' if they typed it
      if (!rawTag) return;

      setIsChecking(true);
      
      try {
        // Query the DB for a synonym match
        const { data, error } = await supabase
          .from("tag_synonyms")
          .select("canonical_tag")
          .ilike("variant_tag", rawTag)
          .maybeSingle();

        if (error) throw error;

        let finalTag = rawTag;

        // If a canonical mapping exists, swap it and notify the user
        if (data && data.canonical_tag) {
          finalTag = data.canonical_tag;
          toast.info(
            `"#${rawTag}" has been merged into our primary tag "#${finalTag}" to improve discoverability.`,
            { duration: 5000 }
          );
        }

        // Prevent duplicates
        if (!tags.includes(finalTag)) {
          setValue("tags", [...tags, finalTag], {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
        
        setInputValue("");
      } catch (err) {
        console.error("Error checking tag synonyms:", err);
        // Fallback: just add the raw tag if DB fails
        if (!tags.includes(rawTag)) {
          setValue("tags", [...tags, rawTag]);
        }
        setInputValue("");
      } finally {
        setIsChecking(false);
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    setValue(
      "tags",
      tags.filter((t) => t !== tagToRemove),
      { shouldValidate: true, shouldDirty: true }
    );
  };

  return (
    <div className="space-y-3">
      <Label htmlFor="event-tags">Event Tags</Label>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium"
          >
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
            >
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
      <Input
        id="event-tags"
        placeholder="Type a tag (e.g. Cloud) and press Enter..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isChecking}
        className={isChecking ? "opacity-70" : ""}
      />
      <p className="text-xs text-gray-500">
        Press Enter or comma to add a tag. Our system automatically optimizes tags for maximum discoverability.
      </p>
    </div>
  );
};
