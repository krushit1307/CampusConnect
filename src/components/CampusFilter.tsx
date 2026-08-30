import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CampusFilterProps {
  campuses: string[];
  selectedCampus: string;
  onCampusChange: (campus: string) => void;
  placeholder?: string;
  className?: string;
  includeAllOption?: boolean;
  allOptionLabel?: string;
}

/**
 * CampusFilter component that sorts the cities/campuses dropdown alphabetically.
 * Issue: #3846 - Sort the Cities/Campuses dropdown alphabetically
 */
export const CampusFilter: React.FC<CampusFilterProps> = ({
  campuses,
  selectedCampus,
  onCampusChange,
  placeholder = "Select Campus / City",
  className = "",
  includeAllOption = true,
  allOptionLabel = "All Campuses",
}) => {
  // Sort the campuses alphabetically using localeCompare before mapping
  const sortedCampuses = [...campuses].sort((a, b) => a.localeCompare(b));

  return (
    <div className={`campus-filter ${className}`}>
      <Select value={selectedCampus} onValueChange={onCampusChange}>
        <SelectTrigger
          className="neu-border bg-white rounded-none w-full font-mono text-sm"
          aria-label="Select Campus or City"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="neu-border rounded-none bg-white z-[100]">
          {includeAllOption && (
            <SelectItem value="all" className="font-mono">
              {allOptionLabel}
            </SelectItem>
          )}
          {sortedCampuses.map((campus) => (
            <SelectItem key={campus} value={campus} className="font-mono">
              {campus}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default CampusFilter;
