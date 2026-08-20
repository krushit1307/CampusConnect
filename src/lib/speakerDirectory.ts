// src/lib/speakerDirectory.ts
//
// Frontend client for the Centralized Speaker Directory (Issue #2904).

import { supabase } from "./supabase/client";

export interface GuestSpeaker {
    id: string;
    name: string;
    organization?: string;
    title?: string;
    bio?: string;
    linkedin_url?: string;
    contact_email?: string | null; // Null for non-admins
    photo_url?: string;
    rating?: number | null;
}

export interface SpeakerEvent {
    event_id: string;
    event_title: string;
    event_date: string;
    club_name: string;
    club_slug: string;
}

export interface SpeakerNote {
    note_id: string;
    club_name: string;
    author_name: string;
    note_text: string;
    created_at: string;
}

export interface SpeakerHistory {
    speaker: GuestSpeaker;
    events: SpeakerEvent[];
    notes: SpeakerNote[];
}

/**
 * Search for existing speakers to prevent duplicates.
 * Uses the `search_speakers` RPC with fuzzy matching.
 */
export async function searchSpeakers(query: string): Promise<GuestSpeaker[]> {
    if (!query.trim()) return [];

    const { data, error } = await supabase.rpc("search_speakers", {
        p_query: query,
    });

    if (error || !data) return [];
    return data as GuestSpeaker[];
}

/**
 * Fetch all speakers (uses the public view which masks emails for non-admins).
 */
export async function fetchAllSpeakers(): Promise<GuestSpeaker[]> {
    const { data, error } = await supabase
        .from("guest_speakers_public")
        .select("*")
        .order("name", { ascending: true });

    if (error || !data) return [];
    return data as GuestSpeaker[];
}

/**
 * Create a new guest speaker profile.
 */
export async function createSpeaker(
    speaker: Omit<GuestSpeaker, "id">
): Promise<{ success: boolean; speakerId?: string; error?: string }> {
    const { data, error } = await supabase
        .from("guest_speakers")
        .insert(speaker)
        .select("id")
        .single();

    if (error || !data) {
        return { success: false, error: error?.message };
    }
    return { success: true, speakerId: data.id };
}

/**
 * Fetch a speaker's complete history (events + notes).
 */
export async function fetchSpeakerHistory(
    speakerId: string
): Promise<SpeakerHistory | null> {
    const { data, error } = await supabase.rpc("get_speaker_history", {
        p_speaker_id: speakerId,
    });

    if (error || !data || data.success === false) {
        console.error("[speakerDirectory] Failed to fetch history:", error);
        return null;
    }

    return {
        speaker: data.speaker,
        events: data.events ?? [],
        notes: data.notes ?? [],
    };
}

/**
 * Add a private internal note about a speaker.
 */
export async function addSpeakerNote(
    speakerId: string,
    clubId: string,
    authorId: string,
    noteText: string
): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from("speaker_notes").insert({
        speaker_id: speakerId,
        club_id: clubId,
        author_id: authorId,
        note_text: noteText,
        is_private: true,
    });

    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true };
}

/**
 * Link an existing speaker to an event.
 */
export async function linkSpeakerToEvent(
    eventId: string,
    speakerId: string
): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from("events")
        .update({ speaker_id: speakerId })
        .eq("id", eventId);

    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true };
}
