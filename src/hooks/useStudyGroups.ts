import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useStudyGroupStore } from "@/store/useStudyGroupStore";
import type {
  StudyGroup,
  StudySession,
  GroupMember,
  GroupResource,
  StudyGroupFilters,
  StudyGroupStats,
} from "@/types/studyGroups";

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const studyGroupKeys = {
  all: ["studyGroups"] as const,
  lists: () => [...studyGroupKeys.all, "list"] as const,
  list: (filters: StudyGroupFilters) => [...studyGroupKeys.lists(), filters] as const,
  detail: (id: string) => [...studyGroupKeys.all, "detail", id] as const,
  members: (id: string) => [...studyGroupKeys.all, "members", id] as const,
  sessions: (id: string) => [...studyGroupKeys.all, "sessions", id] as const,
  resources: (id: string) => [...studyGroupKeys.all, "resources", id] as const,
  stats: (userId: string) => [...studyGroupKeys.all, "stats", userId] as const,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildGroupQuery(supabase: ReturnType<typeof createClient>, filters: StudyGroupFilters) {
  let query = supabase.from("study_groups").select("*").order("created_at", { ascending: false });

  if (filters.privacy !== "all") {
    query = query.eq("privacy", filters.privacy);
  }
  if (filters.search.trim()) {
    const term = filters.search.trim();
    query = query.or(
      `name.ilike.%${term}%,course_code.ilike.%${term}%,course_name.ilike.%${term}%`,
    );
  }
  if (filters.sort === "most_members") {
    query = query.order("member_count", { ascending: false });
  }

  return query;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Fetch study groups */
export function useStudyGroups(filters: StudyGroupFilters) {
  const store = useStudyGroupStore();

  return useQuery({
    queryKey: studyGroupKeys.list(filters),
    queryFn: async () => {
      store.setStatus("loading");
      const supabase = createClient();
      const { data, error } = await buildGroupQuery(supabase, filters).limit(40);
      if (error) {
        store.setError(error.message);
        throw new Error(error.message);
      }
      const groups = (data ?? []) as StudyGroup[];
      store.setStatus("success");
      return groups;
    },
    staleTime: 30_000,
  });
}

/** Fetch group detail */
export function useStudyGroupDetail(id: string | null) {
  return useQuery({
    queryKey: studyGroupKeys.detail(id ?? ""),
    queryFn: async () => {
      if (!id) return null;
      const supabase = createClient();
      const { data, error } = await supabase.from("study_groups").select("*").eq("id", id).single();
      if (error) throw new Error(error.message);
      return data as StudyGroup;
    },
    enabled: !!id,
  });
}

/** Fetch group members */
export function useGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: studyGroupKeys.members(groupId ?? ""),
    queryFn: async () => {
      if (!groupId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("study_group_members")
        .select("*")
        .eq("group_id", groupId)
        .order("joined_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as GroupMember[];
    },
    enabled: !!groupId,
  });
}

/** Fetch group sessions */
export function useGroupSessions(groupId: string | null) {
  return useQuery({
    queryKey: studyGroupKeys.sessions(groupId ?? ""),
    queryFn: async () => {
      if (!groupId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("study_sessions")
        .select("*")
        .eq("group_id", groupId)
        .order("starts_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as StudySession[];
    },
    enabled: !!groupId,
  });
}

/** Fetch group resources */
export function useGroupResources(groupId: string | null) {
  return useQuery({
    queryKey: studyGroupKeys.resources(groupId ?? ""),
    queryFn: async () => {
      if (!groupId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("study_group_resources")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as GroupResource[];
    },
    enabled: !!groupId,
  });
}

/** Fetch stats */
export function useStudyGroupStats(userId: string) {
  return useQuery({
    queryKey: studyGroupKeys.stats(userId),
    queryFn: async () => {
      const supabase = createClient();
      const { data: groups, error: gErr } = await supabase
        .from("study_groups")
        .select("id, member_count, resource_count");
      if (gErr) throw new Error(gErr.message);

      const rows = (groups ?? []) as { id: string; member_count: number; resource_count: number }[];

      const { data: myMemberships } = await supabase
        .from("study_group_members")
        .select("group_id")
        .eq("user_id", userId);

      const myCount = (myMemberships ?? []).length;

      const { data: sessions } = await supabase
        .from("study_sessions")
        .select("id, status")
        .eq("status", "scheduled");

      const stats: StudyGroupStats = {
        total_groups: rows.length,
        my_groups: myCount,
        total_sessions_scheduled: (sessions ?? []).length,
        total_resources: rows.reduce((sum, r) => sum + (r.resource_count || 0), 0),
      };
      return stats;
    },
    staleTime: 60_000,
    enabled: !!userId,
  });
}

/** Join group */
export function useJoinGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      groupId,
      userId,
      userName,
      userAvatar,
    }: {
      groupId: string;
      userId: string;
      userName: string;
      userAvatar: string | null;
    }) => {
      const supabase = createClient();
      const { error } = await supabase.from("study_group_members").insert({
        group_id: groupId,
        user_id: userId,
        user_name: userName,
        user_avatar: userAvatar,
        role: "member",
      });
      if (error) throw error;

      // Increment member count
      await supabase.rpc("increment_study_group_members", { gid: groupId }).catch(() => {
        // Fallback: manual update
        const { data } = await supabase
          .from("study_groups")
          .select("member_count")
          .eq("id", groupId)
          .single();
        if (data) {
          await supabase
            .from("study_groups")
            .update({ member_count: (data as any).member_count + 1 })
            .eq("id", groupId);
        }
      });

      return groupId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studyGroupKeys.all });
      toast.success("Joined the group!");
    },
    onError: () => toast.error("Failed to join group."),
  });
}

