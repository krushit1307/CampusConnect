// =============================================================================
// Component: EventMenuSection
// Issue: #3341 - Build an 'Interactive Food Menu with Allergen Filters'
// Description: Public-facing menu section on the event page. Renders each
// dish as a card with allergen badges, and lets attendees instantly filter
// by dietary need (e.g. "Nut-Free" hides any dish with contains_nuts=true).
// =============================================================================

import { useMemo, useState } from "react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { UtensilsCrossed, Leaf, WheatOff, NutOff, MilkOff } from "lucide-react";
import { ManageEventMenu } from "@/components/events/ManageEventMenu";
import { DietaryMacroNutrientWidget } from "@/components/events/DietaryMacroNutrientWidget";


interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  is_vegan: boolean;
  is_gluten_free: boolean;
  contains_nuts: boolean;
  contains_dairy: boolean;
}

type FilterKey = "vegan" | "gluten_free" | "nut_free" | "dairy_free";

const FILTERS: { key: FilterKey; label: string; icon: typeof Leaf }[] = [
  { key: "vegan", label: "Show Vegan", icon: Leaf },
  { key: "gluten_free", label: "Gluten-Free", icon: WheatOff },
  { key: "nut_free", label: "Nut-Free", icon: NutOff },
  { key: "dairy_free", label: "Dairy-Free", icon: MilkOff },
];

function matchesFilters(item: MenuItem, active: Set<FilterKey>) {
  if (active.has("vegan") && !item.is_vegan) return false;
  if (active.has("gluten_free") && !item.is_gluten_free) return false;
  if (active.has("nut_free") && item.contains_nuts) return false;
  if (active.has("dairy_free") && item.contains_dairy) return false;
  return true;
}

export function EventMenuSection({
  eventId,
  isOrganizer,
}: {
  eventId: string;
  isOrganizer?: boolean;
}) {
  const supabase = createClient();
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());

  const { data: items = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["event_menu_items", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_menu_items")
        .select("id, name, description, is_vegan, is_gluten_free, contains_nuts, contains_dairy")
        .eq("event_id", eventId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const toggleFilter = (key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleItems = useMemo(
    () => items.filter((item) => matchesFilters(item, activeFilters)),
    [items, activeFilters],
  );

  if (isLoading) return null;
  if (items.length === 0 && !isOrganizer) return null;

  return (
    <div className="border-t border-black/10 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <UtensilsCrossed size={20} />
        <h2 className="font-display text-2xl font-black uppercase tracking-tight text-black">
          Menu
        </h2>
      </div>

      {items.length > 0 && (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {FILTERS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleFilter(key)}
                aria-pressed={activeFilters.has(key)}
                className={`neu-border flex items-center gap-2 px-3 py-2 font-mono text-xs font-bold uppercase transition-all ${
                  activeFilters.has(key)
                    ? "bg-black text-white"
                    : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {visibleItems.length === 0 ? (
            <p className="font-mono text-sm text-black/50 italic">
              No dishes match the selected filters.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {visibleItems.map((item) => (
                <div key={item.id} className="neu-border bg-white p-4">
                  <h3 className="font-display text-lg font-bold">{item.name}</h3>
                  {item.description && (
                    <p className="mt-1 font-mono text-sm text-black/70">{item.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.is_vegan && (
                      <span className="neu-border bg-lime px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                        Vegan
                      </span>
                    )}
                    {item.is_gluten_free && (
                      <span className="neu-border bg-cream px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                        Gluten-Free
                      </span>
                    )}
                    {item.contains_nuts && (
                      <span className="neu-border bg-peach px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                        Contains Nuts
                      </span>
                    )}
                    {item.contains_dairy && (
                      <span className="neu-border bg-peach px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                        Contains Dairy
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Interactive Dietary Restriction Macro-Nutrient Analyzer */}
      <div className="mt-8">
        <DietaryMacroNutrientWidget />
      </div>

      {isOrganizer && (
        <div className="mt-8 border-t-2 border-black pt-6">

          <ManageEventMenu eventId={eventId} />
        </div>
      )}
    </div>
  );
}