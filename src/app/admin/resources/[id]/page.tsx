'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Resource, MaintenanceAlert } from '@/types/hardware';
import BatteryDegradationAlert from '@/components/hardware/BatteryDegradationAlert';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminResourceDetailsPage() {
    const params = useParams();
    const resourceId = params.id as string;

    const [resource, setResource] = useState<Resource | null>(null);
    const [maintenanceAlert, setMaintenanceAlert] = useState<MaintenanceAlert | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPerformingMaintenance, setIsPerformingMaintenance] = useState(false);

    useEffect(() => {
        async function fetchResource() {
            const { data, error } = await supabase
                .from('resources')
                .select('*')
                .eq('id', resourceId)
                .single();

            if (!error && data) {
                setResource(data);
                if (data.maintenance_required) {
                    setMaintenanceAlert({
                        resourceId: data.id,
                        resourceName: data.name,
                        totalFlightMinutes: data.total_flight_minutes,
                        batteryHealthPercentage: data.battery_health_percentage,
                        recommendedAction: 'Schedule battery replacement and system diagnostic.',
                    });
                }
            }
            setIsLoading(false);
        }
        fetchResource();
    }, [resourceId]);

    const handleMaintenanceComplete = async () => {
        if (!resource) return;
        setIsPerformingMaintenance(true);

        try {
            const { error } = await supabase
                .from('resources')
                .update({
                    maintenance_required: false,
                    last_maintenance_date: new Date().toISOString(),
                    total_flight_minutes: 0, // Reset counter after battery replacement
                    battery_health_percentage: 100.00,
                    available: true, // Return to booking pool
                })
                .eq('id', resourceId);

            if (error) throw new Error(error.message);

            // Refresh data
            const { data: updatedData } = await supabase
                .from('resources')
                .select('*')
                .eq('id', resourceId)
                .single();

            setResource(updatedData);
            setMaintenanceAlert(null);
            alert('Maintenance logged successfully. Resource is now available for booking.');
        } catch (error) {
            console.error('Maintenance update error:', error);
            alert('Failed to update maintenance status.');
        } finally {
            setIsPerformingMaintenance(false);
        }
    };

    if (isLoading || !resource) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Resource Management: {resource.name}
                    </h1>
                    <span className={`px-4 py-2 rounded-full text-sm font-bold ${resource.available
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                        {resource.available ? 'Available for Booking' : 'Unavailable'}
                    </span>
                </div>

                {maintenanceAlert && <BatteryDegradationAlert alert={maintenanceAlert} />}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Battery Health Metrics</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600 dark:text-gray-400">Current Health</span>
                                    <span className="font-bold text-gray-900 dark:text-white">{resource.battery_health_percentage.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ${resource.battery_health_percentage < 20 ? 'bg-red-500' :
                                                resource.battery_health_percentage < 50 ? 'bg-yellow-500' : 'bg-green-500'
                                            }`}
                                        style={{ width: `${resource.battery_health_percentage}%` }}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                                <span className="text-gray-600 dark:text-gray-400">Total Flight Minutes</span>
                                <span className="font-mono font-bold text-gray-900 dark:text-white">{resource.total_flight_minutes} mins</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Last Maintenance</span>
                                <span className="font-mono text-gray-900 dark:text-white">
                                    {resource.last_maintenance_date ? new Date(resource.last_maintenance_date).toLocaleDateString() : 'Never'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Administrative Actions</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            Use this section to log maintenance events. Resetting the maintenance flag will restore the resource to the active booking pool and reset the flight minute counter (assuming battery replacement).
                        </p>
                        <button
                            onClick={handleMaintenanceComplete}
                            disabled={isPerformingMaintenance || !resource.maintenance_required}
                            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPerformingMaintenance ? 'Processing...' : 'Log Maintenance & Reset Counter'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
