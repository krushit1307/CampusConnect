import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Post, Event } from '../types/database';
import { compareUUIDv7 } from '../lib/uuidv7';

/**
 * Unified Feed Item Type
 * Combines posts and events into a single stream for the main feed.
 */
export interface FeedItem {
    id: string;
    type: 'post' | 'event';
    data: Post | Event;
    // We no longer rely on created_at for sorting, the UUIDv7 ID handles it
}

interface UseFeedPaginationOptions {
    pageSize?: number;
    clubId?: string;
}

interface UseFeedPaginationReturn {
    items: FeedItem[];
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    loadMore: () => void;
    refresh: () => void;
}

/**
 * useFeedPagination Hook
 * 
 * Manages cursor-based pagination for the main activity feed.
 * 
 * REFACTOR NOTE: Previously, this hook relied on a secondary `created_at`
 * index to sort and paginate feed items. Because we have migrated to UUIDv7
 * for all primary keys, the `id` column itself contains the exact millisecond
 * timestamp prefix. This allows us to eliminate the `created_at` index entirely,
 * drastically reducing database write amplification and B-Tree fragmentation.
 * 
 * We now use the `id` directly for cursor-based sorting. Since UUIDv7 strings
 * are lexicographically sortable by time, a simple `lt: cursorId` query
 * perfectly retrieves the next chronological page of results.
 */
export function useFeedPagination(options: UseFeedPaginationOptions = {}): UseFeedPaginationReturn {
    const { pageSize = 20, clubId } = options;

    const [items, setItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState<boolean>(true);

    // Use a ref to track the current cursor (the ID of the last item loaded)
    // This prevents stale closure issues during rapid scrolling
    const cursorRef = useRef<string | null>(null);
    const isFetchingRef = useRef<boolean>(false);

    /**
     * Fetches a page of posts from the database.
     * Uses the UUIDv7 `id` column for cursor-based pagination instead of `created_at`.
     */
    const fetchPosts = async (cursor: string | null): Promise<FeedItem[]> => {
        let query = supabase
            .from('posts')
            .select('*, author:profiles(*)')
            .order('id', { ascending: false }) // Lexicographical order on UUIDv7 = Chronological order
            .limit(pageSize);

        if (clubId) {
            query = query.eq('club_id', clubId);
        }

        // Apply cursor if we are paginating
        if (cursor) {
            // 'lt' (less than) works perfectly because older UUIDv7s have smaller hex prefixes
            query = query.lt('id', cursor);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching posts:', error);
            throw new Error('Failed to fetch posts');
        }

        return (data || []).map((post) => ({
            id: post.id,
            type: 'post' as const,
            data: post,
        }));
    };

    /**
     * Fetches a page of events from the database.
     * Uses the UUIDv7 `id` column for cursor-based pagination instead of `created_at`.
     */
    const fetchEvents = async (cursor: string | null): Promise<FeedItem[]> => {
        let query = supabase
            .from('events')
            .select('*, club:clubs(*), creator:profiles(*)')
            .order('id', { ascending: false }) // Lexicographical order on UUIDv7 = Chronological order
            .limit(pageSize);

        if (clubId) {
            query = query.eq('club_id', clubId);
        }

        if (cursor) {
            query = query.lt('id', cursor);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching events:', error);
            throw new Error('Failed to fetch events');
        }

        return (data || []).map((event) => ({
            id: event.id,
            type: 'event' as const,
            data: event,
        }));
    };

    /**
     * Merges posts and events into a single chronologically sorted feed.
     * Since both arrays are already sorted by their UUIDv7 IDs (descending),
     * we can perform a simple O(N) merge similar to the merge step in Merge Sort.
     */
    const mergeFeedItems = (posts: FeedItem[], events: FeedItem[]): FeedItem[] => {
        const merged: FeedItem[] = [];
        let i = 0;
        let j = 0;

        while (i < posts.length && j < events.length) {
            // compareUUIDv7 returns 1 if posts[i] is newer (greater UUIDv7 string)
            if (compareUUIDv7(posts[i].id, events[j].id) > 0) {
                merged.push(posts[i]);
                i++;
            } else {
                merged.push(events[j]);
                j++;
            }
        }

        // Append any remaining items
        while (i < posts.length) {
            merged.push(posts[i]);
            i++;
        }
        while (j < events.length) {
            merged.push(events[j]);
            j++;
        }

        return merged;
    };

    /**
     * Loads the next page of data and appends it to the existing feed.
     */
    const loadMore = useCallback(async () => {
        if (isFetchingRef.current || !hasMore) return;

        isFetchingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            const [newPosts, newEvents] = await Promise.all([
                fetchPosts(cursorRef.current),
                fetchEvents(cursorRef.current),
            ]);

            const newItems = mergeFeedItems(newPosts, newEvents);

            if (newItems.length === 0) {
                setHasMore(false);
            } else {
                // Trim to exact page size to maintain consistent chunking
                const trimmedItems = newItems.slice(0, pageSize);

                setItems((prev) => [...prev, ...trimmedItems]);

                // Update the cursor to the ID of the last item in the new batch
                cursorRef.current = trimmedItems[trimmedItems.length - 1].id;

                if (trimmedItems.length < pageSize) {
                    setHasMore(false);
                }
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred while loading the feed.');
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, [hasMore, pageSize, clubId]);

    /**
     * Completely resets the feed state and fetches the first page from scratch.
     * Useful when the user pulls to refresh or changes filters.
     */
    const refresh = useCallback(async () => {
        cursorRef.current = null;
        setItems([]);
        setHasMore(true);
        setLoading(true);
        setError(null);
        isFetchingRef.current = false; // Reset fetching lock

        // Trigger the initial load
        await loadMore();
    }, [loadMore]);

    // Initial load on mount or when clubId changes
    useEffect(() => {
        refresh();
    }, [clubId]); // Only re-run if the specific club filter changes

    return {
        items,
        loading,
        error,
        hasMore,
        loadMore,
        refresh,
    };
}
