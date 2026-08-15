import { SupabaseClient } from "@supabase/supabase-js";
import { EventFormValues } from "./eventUtils";

export interface EventConflict {
  id: string;
  title: string;
  max_attendees: number;
  start_date: string;
  end_date: string;
  tags: string[];
  club: {
    id: string;
    name: string;
    created_by: string;
  };
}

export async function checkEventConflicts(
  supabase: SupabaseClient,
  formData: EventFormValues
): Promise<EventConflict[]> {
  const capacity = (formData.capacity || formData.maxAttendees) || 0;
  
  if (capacity <= 100) {
    return [];
  }

  const formTags = formData.tags || [];
  if (formTags.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("events")
    .select("id, title, max_attendees, start_date, end_date, tags, clubs(id, name, created_by)")
    .neq("status", "cancelled")
    .gt("max_attendees", 100)
    .lt("start_date", formData.endDate)
    .gt("end_date", formData.startDate);

  if (error || !data) {
    console.error("Error checking event conflicts:", error);
    return [];
  }

  const conflicts = data.filter((event: any) => {
    const eventTags = event.tags || [];
    const hasOverlap = eventTags.some((tag: string) => formTags.includes(tag));
    return hasOverlap && event.clubs;
  });

  return conflicts.map((event: any) => ({
    id: event.id,
    title: event.title,
    max_attendees: event.max_attendees,
    start_date: event.start_date,
    end_date: event.end_date,
    tags: event.tags,
    club: Array.isArray(event.clubs) ? event.clubs[0] : event.clubs
  }));
}