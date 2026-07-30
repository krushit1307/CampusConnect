import { type ReactNode } from "react";
export type Theme = "light" | "dark" | "system";
type ThemeContextValue = {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
};
export declare function ThemeProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useTheme(): ThemeContextValue;
export {};
