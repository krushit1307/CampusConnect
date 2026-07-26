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
import { Filter, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface FilterState {
  dateRange: "all" | "this-week" | "next-month";
  categories: string[];
  openCapacityOnly: boolean;
}

interface EventFiltersProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

export function EventFilters({ filters, setFilters }: EventFiltersProps) {
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

  const clearFilters = () => {
    setFilters({ dateRange: "all", categories: [], openCapacityOnly: false });
  };

  const hasActiveFilters =
    filters.dateRange !== "all" || filters.categories.length > 0 || filters.openCapacityOnly;

  return (
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
          <SidebarGroupLabel className="text-black font-bold uppercase mb-2">
            Date Range
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <Select
              value={filters.dateRange}
              onValueChange={(val: "all" | "this-week" | "next-month") =>
                setFilters((prev) => ({ ...prev, dateRange: val }))
              }
            >
              <SelectTrigger className="neu-border bg-white rounded-none">
                <SelectValue placeholder="Select Date Range" />
              </SelectTrigger>
              <SelectContent className="neu-border rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                <SelectItem value="all">Any Date</SelectItem>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="next-month">Next Month</SelectItem>
              </SelectContent>
            </Select>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-black font-bold uppercase mb-2">
            Categories
          </SidebarGroupLabel>
          <SidebarGroupContent className="flex flex-col gap-3">
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
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-black font-bold uppercase mb-2">
            Availability
          </SidebarGroupLabel>
          <SidebarGroupContent>
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
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
