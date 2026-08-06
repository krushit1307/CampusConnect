import { useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Save, Lock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PermissionMember {
  id: string;
  user_id: string;
  fullName: string;
  handle: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  // Permission flags
  can_edit_events: boolean;
  can_manage_finance: boolean;
  can_remove_members: boolean;
  can_post_news: boolean;
  can_manage_permissions: boolean;
}

interface PermissionsGridProps {
  members: PermissionMember[];
  currentUserId: string;
  onSave: (updates: PermissionUpdate[]) => Promise<void>;
  isSaving?: boolean;
}

export interface PermissionUpdate {
  memberId: string;
  permissions: {
    can_edit_events: boolean;
    can_manage_finance: boolean;
    can_remove_members: boolean;
    can_post_news: boolean;
    can_manage_permissions: boolean;
  };
}

interface FormData {
  members: {
    id: string;
    user_id: string;
    can_edit_events: boolean;
    can_manage_finance: boolean;
    can_remove_members: boolean;
    can_post_news: boolean;
    can_manage_permissions: boolean;
  }[];
}

// ---------------------------------------------------------------------------
// Permission column definitions
// ---------------------------------------------------------------------------

const PERMISSION_COLUMNS = [
  {
    key: "can_edit_events",
    label: "Edit Events",
    description: "Create, edit, and delete club events",
  },
  {
    key: "can_manage_finance",
    label: "Manage Finance",
    description: "Access and manage financial information",
  },
  {
    key: "can_remove_members",
    label: "Remove Members",
    description: "Remove members from the club",
  },
  {
    key: "can_post_news",
    label: "Post News",
    description: "Create and post news/updates",
  },
  {
    key: "can_manage_permissions",
    label: "Manage Permissions",
    description: "Manage other members' permissions",
  },
] as const;

function getInitials(name: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PermissionsGrid({
  members,
  currentUserId,
  onSave,
  isSaving = false,
}: PermissionsGridProps) {
  // Filter to only show approved members (exclude pending/rejected)
  const approvedMembers = useMemo(() => members.filter((m) => m.status === "approved"), [members]);

  // Initialize form with current permission states
  const defaultValues = useMemo<FormData>(
    () => ({
      members: approvedMembers.map((member) => ({
        id: member.id,
        user_id: member.user_id,
        can_edit_events: member.can_edit_events || false,
        can_manage_finance: member.can_manage_finance || false,
        can_remove_members: member.can_remove_members || false,
        can_post_news: member.can_post_news || false,
        can_manage_permissions: member.can_manage_permissions || false,
      })),
    }),
    [approvedMembers],
  );

  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<FormData>({
    defaultValues,
  });

  const onSubmit = async (data: FormData) => {
    if (!isDirty) {
      toast.info("No changes to save");
      return;
    }

    // Calculate changes
    const updates: PermissionUpdate[] = data.members
      .map((formMember) => {
        const originalMember = approvedMembers.find((m) => m.id === formMember.id);
        if (!originalMember) return null;

        const permissionsChanged =
          formMember.can_edit_events !== originalMember.can_edit_events ||
          formMember.can_manage_finance !== originalMember.can_manage_finance ||
          formMember.can_remove_members !== originalMember.can_remove_members ||
          formMember.can_post_news !== originalMember.can_post_news ||
          formMember.can_manage_permissions !== originalMember.can_manage_permissions;

        if (!permissionsChanged) return null;

        return {
          memberId: formMember.id,
          permissions: {
            can_edit_events: formMember.can_edit_events,
            can_manage_finance: formMember.can_manage_finance,
            can_remove_members: formMember.can_remove_members,
            can_post_news: formMember.can_post_news,
            can_manage_permissions: formMember.can_manage_permissions,
          },
        };
      })
      .filter((update): update is PermissionUpdate => update !== null);

    if (updates.length === 0) {
      toast.info("No changes to save");
      return;
    }

    try {
      await onSave(updates);
      toast.success(`Updated permissions for ${updates.length} member(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save permissions");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-bold flex items-center gap-2">
            <ShieldCheck size={20} />
            Permissions Matrix
          </h3>
          <p className="font-mono text-sm text-gray-600 mt-1">
            Manage granular permissions for club officers
          </p>
        </div>
        <Button
          onClick={handleSubmit(onSubmit)}
          disabled={!isDirty || isSaving}
          variant="primary"
          size="md"
          className="gap-2"
        >
          <Save size={16} />
          {isSaving ? "Saving..." : "Save Permissions"}
        </Button>
      </div>

      <div className="neu-border bg-white overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-black bg-gray-50">
              <th className="text-left p-4 font-mono text-xs font-bold uppercase sticky left-0 bg-gray-50 min-w-[250px]">
                Member
              </th>
              {PERMISSION_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="text-center p-4 font-mono text-xs font-bold uppercase min-w-[140px]"
                  title={col.description}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {approvedMembers.map((member) => {
              const isCurrentUser = member.user_id === currentUserId;
              const fieldName = `members.${approvedMembers.findIndex((m) => m.id === member.id)}`;

              return (
                <tr
                  key={member.id}
                  className={`border-b border-gray-200 transition-colors ${
                    isCurrentUser ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <td
                    className={`p-4 sticky left-0 transition-colors ${isCurrentUser ? "bg-blue-50" : "bg-white"}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0 rounded-full border-2 border-black">
                        <AvatarImage
                          src={member.avatarUrl || undefined}
                          alt={member.fullName}
                          className="rounded-full"
                        />
                        <AvatarFallback className="rounded-full bg-brand-blue-light font-bold text-black text-xs">
                          {getInitials(member.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-bold font-mono text-sm" title={member.fullName}>
                          {member.fullName}
                        </p>
                        <div className="flex items-center gap-2">
                          {member.handle && (
                            <p className="truncate text-xs text-gray-500 font-mono">
                              @{member.handle}
                            </p>
                          )}
                          {isCurrentUser && (
                            <span className="flex items-center gap-1 text-xs font-mono text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                              <Lock size={10} />
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  {PERMISSION_COLUMNS.map((col) => (
                    <td key={col.key} className="p-4 text-center">
                      <Controller
                        name={`${fieldName}.${col.key}` as any}
                        control={control}
                        render={({ field }) => {
                          // Club admins always have full access — visually enforce
                          // this on the current user's own row so the UI never
                          // shows a president with a permission box unchecked.
                          const displayChecked = isCurrentUser ? true : field.value;
                          return (
                            <div className="flex justify-center">
                              <Checkbox
                                checked={displayChecked}
                                onCheckedChange={field.onChange}
                                disabled={isCurrentUser || isSaving}
                                className="neu-border"
                              />
                            </div>
                          );
                        }}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {approvedMembers.length === 0 && (
        <EmptyState
          illustration="no-results"
          title="No officers to manage"
          description="Only approved members appear here. Approve members from the Members tab first."
        />
      )}

      <div className="bg-yellow-50 border-2 border-yellow-300 p-4 rounded">
        <p className="font-mono text-xs text-yellow-800">
          <strong>Note:</strong> You cannot modify your own permissions to prevent accidental
          lockout. Club presidents always have full access regardless of permission settings.
        </p>
      </div>
    </div>
  );
}
