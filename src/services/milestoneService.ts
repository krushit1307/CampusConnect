import { createClient } from "@/lib/supabase/client";

const supabase = createClient;

export interface Milestone {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  year: number | null;
  date_precision: "year" | "decade" | "unknown";
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMilestoneParams {
  club_id: string;
  title: string;
  description?: string | null;
  year?: number | null;
  date_precision?: "year" | "decade" | "unknown";
  image_url?: string | null;
  linked_event_id?: string | null;
  linked_alumnus_id?: string | null;
}

export interface UpdateMilestoneParams {
  title?: string;
  description?: string | null;
  year?: number | null;
  date_precision?: "year" | "decade" | "unknown";
  image_url?: string | null;
  linked_event_id?: string | null;
  linked_alumnus_id?: string | null;
}

export const milestoneService = {
  async getMilestones(clubId: string): Promise<Milestone[]> {
    const { data, error } = await supabase
      .from("club_milestones")
      .select("*")
      .eq("club_id", clubId)
      .order("year", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching milestones:", error);
      throw error;
    }
    return data || [];
  },

  async createMilestone(params: CreateMilestoneParams): Promise<Milestone> {
    const { data, error } = await supabase
      .from("club_milestones")
      .insert({
        club_id: params.club_id,
        title: params.title,
        description: params.description ?? null,
        year: params.year ?? null,
        date_precision: params.date_precision ?? "year",
        image_url: params.image_url ?? null,
        linked_event_id: params.linked_event_id ?? null,
        linked_alumnus_id: params.linked_alumnus_id ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating milestone:", error);
      throw error;
    }
    return data;
  },

  async updateMilestone(milestoneId: string, params: UpdateMilestoneParams): Promise<Milestone> {
    const { data, error } = await supabase
      .from("club_milestones")
      .update({
        title: params.title,
        description: params.description,
        year: params.year,
        date_precision: params.date_precision,
        image_url: params.image_url,
        linked_event_id: params.linked_event_id,
        linked_alumnus_id: params.linked_alumnus_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", milestoneId)
      .select()
      .single();

    if (error) {
      console.error("Error updating milestone:", error);
      throw error;
    }
    return data;
  },

  async deleteMilestone(milestoneId: string): Promise<void> {
    const { error } = await supabase.from("club_milestones").delete().eq("id", milestoneId);

    if (error) {
      console.error("Error deleting milestone:", error);
      throw error;
    }
  },
};
