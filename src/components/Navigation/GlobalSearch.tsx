import React, { useState, useEffect } from "react";
import { useDebounce } from "../../hooks/useDebounce";

// Mock implementation of fetchSearchResults and setResults based on the issue description
export default function GlobalSearch() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<unknown[]>([]);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const fetchSearchResults = async (query: string) => {
    // Mock Supabase fetch call
    console.log(`Fetching results for: ${query}`);
    // Simulate setting results
    // setResults(data);
  };

  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setResults([]);
      return;
    }

    fetchSearchResults(debouncedSearch);
  }, [debouncedSearch]);

  return (
    <div>
      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {/* Render results here */}
    </div>
  );
}
