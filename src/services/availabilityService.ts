import { supabase } from "@/lib/supabase";

export interface AvailabilitySlot {
  day_of_week: number;
  slot_index: number;
  is_available: boolean;
}

export interface UserAvailability {
  user_id: string;
  day_of_week: number;
  slot_index: number;
  is_available: boolean;
}

export const availabilityService = {
  /**
   * Fetches the availability slots for a list of user IDs.
   */
  async getAvailabilityForUsers(userIds: string[]): Promise<UserAvailability[]> {
    if (userIds.length === 0) return [];

    const { data, error } = await supabase
      .from("user_availability")
      .select("user_id, day_of_week, slot_index, is_available")
      .in("user_id", userIds);

    if (error) {
      console.error("Error fetching user availability:", error);
      throw error;
    }

    return data as UserAvailability[];
  },

  /**
   * Fetches the availability slots for a single user.
   */
  async getUserAvailability(userId: string): Promise<UserAvailability[]> {
    return this.getAvailabilityForUsers([userId]);
  },

  /**
   * Upserts the availability slots for a user.
   */
  async upsertAvailability(userId: string, slots: AvailabilitySlot[]): Promise<void> {
    const rows = slots.map((slot) => ({
      user_id: userId,
      day_of_week: slot.day_of_week,
      slot_index: slot.slot_index,
      is_available: slot.is_available,
    }));

    const { error } = await supabase
      .from("user_availability")
      .upsert(rows, { onConflict: "user_id, day_of_week, slot_index" });

    if (error) {
      console.error("Error upserting user availability:", error);
      throw error;
    }
  },
};
