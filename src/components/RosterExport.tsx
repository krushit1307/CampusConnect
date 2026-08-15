import Download from "lucide-react/dist/esm/icons/download";
import { toast } from "sonner";

interface RosterMember {
  id: string;
  full_name: string | null;
  handle: string | null;
  email?: string;
  role: string;
  status: string;
  joined_at: string | null;
}

interface RosterExportProps {
  clubName: string;
  members: RosterMember[];
}

function toCsvRows(data: RosterMember[]): string {
  const headers = ["Name", "Handle", "Email", "Role", "Status", "Joined At"];
  const rows = data.map((m) =>
    [
      escapeCsv(m.full_name || ""),
      escapeCsv(m.handle || ""),
      escapeCsv(m.email || ""),
      escapeCsv(m.role),
      escapeCsv(m.status),
      escapeCsv(m.joined_at ? new Date(m.joined_at).toLocaleDateString() : ""),
    ].join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function RosterExport({ clubName, members }: RosterExportProps) {
  const handleExport = async () => {
    const csvContent = toCsvRows(members);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const suggestedName = `${clubName.replace(/[^a-zA-Z0-9]/g, "_")}_roster.csv`;

    try {
      if ("showSaveFilePicker" in window) {
        const fileHandle = await (
          window as unknown as Window & {
            showSaveFilePicker: (opts: {
              suggestedName: string;
              types: { description: string; accept: Record<string, string[]> }[];
            }) => Promise<FileSystemFileHandle>;
          }
        ).showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: "CSV File",
              accept: { "text/csv": [".csv"] },
            },
          ],
        });

        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        toast.success(`Roster saved as ${suggestedName}`);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Roster downloaded successfully");
      }
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      console.error("Roster export failed:", err);
      toast.error("Failed to export roster. Try downloading instead.");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = suggestedName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (members.length === 0) return null;

  return (
    <button
      type="button"
      onClick={handleExport}
      className="neu-border neu-press flex items-center gap-2 bg-lime px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-lime/80 transition-colors"
    >
      <Download size={14} />
      Export Roster ({members.length})
    </button>
  );
}
