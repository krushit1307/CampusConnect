'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { VenueLayout, FacilityNodeType } from '@/types/venue';
import { deserializeFacilities } from '@/lib/venue/serialization';
import FacilitiesToolkit from '@/components/venue/FacilitiesToolkit';
import AccessibleNodeEditor from '@/components/venue/AccessibleNodeEditor';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function VenueLayoutEditorPage() {
    const params = useParams();
    const venueId = params.id as string;

    const [layout, setLayout] = useState<VenueLayout | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchLayout() {
            const { data, error } = await supabase
                .from('venue_layouts')
                .select('*')
                .eq('venue_id', venueId)
                .single();

            if (!error && data) {
                setLayout({
                    ...data,
                    facilities: deserializeFacilities(data.facilities_json),
                });
            } else {
                // Create default layout if none exists
                const defaultLayout = {
                    venue_id: venueId,
                    name: 'Main Floor',
                    grid_size: 20,
                    facilities_json: '[]',
                };
                const { data: newData } = await supabase
                    .from('venue_layouts')
                    .insert(defaultLayout)
                    .select()
                    .single();

                if (newData) {
                    setLayout({ ...newData, facilities: [] });
                }
            }
            setIsLoading(false);
        }
        fetchLayout();
    }, [venueId]);

    const handleDragStart = (type: FacilityNodeType) => {
        // This is handled by the HTML5 drag and drop API in the child component
        // We just need to ensure the toolkit knows what's being dragged
    };

    const handleSave = async (serializedData: string) => {
        if (!layout) return;

        const { error } = await supabase
            .from('venue_layouts')
            .update({ facilities_json: serializedData })
            .eq('id', layout.id);

        if (error) {
            throw new Error(error.message);
        }
    };

    if (isLoading || !layout) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
            <FacilitiesToolkit onDragStart={handleDragStart} />
            <div className="flex-1 flex flex-col">
                <AccessibleNodeEditor
                    initialNodes={layout.facilities}
                    gridSize={layout.grid_size}
                    onSave={handleSave}
                    canvasWidth={2000}
                    canvasHeight={1500}
                />
            </div>
        </div>
    );
}
