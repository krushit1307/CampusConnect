import React, { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import Filter from "lucide-react/dist/esm/icons/filter";
import X from "lucide-react/dist/esm/icons/x";
import SlidersHorizontal from "lucide-react/dist/esm/icons/sliders-horizontal";
import { createClient } from "@/lib/supabase/client";
import { BottomSheet } from "@/components/ui/bottom-sheet";

export interface FilterState {
  dateRange: "all" | "this-week" | "next-month";
  categories: string[];
  openCapacityOnly: boolean;
}

interface EventFiltersProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

export function EventFilterFields({ filters, setFilters }: EventFiltersProps) {
  const [availableCategories, setAvailableCategories] = useState<{ id: string; name: string }[]>(
    [],
  );

  useEffect(() => {
    const fetchCategories = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("event_categories").select("id, name").order("name");
      if (data) {
        setAvailableCategories(data);
      }
    };
    fetchCategories();
  }, []);

  const handleCategoryChange = (categoryName: string, checked: boolean) => {
    setFilters((prev) => ({
      ...prev,
      categories: checked
        ? [...prev.categories, categoryName]
        : prev.categories.filter((c) => c !== categoryName),
    }));
  };

  return (
    <div className="space-y-6 font-mono text-black">
      <div>
        <label className="text-xs font-bold uppercase tracking-wider block mb-2">Date Range</label>
        <Select
          value={filters.dateRange}
          onValueChange={(val: "all" | "this-week" | "next-month") =>
            setFilters((prev) => ({ ...prev, dateRange: val }))
          }
        >
          <SelectTrigger className="neu-border bg-white rounded-none w-full">
            <SelectValue placeholder="Select Date Range" />
          </SelectTrigger>
          <SelectContent className="neu-border rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white z-[100]">
            <SelectItem value="all">Any Date</SelectItem>
            <SelectItem value="this-week">This Week</SelectItem>
            <SelectItem value="next-month">Next Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider block mb-2">Categories</label>
        <div className="flex flex-col gap-3">
          {availableCategories.map((category) => (
            <div key={category.id} className="flex items-center space-x-2">
              <Checkbox
                id={`cat-${category.id}`}
                className="neu-border rounded-none border-black accent-black data-[state=checked]:bg-black data-[state=checked]:text-cream"
                checked={filters.categories.includes(category.name)}
                onCheckedChange={(checked) =>
                  handleCategoryChange(category.name, checked as boolean)
                }
              />
              <label
                htmlFor={`cat-${category.id}`}
                className="text-sm cursor-pointer hover:underline"
              >
                {category.name}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider block mb-2">
          Availability
        </label>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="open-capacity"
            className="neu-border rounded-none border-black accent-black data-[state=checked]:bg-black data-[state=checked]:text-cream"
            checked={filters.openCapacityOnly}
            onCheckedChange={(checked) =>
              setFilters((prev) => ({ ...prev, openCapacityOnly: checked as boolean }))
            }
          />
          <label htmlFor="open-capacity" className="text-sm cursor-pointer hover:underline">
            Open Capacity Only
          </label>
        </div>
      </div>
    </div>
  );
}

export function EventFilters({ filters, setFilters }: EventFiltersProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const clearFilters = () => {
    setFilters({ dateRange: "all", categories: [], openCapacityOnly: false });
  };

  const hasActiveFilters =
    filters.dateRange !== "all" || filters.categories.length > 0 || filters.openCapacityOnly;

  return (
    <>
      {/* Mobile BottomSheet Filter Drawer Trigger Button */}
      <div className="md:hidden p-3 border-b-2 border-black bg-cream flex items-center justify-between">
        <Button
          onClick={() => setIsMobileOpen(true)}
          className="neu-border bg-lime text-black hover:bg-lime/90 font-mono font-bold text-xs uppercase flex items-center gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
          {hasActiveFilters && (
            <span className="ml-1 rounded-full bg-black text-white px-1.5 py-0.5 text-[10px]">
              Active
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="font-mono text-xs hover:bg-cream"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Mobile BottomSheet Drawer using vaul with snap points */}
      {isMobileOpen && (
        <BottomSheet
          isOpen={isMobileOpen}
          onClose={() => setIsMobileOpen(false)}
          title="Event Filters"
          description="Filter events by date range, categories, or seat availability"
          snapPoints={[0.6, 1]}
          showHandle={true}
        >
          <div className="space-y-6 pb-6">
            <EventFilterFields filters={filters} setFilters={setFilters} />
            <div className="pt-4 border-t border-gray-200 flex items-center justify-between gap-3">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="font-mono text-xs neu-border"
                >
                  Clear Filters
                </Button>
              )}
              <Button
                onClick={() => setIsMobileOpen(false)}
                className="neu-border bg-black text-white hover:bg-gray-800 font-mono text-xs font-bold uppercase flex-1"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Desktop Sidebar Filters */}
      <Sidebar
        variant="sidebar"
        collapsible="offcanvas"
        className="hidden md:flex shrink-0 w-64 border-r-2 border-black"
      >
        <SidebarHeader className="border-b-2 border-black p-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2 font-mono font-bold uppercase text-sm">
            <Filter className="h-4 w-4" /> Filters
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-auto p-1 font-mono text-xs hover:bg-cream"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </SidebarHeader>

        <SidebarContent className="p-4 gap-6 font-mono">
          <SidebarGroup>
            <SidebarGroupContent>
              <EventFilterFields filters={filters} setFilters={setFilters} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </>
  );
}
