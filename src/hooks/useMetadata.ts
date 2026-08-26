import { useState, useEffect } from "react";
import { fetchMajors, fetchSemesters, fetchTerms, fetchDepartments } from "../services/metadata";

export function useMetadata() {
  const [data, setData] = useState({
    majors: [],
    semesters: [],
    terms: [],
    departments: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadAllMetadata() {
      try {
        setLoading(true);
        const [majors, semesters, terms, departments] = await Promise.all([
          fetchMajors(),
          fetchSemesters(),
          fetchTerms(),
          fetchDepartments(),
        ]);

        setData({ majors, semesters, terms, departments });
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }

    loadAllMetadata();
  }, []);

  return { data, loading, error };
}
