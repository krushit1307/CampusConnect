'use client';

import { TransitRoute, TransitWarning } from '@/types/transit';

interface TransitItineraryProps {
    route: TransitRoute;
    warning: TransitWarning;
}

export default function TransitItinerary({ route, warning }: TransitItineraryProps) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {warning.hasWarning && (
                <div className="bg-red-600 dark:bg-red-700 text-white p-4 flex items-start space-x-3 animate-pulse">
                    <svg className="w-6 h-6 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <h4 className="font-bold text-lg">Transit Warning</h4>
                        <p className="text-sm text-red-100 mt-1">{warning.message}</p>
                    </div>
                </div>
            )}

            <div className="p-6">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Recommended Route</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {route.totalDurationMinutes} mins • {route.steps.filter(s => s.mode === 'WALK').reduce((acc, s) => acc + s.durationMinutes, 0)} mins walking
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                            {new Date(route.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Departure</p>
                    </div>
                </div>

                <div className="relative space-y-6 pl-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-300 dark:before:bg-gray-600">
                    {route.steps.map((step, index) => (
                        <div key={index} className="relative">
                            <div className={`absolute -left-[25px] w-6 h-6 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 ${step.mode === 'WALK' ? 'bg-gray-400 dark:bg-gray-500' : 'bg-blue-600 dark:bg-blue-500'
                                }`}>
                                {step.mode === 'WALK' ? (
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                ) : (
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                )}
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                <p className="font-semibold text-gray-900 dark:text-white mb-2">{step.instructions}</p>

                                {step.transitDetails && (
                                    <div className="mt-3 space-y-2">
                                        <div className="flex items-center space-x-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: step.transitDetails.routeColor }}
                                            />
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{step.transitDetails.routeName}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400 text-xs">Departs</p>
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {new Date(step.transitDetails.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <p className="text-gray-600 dark:text-gray-300">{step.transitDetails.departureStop}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400 text-xs">Arrives</p>
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {new Date(step.transitDetails.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <p className="text-gray-600 dark:text-gray-300">{step.transitDetails.arrivalStop}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
