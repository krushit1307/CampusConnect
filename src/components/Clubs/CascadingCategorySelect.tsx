import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClubCategories } from "@/hooks/useClubCategories";
import { getChildCategories, type ClubCategory } from "@/lib/clubCategories";

const LEVEL_PLACEHOLDERS = ["Select a category", "Select a subcategory", "Select a specialty"];

export interface CascadingCategorySelectProps {
  /** The deepest selected category id (what actually gets submitted). */
  value: string | null | undefined;
  onChange: (categoryId: string | null) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Renders a chain of <Select> dropdowns, one per level of the club category
 * tree (Academic -> Engineering -> Robotics). Each level is disabled until
 * its parent has a selection, and the form value is always the id of the
 * deepest category the user has chosen.
 *
 * On mount with an existing `value` (edit flow), it reverse-engineers the
 * ancestor chain from that leaf id so every level opens pre-populated.
 */
export function CascadingCategorySelect({
  value,
  onChange,
  disabled,
  className,
}: CascadingCategorySelectProps) {
  const { categories, childrenMap, getPath, isLoading, error } = useClubCategories();

  // selections[i] = the chosen category id at level i (0 = root level)
  const [selections, setSelections] = useState<(string | null)[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Reverse-engineer the path once categories are loaded, so editing an
  // existing club pre-populates and opens every dropdown level correctly.
  useEffect(() => {
    if (hydrated || isLoading) return;
    if (!value) {
      setHydrated(true);
      return;
    }
    const path = getPath(value);
    if (path.length > 0) {
      setSelections(path.map((c) => c.id));
    }
    setHydrated(true);
  }, [isLoading, value, hydrated]);

  // Total number of levels the tree actually has (e.g. 3 for
  // Academic -> Engineering -> Robotics), derived from the loaded data so
  // the component isn't hard-coded to a fixed depth.
  const totalLevels = useMemo(
    () => (categories.length > 0 ? Math.max(...categories.map((c) => c.depth)) + 1 : 1),
    [categories],
  );

  // One entry per level of the tree. Dropdown 1 always shows the root
  // options; dropdown N is disabled (and empty) until dropdown N-1 has a
  // selection whose children have loaded. A level is dropped entirely only
  // once its parent turns out to be a leaf with no children at all.
  const levels = useMemo(() => {
    const result: { parentId: string | null; options: ClubCategory[]; enabled: boolean }[] = [];

    for (let i = 0; i < totalLevels; i++) {
      const parentId = i === 0 ? null : (selections[i - 1] ?? undefined);
      const parentSelected = i === 0 || parentId !== undefined;
      const options = parentSelected ? getChildCategories(childrenMap, parentId ?? null) : [];

      // Parent is selected but has no children at all -> it's a leaf,
      // nothing further to show.
      if (parentSelected && parentId !== null && options.length === 0) break;

      result.push({ parentId: parentId ?? null, options, enabled: parentSelected });
    }

    return result;
  }, [childrenMap, selections, totalLevels]);

  const handleSelect = (levelIndex: number, categoryId: string) => {
    const next = selections.slice(0, levelIndex);
    next.push(categoryId);
    setSelections(next);
    // The deepest (last) selection is the value the form actually submits.
    onChange(categoryId);
  };

  if (error) {
    return (
      <p className="text-sm text-red-500" role="alert">
        Couldn&apos;t load club categories. Please try again.
      </p>
    );
  }

  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:items-start ${className ?? ""}`}>
      {levels.map((level, i) => {
        const placeholder = LEVEL_PLACEHOLDERS[i] ?? "Select an option";
        const isDisabled = disabled || isLoading || !level.enabled;
        return (
          <Select
            key={`level-${i}-${level.parentId ?? "root"}`}
            value={selections[i] ?? undefined}
            onValueChange={(categoryId) => handleSelect(i, categoryId)}
            disabled={isDisabled}
          >
            <SelectTrigger aria-label={placeholder} className="sm:flex-1">
              <SelectValue placeholder={isLoading ? "Loading..." : placeholder} />
            </SelectTrigger>
            <SelectContent>
              {level.options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
    </div>
  );
}
