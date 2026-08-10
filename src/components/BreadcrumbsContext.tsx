import React, { createContext, useContext, useState, ReactNode } from "react";

export interface BreadcrumbItem {
  label: string | ReactNode;
  path?: string;
}

interface BreadcrumbContextType {
  labels: Record<string, string>;
  setLabel: (key: string, label: string) => void;
  customTrail: BreadcrumbItem[] | null;
  setCustomTrail: (trail: BreadcrumbItem[] | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [customTrail, setCustomTrail] = useState<BreadcrumbItem[] | null>(null);

  const setLabel = (key: string, label: string) => {
    setLabels((prev) => {
      if (prev[key] === label) return prev;
      return { ...prev, [key]: label };
    });
  };

  return (
    <BreadcrumbContext.Provider value={{ labels, setLabel, customTrail, setCustomTrail }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbs() {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error("useBreadcrumbs must be used within a BreadcrumbProvider");
  }
  return context;
}
