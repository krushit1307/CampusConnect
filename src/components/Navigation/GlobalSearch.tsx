import { useEffect, useState } from "react";
import { useDebounce } from "../../hooks/useDebounce";

// Mock implementation of fetchSearchResults and setResults based on the issue description
export default function GlobalSearch() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<unknown[]>([]);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    let ignore = false;

    const fetchSearchResults = async (query: string) => {
      // Mock Supabase fetch call
      console.log(`Fetching results for: ${query}`);
      // Simulate setting results
      if (!ignore) {
        // setResults(data);
      }
    };

    if (!debouncedSearch.trim()) {
      setResults([]);
      return;
    }

    fetchSearchResults(debouncedSearch);

    return () => {
      ignore = true;
    };
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
