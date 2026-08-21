// =============================================================================
// Hook: useEventSponsors
// Issue: #2808 - Implement 'Sponsorship' Tiers and Dynamic Banners for Events
// Description: Manages CRUD operations for event sponsors. Handles file
// uploads to Supabase Storage and fetches sponsors grouped by tier level.
// =============================================================================

import { useState, useCallback, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export type SponsorTier = "platinum" | "gold" | "silver" | "bronze";

export interface Sponsor {
  id: string;
  event_id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
  tier_level: SponsorTier;
  display_order: number;
  created_at: string;
}

interface UseEventSponsorsReturn {
  sponsors: Sponsor[];
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
  fetchSponsors: () => Promise<void>;
  addSponsor: (name: string, websiteUrl: string, tier: SponsorTier, file: File) => Promise<boolean>;
  deleteSponsor: (sponsorId: string) => Promise<boolean>;
  updateSponsorTier: (sponsorId: string, newTier: SponsorTier) => Promise<boolean>;
}

export function useEventSponsors(eventId: string): UseEventSponsorsReturn {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSponsors = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("sponsors")
        .select("*")
        .eq("event_id", eventId)
        .order("tier_level", { ascending: true }) // Platinum first
        .order("display_order", { ascending: true });

      if (fetchError) throw fetchError;
      setSponsors(data || []);
    } catch (err: any) {
      console.error("[useEventSponsors] Fetch failed:", err);
      setError(err.message || "Failed to load sponsors");
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchSponsors();
  }, [fetchSponsors]);

  const addSponsor = async (
    name: string,
    websiteUrl: string,
    tier: SponsorTier,
    file: File,
  ): Promise<boolean> => {
    setIsUploading(true);
    setError(null);

    try {
      // 1. Upload logo to storage
      const fileExt = file.name.split(".").pop() || "png";
      const fileName = `${eventId}/${Date.now()}_${file.name}`;
      const filePath = `sponsors/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("event-assets")
        .upload(filePath, file, {
          cacheControl: "31536000", // 1 year cache for logos
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("event-assets").getPublicUrl(filePath);

      // 3. Insert sponsor record
      const { error: dbError } = await supabase.from("sponsors").insert({
        event_id: eventId,
        name,
        website_url: websiteUrl || null,
        logo_url: publicUrl,
        tier_level: tier,
        display_order: sponsors.length, // Append to end
      });

      if (dbError) throw dbError;

      await fetchSponsors();
      return true;
    } catch (err: any) {
      console.error("[useEventSponsors] Add failed:", err);
      setError(err.message || "Failed to add sponsor");
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const deleteSponsor = async (sponsorId: string): Promise<boolean> => {
    try {
      const { error: dbError } = await supabase.from("sponsors").delete().eq("id", sponsorId);

      if (dbError) throw dbError;

      setSponsors((prev) => prev.filter((s) => s.id !== sponsorId));
      return true;
    } catch (err: any) {
      console.error("[useEventSponsors] Delete failed:", err);
      setError(err.message || "Failed to delete sponsor");
      return false;
    }
  };

  const updateSponsorTier = async (sponsorId: string, newTier: SponsorTier): Promise<boolean> => {
    try {
      const { error: dbError } = await supabase
        .from("sponsors")
        .update({ tier_level: newTier })
        .eq("id", sponsorId);

      if (dbError) throw dbError;

      await fetchSponsors();
      return true;
    } catch (err: any) {
      console.error("[useEventSponsors] Update failed:", err);
      setError(err.message || "Failed to update sponsor tier");
      return false;
    }
  };

  return {
    sponsors,
    isLoading,
    isUploading,
    error,
    fetchSponsors,
    addSponsor,
    deleteSponsor,
    updateSponsorTier,
  };
}
