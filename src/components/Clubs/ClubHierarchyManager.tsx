import { useEffect, useMemo, useState } from "react";
import { Loader2, Network, Save } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { ClubHierarchyRow } from "@/lib/clubHierarchy";

export function ClubHierarchyManager({ clubId }: { clubId: string }) {
  const supabase = createClient();
  const [rows, setRows] = useState<ClubHierarchyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [draftManagers, setDraftManagers] = useState<Record<string, string>>({});

  const loadHierarchy = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.rpc("get_public_club_hierarchy", { p_club_id: clubId });
    if (error) toast.error(error.message);
    else {
      const nextRows = (data ?? []) as ClubHierarchyRow[];
      setRows(nextRows);
      setDraftManagers(
        Object.fromEntries(nextRows.map((row) => [row.role_id, row.reports_to_user_id ?? ""])),
      );
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadHierarchy();
  }, [clubId]);

  const members = useMemo(() => {
    const byUser = new Map<string, ClubHierarchyRow>();
    rows.forEach((row) => byUser.set(row.user_id, row));
    return Array.from(byUser.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [rows]);

  const saveManager = async (roleId: string) => {
    setSavingRoleId(roleId);
    const { error } = await supabase.rpc("set_club_role_manager", {
      p_role_id: roleId,
      p_reports_to_user_id: draftManagers[roleId] || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Reporting line saved.");
      await loadHierarchy();
    }
    setSavingRoleId(null);
  };

  return (
    <section
      className="space-y-4 border-2 border-black bg-purple-50 p-4"
      aria-labelledby="hierarchy-manager-title"
    >
      <div className="flex items-start gap-3">
        <Network className="mt-1 h-5 w-5 text-purple-700" />
        <div>
          <h3 id="hierarchy-manager-title" className="font-display text-lg font-black uppercase">
            Reporting lines
          </h3>
          <p className="font-mono text-xs leading-5 text-gray-600">
            Assign each approved role to a manager. Changes appear on the public club hierarchy
            after saving.
          </p>
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 font-mono text-xs">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading role structure…
        </div>
      ) : rows.length === 0 ? (
        <p className="font-mono text-xs text-gray-600">
          Approved members with assigned roles will appear here.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.role_id}
              className="grid gap-2 border-2 border-black bg-white p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center"
            >
              <div>
                <p className="font-mono text-xs font-bold">{row.role_title}</p>
                <p className="font-mono text-[11px] text-gray-600">{row.full_name}</p>
              </div>
              <label className="font-mono text-[10px] font-bold uppercase">
                Reports to
                <select
                  value={draftManagers[row.role_id] ?? ""}
                  onChange={(event) =>
                    setDraftManagers((current) => ({
                      ...current,
                      [row.role_id]: event.target.value,
                    }))
                  }
                  className="mt-1 w-full border-2 border-black bg-white p-2 text-xs"
                >
                  <option value="">Top level</option>
                  {members
                    .filter((member) => member.user_id !== row.user_id)
                    .map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.full_name} · {member.role_title}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void saveManager(row.role_id)}
                disabled={savingRoleId === row.role_id}
                className="inline-flex items-center justify-center gap-1 border-2 border-black bg-lime px-3 py-2 font-mono text-[10px] font-black uppercase hover:bg-white disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> {savingRoleId === row.role_id ? "Saving" : "Save"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
