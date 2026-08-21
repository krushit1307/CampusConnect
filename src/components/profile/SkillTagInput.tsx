import React, { useState, useMemo, useRef, useEffect } from "react";
import X from "lucide-react/dist/esm/icons/x";

interface Skill {
  id: string;
  name: string;
}

interface SkillTagInputProps {
  selectedSkills: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
  taxonomy: Skill[];
}

export function SkillTagInput({
  selectedSkills,
  onChange,
  placeholder = "Search and select skills...",
  taxonomy,
}: SkillTagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter options based on input value and already selected skills
  const filteredOptions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) return [];

    return taxonomy.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) &&
        !selectedSkills.includes(skill.name)
    );
  }, [inputValue, taxonomy, selectedSkills]);

  const handleSelect = (skillName: string) => {
    if (!selectedSkills.includes(skillName)) {
      onChange([...selectedSkills, skillName]);
    }
    setInputValue("");
    setIsOpen(false);
  };

  const handleRemove = (skillName: string) => {
    onChange(selectedSkills.filter((s) => s !== skillName));
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full space-y-3">
      {/* Selected Tag Chips */}
      {selectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSkills.map((skill) => (
            <span
              key={skill}
              className="neu-border inline-flex items-center gap-1.5 bg-lime px-3 py-1 font-mono text-xs font-bold text-black"
            >
              {skill}
              <button
                type="button"
                onClick={() => handleRemove(skill)}
                aria-label={`Remove ${skill}`}
                className="rounded-none transition-opacity hover:opacity-60"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input container */}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/20"
        />

        {/* Custom Neubrutalist Dropdown */}
        {isOpen && filteredOptions.length > 0 && (
          <ul className="neu-border absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-white shadow-[4px_4px_0_0_#000000] border-2 border-black">
            {filteredOptions.map((skill) => (
              <li
                key={skill.id}
                onClick={() => handleSelect(skill.name)}
                className="cursor-pointer px-4 py-2 font-mono text-xs font-bold text-black hover:bg-lime hover:text-black"
              >
                {skill.name}
              </li>
            ))}
          </ul>
        )}

        {/* Empty matching message if typed query has no matched taxonomy items */}
        {isOpen && inputValue.trim().length > 0 && filteredOptions.length === 0 && (
          <div className="neu-border absolute left-0 right-0 z-50 mt-1 bg-white p-3 font-mono text-xs text-muted-foreground shadow-[4px_4px_0_0_#000000] border-2 border-black">
            No matching taxonomy skills found. Please select from the predefined options.
          </div>
        )}
      </div>
    </div>
  );
}
