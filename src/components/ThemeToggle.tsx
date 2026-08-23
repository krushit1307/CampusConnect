import { Moon, Settings2, Sun, Contrast } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "./theme-provider";

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  function cycleTheme() {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("high-contrast");
    } else if (theme === "high-contrast") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  }

  const label =
    theme === "light"
      ? "Light theme (click to switch to dark)"
      : theme === "dark"
        ? "Dark theme (click to switch to high contrast)"
        : theme === "high-contrast"
          ? "High contrast theme (click to switch to system)"
          : "System theme (click to switch to light)";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={cycleTheme}
            aria-label={`Current theme: ${theme}. ${label}`}
            className="neu-border neu-press flex h-10 w-10 items-center justify-center bg-white transition-colors hover:bg-black hover:text-white dark:bg-black dark:text-white dark:hover:bg-white dark:hover:text-black high-contrast:bg-black high-contrast:text-white high-contrast:hover:bg-white high-contrast:hover:text-black"
          >
            {theme === "light" && <Sun className="h-5 w-5" />}
            {theme === "dark" && <Moon className="h-5 w-5" />}
            {theme === "high-contrast" && <Contrast className="h-5 w-5" />}
            {theme === "system" && <Settings2 className="h-5 w-5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent className="font-mono text-xs capitalize">Theme: {theme}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
