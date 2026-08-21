import { useState } from "react";
import { useMutation, useQueryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Trash2, Edit2, Plus, ShieldAlert } from "lucide-react";
import { CLUB_ROLE_PERMISSIONS, type ClubPermission } from "@/lib/clubPermissions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ClubRole {
  id: string;
  club_id: string;
  title: string;
  permissions_level: number;
  permissions: string[];
}

export function ClubRolesManager({ clubId, clubRoles }: { clubId: string; clubRoles: ClubRole[] }) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<ClubRole | null>(null);

  const [title, setTitle] = useState("");
  const [permissionsLevel, setPermissionsLevel] = useState<number>(10);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  const permissionsList = Object.entries(CLUB_ROLE_PERMISSIONS).map(([key, description]) => ({
    key: key as ClubPermission,
    description,
  }));

  const saveRoleMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Role title is required");

      const roleData = {
        club_id: clubId,
        title: title.trim(),
        permissions_level: permissionsLevel,
        permissions: Array.from(selectedPermissions),
      };

      let error;
      if (editingRole) {
        const { error: err } = await supabase
          .from("club_roles")
          .update(roleData)
          .eq("id", editingRole.id);
        error = err;
      } else {
        const { error: err } = await supabase.from("club_roles").insert(roleData);
        error = err;
      }

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editingRole ? "Role updated successfully" : "Role created successfully");
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["club_manage", clubId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save role");
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from("club_roles").delete().eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["club_manage", clubId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete role");
    },
  });

  const openModal = (role?: ClubRole) => {
    if (role) {
      setEditingRole(role);
      setTitle(role.title);
      setPermissionsLevel(role.permissions_level);
      setSelectedPermissions(new Set(role.permissions || []));
    } else {
      setEditingRole(null);
      setTitle("");
      setPermissionsLevel(10);
      setSelectedPermissions(new Set(["members.view", "content.view"]));
    }
    setIsModalOpen(true);
  };

  const togglePermission = (perm: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b-2 border-black pb-2">
        <h2 className="font-display text-2xl font-bold">Manage Roles</h2>
        <button
          onClick={() => openModal()}
          className="neu-border flex items-center gap-2 bg-lime px-4 py-2 font-mono font-bold uppercase transition-transform hover:-translate-y-1"
        >
          <Plus size={16} /> New Role
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {clubRoles.map((role) => (
          <div key={role.id} className="neu-border bg-white p-4 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display text-xl font-bold">{role.title}</h3>
                <p className="font-mono text-xs text-gray-500 mt-1">
                  Level: {role.permissions_level}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openModal(role)}
                  className="neu-border p-2 bg-blue-200 hover:bg-blue-300"
                  title="Edit Role"
                >
                  <Edit2 size={16} />
                </button>
                {role.title !== "Admin" && role.title !== "Member" && (
                  <button
                    onClick={() => {
                      if (
                        window.confirm(`Are you sure you want to delete the ${role.title} role?`)
                      ) {
                        deleteRoleMutation.mutate(role.id);
                      }
                    }}
                    className="neu-border p-2 bg-red-200 hover:bg-red-300"
                    title="Delete Role"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="font-mono text-sm font-bold mb-2">Permissions</p>
              <div className="flex flex-wrap gap-2">
                {(role.permissions || []).map((p) => (
                  <span
                    key={p}
                    className="neu-border bg-gray-100 px-2 py-1 font-mono text-[10px] uppercase"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Create New Role"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="mb-1 block font-mono text-sm font-bold uppercase">Role Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={editingRole?.title === "Admin" || editingRole?.title === "Member"}
                className="neu-border w-full p-2 font-mono text-sm"
                placeholder="e.g. Treasurer"
              />
              {(editingRole?.title === "Admin" || editingRole?.title === "Member") && (
                <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                  <ShieldAlert size={12} /> Default roles cannot be renamed
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block font-mono text-sm font-bold uppercase">
                Base Level (Legacy)
              </label>
              <select
                value={permissionsLevel}
                onChange={(e) => setPermissionsLevel(Number(e.target.value))}
                className="neu-border w-full p-2 font-mono text-sm bg-white"
              >
                <option value={10}>10 - Member (Read Only)</option>
                <option value={40}>40 - Organizer (Content/Events)</option>
                <option value={60}>60 - Treasurer (Budget/Analytics)</option>
                <option value={100}>100 - Admin (Full Control)</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block font-mono text-sm font-bold uppercase">
                Granular Permissions
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-1">
                {permissionsList.map(({ key, description }) => (
                  <label
                    key={key}
                    className="flex items-start gap-3 neu-border p-3 cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPermissions.has(key)}
                      onChange={() => togglePermission(key)}
                      className="mt-1 w-4 h-4"
                    />
                    <div>
                      <p className="font-mono text-sm font-bold">{key}</p>
                      <p className="text-xs text-gray-600">{description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => setIsModalOpen(false)}
              className="neu-border px-4 py-2 font-mono font-bold uppercase"
            >
              Cancel
            </button>
            <button
              onClick={() => saveRoleMutation.mutate()}
              disabled={saveRoleMutation.isPending || !title.trim()}
              className="neu-border bg-lime px-4 py-2 font-mono font-bold uppercase"
            >
              {saveRoleMutation.isPending ? "Saving..." : "Save Role"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
