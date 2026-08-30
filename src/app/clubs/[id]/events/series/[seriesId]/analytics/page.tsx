'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getSeriesAttendeesWithChurnRisk, calculateChurnRisk } from '@/lib/analytics/churnPrediction';
import ChurnRiskBadge from '@/components/analytics/ChurnRiskBadge';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AttendeeRisk {
    user_id: string;
    full_name: string;
    email: string;
    flight_risk_score: number;
    risk_level: 'low' | 'medium' | 'high';
    primary_signals: string[];
}

export default function SeriesAnalyticsPage() {
    const params = useParams();
    const seriesId = params.seriesId as string;

    const [attendees, setAttendees] = useState<AttendeeRisk[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRecalculating, setIsRecalculating] = useState(false);

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const data = await getSeriesAttendeesWithChurnRisk(seriesId);
                setAttendees(data);
            } catch (error) {
                console.error('Failed to fetch churn risk data:', error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [seriesId]);

    const handleRecalculateAll = async () => {
        setIsRecalculating(true);
        try {
            // Trigger recalculation for all attendees
            await Promise.all(
                attendees.map(attendee => calculateChurnRisk(attendee.user_id, seriesId))
            );
            // Refresh data
            const data = await getSeriesAttendeesWithChurnRisk(seriesId);
            setAttendees(data);
        } catch (error) {
            console.error('Recalculation failed:', error);
        } finally {
            setIsRecalculating(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const highRiskCount = attendees.filter(a => a.risk_level === 'high').length;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Predictive Churn Analytics
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Identify at-risk students before they drop out.
                        </p>
                    </div>
                    <button
                        onClick={handleRecalculateAll}
                        disabled={isRecalculating}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg shadow-md transition-colors disabled:opacity-50 flex items-center space-x-2"
                    >
                        {isRecalculating ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Recalculating...</span>
                            </>
                        ) : (
                            <span>Recalculate Risk Scores</span>
                        )}
                    </button>
                </div>

                {highRiskCount > 0 && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-red-800 dark:text-red-200 font-semibold">
                            ⚠️ Action Required: {highRiskCount} student(s) are flagged as High Risk. Consider sending personalized check-in emails.
                        </p>
                    </div>
                )}

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Student</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Risk Assessment</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Detected Signals</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {attendees.map((attendee) => (
                                <tr key={attendee.user_id} className={attendee.risk_level === 'high' ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{attendee.full_name}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">{attendee.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <ChurnRiskBadge
                                            score={attendee.flight_risk_score}
                                            level={attendee.risk_level}
                                            signals={attendee.primary_signals}
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-600 dark:text-gray-300">
                                            {attendee.primary_signals.length > 0 ? attendee.primary_signals.join(', ') : 'No negative signals detected'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {attendee.risk_level === 'high' && (
                                            <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                                                Send Check-in Email
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