/** Leave group */
export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("study_group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", userId);
      if (error) throw error;
      return groupId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studyGroupKeys.all });
      toast.success("Left the group.");
    },
    onError: () => toast.error("Failed to leave group."),
  });
}

/** Create study group */
export function useCreateStudyGroup() {
  const qc = useQueryClient();
  const store = useStudyGroupStore();
  return useMutation({
    mutationFn: async ({
      payload,
      userId,
      userName,
      userAvatar,
    }: {
      payload: {
        name: string;
        description: string | null;
        course_code: string | null;
        course_name: string | null;
        privacy: "public" | "private" | "invite_only";
        max_members: number | null;
        tags: string[];
        meeting_location: string | null;
      };
      userId: string;
      userName: string;
      userAvatar: string | null;
    }) => {
      const supabase = createClient();
      const { data: group, error } = await supabase
        .from("study_groups")
        .insert({
          ...payload,
          created_by: userId,
          created_by_name: userName,
          created_by_avatar: userAvatar,
          member_count: 1,
          resource_count: 0,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      // Add creator as owner
      await supabase.from("study_group_members").insert({
        group_id: group.id,
        user_id: userId,
        user_name: userName,
        user_avatar: userAvatar,
        role: "owner",
      });

      return group as StudyGroup;
    },
    onSuccess: (group) => {
      store.setFormOpen(false);
      qc.invalidateQueries({ queryKey: studyGroupKeys.all });
      toast.success(`"${group.name}" created!`);
    },
    onError: (err) => {
      toast.error("Failed to create group.");
      console.error(err);
    },
  });
}

/** Add resource to group */
export function useAddResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      groupId,
      title,
      url,
      description,
      resourceType,
      userId,
      userName,
    }: {
      groupId: string;
      title: string;
      url: string | null;
      description: string | null;
      resourceType: string;
      userId: string;
      userName: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("study_group_resources")
        .insert({
          group_id: groupId,
          title,
          url,
          description,
          resource_type: resourceType,
          uploaded_by: userId,
          uploaded_by_name: userName,
        })
        .select()
        .single();
      if (error) throw error;

      // Increment resource count
      const { data: grp } = await supabase
        .from("study_groups")
        .select("resource_count")
        .eq("id", groupId)
        .single();
      if (grp) {
        await supabase
          .from("study_groups")
          .update({ resource_count: (grp as any).resource_count + 1 })
          .eq("id", groupId);
      }

      return data as GroupResource;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: studyGroupKeys.resources(vars.groupId) });
      qc.invalidateQueries({ queryKey: studyGroupKeys.all });
      toast.success("Resource added!");
    },
    onError: () => toast.error("Failed to add resource."),
  });
}

/** Create session */
export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      groupId,
      title,
      description,
      startsAt,
      endsAt,
      location,
      meetingLink,
      userId,
    }: {
      groupId: string;
      title: string;
      description: string | null;
      startsAt: string;
      endsAt: string;
      location: string | null;
      meetingLink: string | null;
      userId: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("study_sessions")
        .insert({
          group_id: groupId,
          title,
          description,
          starts_at: startsAt,
          ends_at: endsAt,
          location,
          meeting_link: meetingLink,
          status: "scheduled",
          attendee_count: 1,
          user_is_attending: true,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as StudySession;
    },
    onSuccess: (_data, vars) => {
      useStudyGroupStore.getState().setSessionFormOpen(false);
      qc.invalidateQueries({ queryKey: studyGroupKeys.sessions(vars.groupId) });
      qc.invalidateQueries({ queryKey: studyGroupKeys.all });
      toast.success("Session scheduled!");
    },
    onError: () => toast.error("Failed to create session."),
  });
}
