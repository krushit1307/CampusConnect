import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LayoutViewMode = "grid" | "list";
export type AnalyticsTimeframe = "week" | "month" | "year";

interface DashboardState {
  // Navigation & View Mode State
  activeTab: string;
  layoutViewMode: LayoutViewMode;
  analyticsTimeframe: AnalyticsTimeframe;

  // Widget Filters & Preferences
  searchQuery: string;
  welcomeDismissed: boolean;
  selectedCategoryFilter: string | null;

  // Actions
  setActiveTab: (tab: string) => void;
  setLayoutViewMode: (mode: LayoutViewMode) => void;
  setAnalyticsTimeframe: (timeframe: AnalyticsTimeframe) => void;
  setSearchQuery: (query: string) => void;
  setWelcomeDismissed: (dismissed: boolean) => void;
  setSelectedCategoryFilter: (category: string | null) => void;
  resetDashboardState: () => void;
}

const initialState = {
  activeTab: "overview",
  layoutViewMode: "grid" as LayoutViewMode,
  analyticsTimeframe: "month" as AnalyticsTimeframe,
  searchQuery: "",
  welcomeDismissed: false,
  selectedCategoryFilter: null,
};

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      ...initialState,
      setActiveTab: (activeTab) => set({ activeTab }),
      setLayoutViewMode: (layoutViewMode) => set({ layoutViewMode }),
      setAnalyticsTimeframe: (analyticsTimeframe) => set({ analyticsTimeframe }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setWelcomeDismissed: (welcomeDismissed) => set({ welcomeDismissed }),
      setSelectedCategoryFilter: (selectedCategoryFilter) => set({ selectedCategoryFilter }),
      resetDashboardState: () => set({ ...initialState }),
    }),
    {
      name: "campusconnect-dashboard-store",
      partialize: (state) => ({
        layoutViewMode: state.layoutViewMode,
        analyticsTimeframe: state.analyticsTimeframe,
        welcomeDismissed: state.welcomeDismissed,
      }),
    },
  ),
);
