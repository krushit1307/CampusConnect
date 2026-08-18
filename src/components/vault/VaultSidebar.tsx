import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder } from "lucide-react";

interface VaultSidebarProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export function VaultSidebar({
  categories,
  selectedCategory,
  onSelectCategory,
}: VaultSidebarProps) {
  return (
    <div className="bg-card border rounded-lg overflow-hidden flex flex-col">
      <div className="p-4 border-b bg-muted/30">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          Folders
        </h3>
      </div>
      <ScrollArea className="flex-1 p-2 max-h-[400px] md:max-h-none">
        <div className="flex flex-col gap-1">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "secondary" : "ghost"}
              className="justify-start font-normal h-9"
              onClick={() => onSelectCategory(cat)}
            >
              <Folder
                className={`w-4 h-4 mr-2 ${selectedCategory === cat ? "text-amber-500 fill-amber-500/20" : "text-slate-400"}`}
              />
              {cat}
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
