import { useState, useCallback, useMemo } from "react";
import { Tag } from "../components/MultiSelect/types";

export function useMultiSelect(initialSelected: Tag[] = []) {
  const [selectedTags, setSelectedTags] = useState<Tag[]>(initialSelected);

  const addTag = useCallback((tag: Tag) => {
    setSelectedTags((prev) => {
      if (prev.some((t) => t.value === tag.value)) {
        return prev;
      }
      return [...prev, tag];
    });
  }, []);

  const removeTag = useCallback((tag: Tag) => {
    setSelectedTags((prev) => prev.filter((t) => t.value !== tag.value));
  }, []);

  const clear = useCallback(() => {
    setSelectedTags([]);
  }, []);

  return {
    selectedTags,
    setSelectedTags,
    addTag,
    removeTag,
    clear,
  };
}
