import { cn } from "@/lib/utils";
import { useActiveHeading } from "@/hooks/useActiveHeading";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TocItem {
  id: string;
  text: string;
  level: number; // 2 for h2, 3 for h3
}

interface TableOfContentsProps {
  items: TocItem[];
}

/**
 * Sticky sidebar navigation that tracks scroll position and highlights
 * the active section. Includes a mobile-friendly collapsible dropdown.
 */
export function TableOfContents({ items }: TableOfContentsProps) {
  const ids = items.map((item) => item.id);
  const activeId = useActiveHeading(ids);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (items.length === 0) return null;

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      // Account for fixed navbar height (approx 80px) + some padding
      const yOffset = -100;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      
      window.scrollTo({
        top: y,
        behavior: "smooth",
      });
      
      // Close mobile menu after click
      setIsMobileOpen(false);
    }
  };

  const TocList = ({ isMobile = false }: { isMobile?: boolean }) => (
    <ul className={cn("space-y-2", !isMobile && "border-l-2 border-border pl-4")}>
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            "transition-colors duration-200",
            item.level === 3 && "pl-3"
          )}
        >
          <button
            onClick={() => scrollToHeading(item.id)}
            className={cn(
              "w-full text-left font-mono text-sm hover:text-primary",
              activeId === item.id
                ? "font-bold text-primary"
                : "text-muted-foreground",
              !isMobile && activeId === item.id && "border-l-2 border-primary -ml-[18px] pl-[14px]"
            )}
          >
            {item.text}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <nav className="sticky top-24 hidden max-h-[calc(100vh-8rem)] w-64 overflow-y-auto lg:block">
        <h4 className="mb-4 font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">
          On this page
        </h4>
        <TocList />
      </nav>

      {/* Mobile Collapsible Dropdown */}
      <div className="mb-6 lg:hidden">
        <Button
          variant="outline"
          className="w-full border-2 border-black font-mono uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
        >
          Contents ({items.length})
          {isMobileOpen ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
        </Button>
        {isMobileOpen && (
          <div className="mt-2 rounded-lg border-2 border-black bg-card p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <TocList isMobile />
          </div>
        )}
      </div>
    </>
  );
}
