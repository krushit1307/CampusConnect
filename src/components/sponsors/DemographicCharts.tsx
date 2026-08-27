// =============================================================================
// Component: DemographicCharts
//Issue: #3238 - Build a 'Sponsorship ROI Dashboard' for Corporate Partners
//Description: Renders beautiful Recharts visualizations for the aggregated 
//demographic data.Displays a Pie Chart for Majors and a Bar Chart for 
//Graduation Years.Fully supports Dark / Light mode.
// =============================================================================

import React from 'react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { DemographicChart } from '../../hooks/useSponsorROI';

interface DemographicChartsProps {
    majors: DemographicChart[];
    graduationYears: DemographicChart[];
}

// Vibrant color palette for the charts
const COLORS = [
    '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#F97316',
    '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6'
];

export const DemographicCharts: React.FC<DemographicChartsProps> = ({ majors, graduationYears }) => {

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                        {payload[0].name || payload[0].payload.label}
                    </p>
                    <p className="text-indigo-600 dark:text-indigo-400 font-medium text-sm">
                        {payload[0].value} Attendees
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Majors Pie Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                    Attendees by Major
                </h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={majors}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={2}
                                dataKey="value"
                                nameKey="label"
                            >
                                {majors.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                formatter={(value) => <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Graduation Year Bar Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                    Attendees by Graduation Year
                </h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={graduationYears} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" className="dark:stroke-gray-700" />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: '#6B7280', fontSize: 12 }}
                                axisLine={{ stroke: '#E5E7EB' }}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fill: '#6B7280', fontSize: 12 }}
                                axisLine={{ stroke: '#E5E7EB' }}
                                tickLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="value" fill="#6366F1" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
