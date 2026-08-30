'use client';

import { MaintenanceAlert } from '@/types/hardware';

interface BatteryDegradationAlertProps {
    alert: MaintenanceAlert;
}

export default function BatteryDegradationAlert({ alert }: BatteryDegradationAlertProps) {
    return (
        <div className="w-full bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-6 rounded-r-xl shadow-md mb-6">
            <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                    <svg className="h-8 w-8 text-red-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-red-800 dark:text-red-200 mb-2">
                        Maintenance Required: {alert.resourceName}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-red-200 dark:border-red-800">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Flight Time</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{alert.totalFlightMinutes} mins</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-red-200 dark:border-red-800">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Battery Health</p>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{alert.batteryHealthPercentage.toFixed(1)}%</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-red-200 dark:border-red-800">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</p>
                            <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-1">Removed from Pool</p>
                        </div>
                    </div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 p-3 rounded-lg">
                        Action Required: {alert.recommendedAction}
                    </p>
                </div>
            </div>
        </div>
    );
}
