import { useState, useEffect } from "react";
import { VaultSidebar } from "./VaultSidebar";
import { VaultFileGrid } from "./VaultFileGrid";
import { VaultListView } from "./VaultListView";
import { UploadFileModal } from "./UploadFileModal";
import { StorageUsageCard } from "./StorageUsageCard";
import { TransitionExportButton } from "./TransitionExportButton";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export const CATEGORIES = [
  "Tax Documents",
  "Vendor Contracts",
  "Banking",
  "Budgets",
  "Meeting Minutes",
  "Sponsorships",
  "Legal",
  "Marketing",
  "Other",
];

interface VaultDashboardProps {
  clubId: string;
}

export function VaultDashboard({ clubId }: VaultDashboardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("Tax Documents");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchFiles = async () => {
    setLoading(true);
    let query = supabase
      .from("vault_documents")
      .select(
        `
        id, file_name, file_path, file_size, mime_type, category, uploaded_at,
        profiles (first_name, last_name)
      `,
      )
      .eq("club_id", clubId);

    if (selectedCategory) {
      query = query.eq("category", selectedCategory);
    }

    if (searchQuery) {
      query = query.ilike("file_name", `%${searchQuery}%`);
    }

    const { data } = await query.order("uploaded_at", { ascending: false });
    if (data) setFiles(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, [clubId, selectedCategory, searchQuery]);

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[800px]">
      {/* Sidebar */}
      <div className="w-full md:w-64 flex flex-col gap-4">
        <UploadFileModal
          clubId={clubId}
          category={selectedCategory}
          onUploadComplete={fetchFiles}
        />
        <VaultSidebar
          categories={CATEGORIES}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
        <div className="mt-auto flex flex-col gap-4">
          <StorageUsageCard clubId={clubId} />
          <TransitionExportButton clubId={clubId} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col border rounded-lg bg-card overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">{selectedCategory}</h2>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                className="pl-9 w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center border rounded-md overflow-hidden">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className="rounded-none h-10 w-10"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                className="rounded-none h-10 w-10 border-l"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* File Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 dark:bg-slate-900/50">
          {viewMode === "grid" ? (
            <VaultFileGrid files={files} loading={loading} onFileChanged={fetchFiles} />
          ) : (
            <VaultListView files={files} loading={loading} onFileChanged={fetchFiles} />
          )}
        </div>
      </div>
    </div>
  );
}
