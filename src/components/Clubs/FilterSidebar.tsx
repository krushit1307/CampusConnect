import React, { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export const TAGS_SEARCH_PARAM = "tags";

interface FilterSidebarProps {
  availableTags: string[];
}

const parseTags = (searchParams: URLSearchParams): string[] =>
  (searchParams.get(TAGS_SEARCH_PARAM) ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

/**
 * FilterSidebar
 *
 * Renders a list of tag checkboxes whose checked state is derived strictly from
 * the URL `tags` search parameter (never local state). Toggling a checkbox
 * writes the new comma-separated tag list back to the URL with `replace: true`
 * so rapid clicks do not bloat the browser history stack.
 */
export const FilterSidebar: React.FC<FilterSidebarProps> = ({ availableTags }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTags = useMemo(() => {
    const requested = parseTags(searchParams);
    if (requested.length === 0) return [];
    return availableTags.filter((tag) =>
      requested.some((value) => value.toLowerCase() === tag.toLowerCase()),
    );
  }, [searchParams, availableTags]);

  const toggleTag = useCallback(
    (tag: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const current = parseTags(next);
          const alreadySelected = current.some(
            (value) => value.toLowerCase() === tag.toLowerCase(),
          );
          const updated = alreadySelected
            ? current.filter((value) => value.toLowerCase() !== tag.toLowerCase())
            : [...current, tag];

          if (updated.length > 0) {
            next.set(TAGS_SEARCH_PARAM, updated.join(","));
          } else {
            next.delete(TAGS_SEARCH_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const clearAll = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(TAGS_SEARCH_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  if (availableTags.length === 0) {
    return null;
  }

  return (
    <aside
      aria-label="Filter clubs by tags"
      className="neu-border h-fit w-full shrink-0 bg-cream p-4 shadow-[4px_4px_0_0_#000] lg:w-56"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700">
          Filter by Tags
        </h2>
        {activeTags.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="font-mono text-[10px] font-bold uppercase text-gray-500 underline hover:text-black"
          >
            Clear
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {availableTags.map((tag) => {
          const isChecked = activeTags.includes(tag);
          return (
            <li key={tag}>
              <label
                className={`flex cursor-pointer items-center gap-2 border-2 px-2 py-1.5 font-mono text-xs transition-colors ${
                  isChecked
                    ? "border-black bg-lime-200 text-black"
                    : "border-gray-300 bg-white text-gray-600 hover:border-black hover:bg-yellow-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleTag(tag)}
                  aria-label={`Filter by tag ${tag}`}
                  className="h-4 w-4 accent-black"
                />
                <span className="uppercase">{tag}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default FilterSidebar;
