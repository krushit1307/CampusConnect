import { useContext, createContext } from "react";
import { MultiSelectContextValue } from "./types";

export const MultiSelectContext = createContext<MultiSelectContextValue | undefined>(undefined);

export function useMultiSelectContext() {
  const context = useContext(MultiSelectContext);
  if (!context) {
    throw new Error("useMultiSelectContext must be used within a MultiSelectProvider");
  }
  return context;
}
