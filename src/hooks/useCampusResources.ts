// =============================================================================
// Hook: useCampusResources
// Issue: #3562 - Build an 'Interactive Campus "Safe Space" Directory'
//  Description: Fetches and filters the list of campus safe spaces and
//  resources. Provides utilities to filter by category for the map view.
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';

export type ResourceCategory =
    | 'mental_health'
    | 'lgbtq_center'
    | 'womens_center'
    | 'counseling'
    | 'security'
    | 'medical'
    | 'spiritual';

export interface CampusResource {
    id: string;
    name: string;
    category: ResourceCategory;
    description: string | null;
    building_name: string;
    room_number: string | null;
    latitude: number | null;
    longitude: number | null;
    phone_number: string | null;
    emergency_phone: string | null;
    hours_of_operation: string | null;
    website_url: string | null;
    is_confidential: boolean;
}

interface UseCampusResourcesReturn {
    resources: CampusResource[];
    filteredResources: CampusResource[];
    isLoading: boolean;
    error: string | null;
    activeCategory: ResourceCategory | 'all';
    setActiveCategory: (category: ResourceCategory | 'all') => void;
}

export function useCampusResources(): UseCampusResourcesReturn {
    const [resources, setResources] = useState<CampusResource[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<ResourceCategory | 'all'>('all');

    const fetchResources = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('campus_resources')
                .select('*')
                .order('name', { ascending: true });

            if (fetchError) throw fetchError;
            setResources((data as CampusResource[]) || []);
        } catch (err: any) {
            console.error('[useCampusResources] Fetch failed:', err);
            setError(err.message || 'Failed to load campus resources.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchResources();
    }, [fetchResources]);

    const filteredResources = useMemo(() => {
        if (activeCategory === 'all') return resources;
        return resources.filter(r => r.category === activeCategory);
    }, [resources, activeCategory]);

    return {
        resources,
        filteredResources,
        isLoading,
        error,
        activeCategory,
        setActiveCategory
    };
}
