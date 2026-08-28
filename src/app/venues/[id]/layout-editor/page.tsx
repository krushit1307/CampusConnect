'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { VenueLayout, FacilityNodeType, EvacuationRoute } from '@/types/venue';
import { deserializeFacilities, serializeFacilities } from '@/lib/venue/serialization';
import FacilitiesToolkit from '@/components/venue/FacilitiesToolkit';
import AccessibleNodeEditor from '@/components/venue/AccessibleNodeEditor';
import EvacuationPathTool from '@/components/venue/EvacuationPathTool';
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
    const [isDrawingEvacuation, setIsDrawingEvacuation] = useState(false);

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
                    evacuation_routes: data.evacuation_routes || [],
                });
            } else {
                const defaultLayout = {
                    venue_id: venueId,
                    name: 'Main Floor',
                    grid_size: 20,
                    facilities_json: '[]',
                    evacuation_routes: [],
                };
                const { data: newData } = await supabase
                    .from('venue_layouts')
                    .insert(defaultLayout)
                    .select()
                    .single();

                if (newData) {
                    setLayout({ ...newData, facilities: [], evacuation_routes: [] });
                }
            }
            setIsLoading(false);
        }
        fetchLayout();
    }, [venueId]);

    const handleSaveEvacuationRoute = async (newRoute: Omit<EvacuationRoute, 'id'>) => {
        if (!layout) return;

        const routeWithId = { ...newRoute, id: crypto.randomUUID() };
        const updatedRoutes = [...layout.evacuation_routes, routeWithId];

        const { error } = await supabase
            .from('venue_layouts')
            .update({ evacuation_routes: updatedRoutes })
            .eq('id', layout.id);

        if (!error) {
            setLayout({ ...layout, evacuation_routes: updatedRoutes });
        }
        setIsDrawingEvacuation(false);
    };

    const handleSaveFacilities = async (serializedData: string) => {
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
        <div className="h-screen flex bg-gray-50 dark:bg-gray-900 relative">
            <FacilitiesToolkit onDragStart={() => { }} />

            {isDrawingEvacuation && (
                <EvacuationPathTool
                    onSave={handleSaveEvacuationRoute}
                    onCancel={() => setIsDrawingEvacuation(false)}
                />
            )}

            <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Layout Editor</h2>
                    <div className="space-x-3">
                        <button
                            onClick={() => setIsDrawingEvacuation(true)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white font-medium rounded-lg shadow-md transition-colors flex items-center space-x-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Add Evacuation Route</span>
                        </button>
                        {/* Existing save button would go here */}
                    </div>
                </div>

                <AccessibleNodeEditor
                    initialNodes={layout.facilities}
                    gridSize={layout.grid_size}
                    onSave={handleSaveFacilities}
                    canvasWidth={2000}
                    canvasHeight={1500}
                />
            </div>
        </div>
    );
}
