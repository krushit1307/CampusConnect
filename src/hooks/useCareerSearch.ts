import { useState, useMemo, useCallback } from "react";
import type {
  JobListing,
  Application,
  JobType,
  ExperienceLevel,
  RemotePolicy,
  Industry,
  ApplicationStatus,
  CareerFairEvent,
} from "../types/career";

// ─── Search & Filter Hook ────────────────────────────────────────────────

export interface CareerFilters {
  searchQuery: string;
  jobTypes: JobType[];
  experienceLevels: ExperienceLevel[];
  remotePolicies: RemotePolicy[];
  industries: Industry[];
  salaryMin: number;
  salaryMax: number;
  sortBy: "newest" | "salary-high" | "salary-low" | "deadline" | "applicants";
}

export const DEFAULT_FILTERS: CareerFilters = {
  searchQuery: "",
  jobTypes: [],
  experienceLevels: [],
  remotePolicies: [],
  industries: [],
  salaryMin: 0,
  salaryMax: 500000,
  sortBy: "newest",
};

export function useCareerSearch(jobs: JobListing[]) {
  const [filters, setFilters] = useState<CareerFilters>(DEFAULT_FILTERS);

  const updateFilter = useCallback(
    <K extends keyof CareerFilters>(key: K, value: CareerFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const toggleArrayFilter = useCallback(
    <T extends string>(
      key: "jobTypes" | "experienceLevels" | "remotePolicies" | "industries",
      value: T,
    ) => {
      setFilters((prev) => {
        const arr = prev[key] as T[];
        const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
        return { ...prev, [key]: next };
      });
    },
    [],
  );

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.jobTypes.length > 0) count++;
    if (filters.experienceLevels.length > 0) count++;
    if (filters.remotePolicies.length > 0) count++;
    if (filters.industries.length > 0) count++;
    if (filters.salaryMin > 0) count++;
    if (filters.salaryMax < 500000) count++;
    return count;
  }, [filters]);

  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    // Text search
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.name.toLowerCase().includes(q) ||
          j.location.toLowerCase().includes(q) ||
          j.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Job type
    if (filters.jobTypes.length > 0) {
      result = result.filter((j) => filters.jobTypes.includes(j.type));
    }

    // Experience level
    if (filters.experienceLevels.length > 0) {
      result = result.filter((j) => filters.experienceLevels.includes(j.experienceLevel));
    }

    // Remote policy
    if (filters.remotePolicies.length > 0) {
      result = result.filter((j) => filters.remotePolicies.includes(j.remotePolicy));
    }

    // Industry
    if (filters.industries.length > 0) {
      result = result.filter((j) => filters.industries.includes(j.company.industry));
    }

    // Salary
    result = result.filter((j) => {
      if (!j.salary) return true;
      return j.salary.max >= filters.salaryMin && j.salary.min <= filters.salaryMax;
    });

    // Sort
    switch (filters.sortBy) {
      case "newest":
        result.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
        break;
      case "salary-high":
        result.sort((a, b) => (b.salary?.max ?? 0) - (a.salary?.max ?? 0));
        break;
      case "salary-low":
        result.sort((a, b) => (a.salary?.min ?? Infinity) - (b.salary?.min ?? Infinity));
        break;
      case "deadline":
        result.sort(
          (a, b) => (a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity),
        );
        break;
      case "applicants":
        result.sort((a, b) => b.applicantsCount - a.applicantsCount);
        break;
    }

    return result;
  }, [jobs, filters]);

  return {
    filters,
    filteredJobs,
    updateFilter,
    toggleArrayFilter,
    resetFilters,
    activeFilterCount,
  };
}

// ─── Application Tracker Hook ────────────────────────────────────────────

export interface ApplicationFilters {
  searchQuery: string;
  statuses: ApplicationStatus[];
  sortBy: "recent" | "status" | "company";
}

export function useApplicationTracker(applications: Application[]) {
  const [appFilters, setAppFilters] = useState<ApplicationFilters>({
    searchQuery: "",
    statuses: [],
    sortBy: "recent",
  });

  const updateAppFilter = useCallback(
    <K extends keyof ApplicationFilters>(key: K, value: ApplicationFilters[K]) => {
      setAppFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const toggleStatusFilter = useCallback((status: ApplicationStatus) => {
    setAppFilters((prev) => {
      const next = prev.statuses.includes(status)
        ? prev.statuses.filter((s) => s !== status)
        : [...prev.statuses, status];
      return { ...prev, statuses: next };
    });
  }, []);

  const filteredApplications = useMemo(() => {
    let result = [...applications];

    if (appFilters.searchQuery) {
      const q = appFilters.searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.job.title.toLowerCase().includes(q) || a.job.company.name.toLowerCase().includes(q),
      );
    }

    if (appFilters.statuses.length > 0) {
      result = result.filter((a) => appFilters.statuses.includes(a.status));
    }

    switch (appFilters.sortBy) {
      case "recent":
        result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        break;
      case "status":
        result.sort((a, b) => {
          const order: Record<ApplicationStatus, number> = {
            saved: 0,
            screening: 1,
            applied: 2,
            interview: 3,
            offer: 4,
            accepted: 5,
            rejected: 6,
            withdrawn: 7,
          };
          return order[a.status] - order[b.status];
        });
        break;
      case "company":
        result.sort((a, b) => a.job.company.name.localeCompare(b.job.company.name));
        break;
    }

    return result;
  }, [applications, appFilters]);

  const statusCounts = useMemo(() => {
    const counts: Record<ApplicationStatus, number> = {
      saved: 0,
      applied: 0,
      screening: 0,
      interview: 0,
      offer: 0,
      accepted: 0,
      rejected: 0,
      withdrawn: 0,
    };
    applications.forEach((a) => {
      counts[a.status]++;
    });
    return counts;
  }, [applications]);

  return {
    appFilters,
    filteredApplications,
    updateAppFilter,
    toggleStatusFilter,
    statusCounts,
  };
}

// ─── Career Fair Filter Hook ─────────────────────────────────────────────

export function useCareerFairSearch(events: CareerFairEvent[]) {
  const [query, setQuery] = useState("");
  const [showVirtualOnly, setShowVirtualOnly] = useState(false);

  const filteredEvents = useMemo(() => {
    let result = [...events];

    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    if (showVirtualOnly) {
      result = result.filter((e) => e.virtual);
    }

    result.sort((a, b) => a.date.getTime() - b.date.getTime());
    return result;
  }, [events, query, showVirtualOnly]);

  return { query, setQuery, showVirtualOnly, setShowVirtualOnly, filteredEvents };
}
