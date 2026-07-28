/**
 * Event-related Supabase database operations.
 * This module provides typed functions to interact with the events table,
 * including fetching trending events ordered by popularity score.
 */

import { supabase } from './client';

// Fallback type definition if database.types is not yet generated
export type Database = {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          event_date: string | null;
          banner_url: string | null;
          views: number;
          created_at: string;
          club_id: string;
        };
      };
    };
  };
};

export type Event = Database['public']['Tables']['events']['Row'];
export type EventWithPopularity = {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  banner_url: string | null;
  rsvp_count: number;
  views_count: number;
  popularity_score: number;
};

/**
 * Fetches a list of trending events ordered by their calculated popularity score.
 * The popularity score is computed natively in Postgres using RSVPs, views, and recency.
 * 
 * @param limit - Maximum number of events to return (default: 10)
 * @param offset - Number of events to skip for pagination (default: 0)
 * @returns A promise resolving to an array of events with their popularity scores.
 */
export async function getTrendingEvents(
  limit: number = 10,
  offset: number = 0
): Promise<{ data: EventWithPopularity[] | null; error: any }> {
  try {
    // Call the custom Postgres RPC function that handles the complex aggregation and sorting
    const { data, error } = await supabase.rpc('get_trending_events', {
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error('Error fetching trending events:', error);
      return { data: null, error };
    }

    return { data: data as EventWithPopularity[] | null, error: null };
  } catch (err) {
    console.error('Unexpected error in getTrendingEvents:', err);
    return { data: null, error: err };
  }
}

/**
 * Increments the view count for a specific event.
 * This should be called when a user lands on the event details page.
 * 
 * @param eventId - The UUID of the event to increment views for.
 * @returns A promise resolving to the success status and any error.
 */
export async function incrementEventViews(eventId: string): Promise<{ success: boolean; error: any }> {
  try {
    const { error } = await supabase.rpc('increment_event_views', { p_event_id: eventId });
    
    if (error) {
      console.error('Error incrementing event views:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Unexpected error in incrementEventViews:', err);
    return { success: false, error: err };
  }
}

/**
 * Fetches a single event by its ID, including its current popularity score.
 * 
 * @param eventId - The UUID of the event to fetch.
 * @returns A promise resolving to the event data with popularity metrics or null.
 */
export async function getEventByIdWithPopularity(eventId: string): Promise<{ data: EventWithPopularity | null; error: any }> {
  try {
    // We join with the rsvp count and calculate popularity on the fly for a single event
    const { data, error } = await supabase
      .from('events')
      .select(`
        id,
        title,
        description,
        event_date,
        banner_url,
        views,
        event_rsvps (count)
      `)
      .eq('id', eventId)
      .single();

    if (error) {
      console.error('Error fetching event by ID:', error);
      return { data: null, error };
    }

    // Transform the data to match our EventWithPopularity type
    const rsvpCount = data?.event_rsvps?.[0]?.count || 0;
    const viewsCount = data?.views || 0;
    
    // Note: In a real app, you might want to call get_event_popularity_score via RPC here 
    // to ensure the calculation logic is perfectly consistent, but for a single event 
    // we can also compute it or fetch it. For consistency, let's use the RPC.
    const { data: scoreData, error: scoreError } = await supabase.rpc('get_event_popularity_score', {
      p_event_id: eventId,
      p_event_date: data.event_date,
      p_rsvp_count: rsvpCount,
      p_views: viewsCount
    });

    if (scoreError) {
      console.error('Error calculating popularity score:', scoreError);
    }

    const transformedData: EventWithPopularity = {
      id: data.id,
      title: data.title,
      description: data.description,
      event_date: data.event_date,
      banner_url: data.banner_url,
      rsvp_count: rsvpCount,
      views_count: viewsCount,
      popularity_score: scoreData || 0,
    };

    return { data: transformedData, error: null };
  } catch (err) {
    console.error('Unexpected error in getEventByIdWithPopularity:', err);
    return { data: null, error: err };
  }
}
