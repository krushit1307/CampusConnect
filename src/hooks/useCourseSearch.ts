import { useState, useMemo, useCallback } from "react";
import type {
  Course,
  Professor,
  CourseFilterState,
  ProfessorFilterState,
  CourseReview,
  CourseLevel,
  ReviewSortBy,
} from "../types/course";

// ─── Default Filters ─────────────────────────────────────────────────────

export const DEFAULT_COURSE_FILTERS: CourseFilterState = {
  searchQuery: "",
  departments: [],
  levels: [],
  minRating: 0,
  maxDifficulty: 5,
  minCredits: 0,
  maxCredits: 6,
  sortBy: "rating",
};

export const DEFAULT_PROFESSOR_FILTERS: ProfessorFilterState = {
  searchQuery: "",
  departments: [],
  minRating: 0,
  sortBy: "rating",
};

// ─── Course Search Hook ──────────────────────────────────────────────────

export function useCourseSearch(courses: Course[]) {
  const [filters, setFilters] = useState<CourseFilterState>(DEFAULT_COURSE_FILTERS);

  const updateFilter = useCallback(
    <K extends keyof CourseFilterState>(key: K, value: CourseFilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const toggleDepartment = useCallback((dept: string) => {
    setFilters((prev) => ({
      ...prev,
      departments: prev.departments.includes(dept)
        ? prev.departments.filter((d) => d !== dept)
        : [...prev.departments, dept],
    }));
  }, []);

  const toggleLevel = useCallback((level: CourseLevel) => {
    setFilters((prev) => ({
      ...prev,
      levels: prev.levels.includes(level)
        ? prev.levels.filter((l) => l !== level)
        : [...prev.levels, level],
    }));
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_COURSE_FILTERS), []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.departments.length > 0) count++;
    if (filters.levels.length > 0) count++;
    if (filters.minRating > 0) count++;
    if (filters.maxDifficulty < 5) count++;
    if (filters.minCredits > 0) count++;
    if (filters.maxCredits < 6) count++;
    return count;
  }, [filters]);

  const filteredCourses = useMemo(() => {
    let result = [...courses];

    // Text search
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Department filter
    if (filters.departments.length > 0) {
      result = result.filter((c) => filters.departments.includes(c.department));
    }

    // Level filter
    if (filters.levels.length > 0) {
      result = result.filter((c) => filters.levels.includes(c.level));
    }

    // Rating filter
    if (filters.minRating > 0) {
      result = result.filter((c) => c.rating >= filters.minRating);
    }

    // Difficulty filter
    if (filters.maxDifficulty < 5) {
      result = result.filter((c) => c.difficulty <= filters.maxDifficulty);
    }

    // Credits filter
    result = result.filter(
      (c) => c.credits >= filters.minCredits && c.credits <= filters.maxCredits
    );

    // Sort
    switch (filters.sortBy) {
      case "rating":
        result.sort((a, b) => b.rating - a.rating);
        break;
      case "difficulty":
        result.sort((a, b) => a.difficulty - b.difficulty);
        break;
      case "reviews":
        result.sort((a, b) => b.reviewsCount - a.reviewsCount);
        break;
      case "code":
        result.sort((a, b) => a.code.localeCompare(b.code));
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [courses, filters]);

  return { filters, filteredCourses, updateFilter, toggleDepartment, toggleLevel, resetFilters, activeFilterCount };
}

// ─── Professor Search Hook ───────────────────────────────────────────────

export function useProfessorSearch(professors: Professor[]) {
  const [filters, setFilters] = useState<ProfessorFilterState>(DEFAULT_PROFESSOR_FILTERS);

  const updateFilter = useCallback(
    <K extends keyof ProfessorFilterState>(key: K, value: ProfessorFilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const toggleDepartment = useCallback((dept: string) => {
    setFilters((prev) => ({
      ...prev,
      departments: prev.departments.includes(dept)
        ? prev.departments.filter((d) => d !== dept)
        : [...prev.departments, dept],
    }));
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_PROFESSOR_FILTERS), []);

  const filteredProfessors = useMemo(() => {
    let result = [...professors];

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.department.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (filters.departments.length > 0) {
      result = result.filter((p) => filters.departments.includes(p.department));
    }

    if (filters.minRating > 0) {
      result = result.filter((p) => p.rating >= filters.minRating);
    }

    switch (filters.sortBy) {
      case "rating":
        result.sort((a, b) => b.rating - a.rating);
        break;
      case "difficulty":
        result.sort((a, b) => a.difficulty - b.difficulty);
        break;
      case "reviews":
        result.sort((a, b) => b.reviewsCount - a.reviewsCount);
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [professors, filters]);

  return { filters, filteredProfessors, updateFilter, toggleDepartment, resetFilters };
}

// ─── Review Search Hook ──────────────────────────────────────────────────

export function useReviewSearch(reviews: CourseReview[]) {
  const [sortBy, setSortBy] = useState<ReviewSortBy>("newest");
  const [semesterFilter, setSemesterFilter] = useState<string>("all");
  const [minQuality, setMinQuality] = useState(0);

  const filteredReviews = useMemo(() => {
    let result = [...reviews];

    if (semesterFilter !== "all") {
      result = result.filter((r) => `${r.semester}-${r.year}` === semesterFilter);
    }

    if (minQuality > 0) {
      result = result.filter((r) => r.quality >= minQuality);
    }

    switch (sortBy) {
      case "newest":
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case "highest-rated":
        result.sort((a, b) => b.quality - a.quality);
        break;
      case "lowest-rated":
        result.sort((a, b) => a.quality - b.quality);
        break;
      case "most-helpful":
        result.sort((a, b) => b.helpfulCount - a.helpfulCount);
        break;
    }

    return result;
  }, [reviews, sortBy, semesterFilter, minQuality]);

  return {
    sortBy,
    setSortBy,
    semesterFilter,
    setSemesterFilter,
    minQuality,
    setMinQuality,
    filteredReviews,
  };
}
