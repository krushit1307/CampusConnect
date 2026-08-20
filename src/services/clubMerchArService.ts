import { createClient } from "../lib/supabase/client";

const supabase = createClient();

export interface ClubMerchandise {
  id: string;
  club_id: string;
  name: string;
  description?: string;
  item_type: "tshirt" | "hoodie" | "crewneck" | "cap" | "tote_bag" | "jacket" | "other";
  price_cents: number;
  transparent_logo_url: string;
  mockup_image_url?: string;
  ar_scale_factor: number;
  ar_offset_y_percent: number;
  is_preorder_active: boolean;
}

export interface ChestCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculates chest overlay position and scale based on detected face/head box or tracking coordinates.
 * In a standard human anatomy proportions:
 * Chest center X is aligned with head center X.
 * Chest top Y is located below the chin (approx 1.2 to 1.8 head heights below head top).
 * Chest width is approx 1.6 to 2.2 times the head width.
 */
export function calculateChestPlacement(
  faceBox: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
  scaleFactor: number = 1.0,
  offsetYPercent: number = 0.0,
): ChestCoordinates {
  const headCenterX = faceBox.x + faceBox.width / 2;
  const chestWidth = faceBox.width * 1.8 * scaleFactor;
  const chestHeight = chestWidth * 0.8;

  // Position chest below face
  const baseChestY = faceBox.y + faceBox.height * 1.4;
  const chestCenterY = baseChestY + faceBox.height * offsetYPercent;

  const x = Math.max(0, Math.min(canvasWidth - chestWidth, headCenterX - chestWidth / 2));
  const y = Math.max(0, Math.min(canvasHeight - chestHeight, chestCenterY));

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(chestWidth),
    height: Math.round(chestHeight),
  };
}

export const clubMerchArService = {
  /**
   * Fetches active pre-order merch items for a given club.
   */
  async getClubMerchandise(clubId: string): Promise<ClubMerchandise[]> {
    const { data, error } = await supabase
      .from("club_merchandise")
      .select("*")
      .eq("club_id", clubId)
      .eq("is_preorder_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching club merchandise:", error);
      return [];
    }

    return (data as unknown as ClubMerchandise[]) || [];
  },

  /**
   * Saves an AR snapshot capture.
   */
  async recordSnapshot(
    merchId: string,
    snapshotUrl: string,
    sharedTo?: string,
  ): Promise<{ success: boolean }> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("merch_ar_snapshots").insert({
      merch_id: merchId,
      user_id: user?.id || null,
      snapshot_url: snapshotUrl,
      shared_to: sharedTo || "direct",
    });

    if (error) {
      console.error("Error saving AR snapshot:", error);
      return { success: false };
    }

    return { success: true };
  },
};
