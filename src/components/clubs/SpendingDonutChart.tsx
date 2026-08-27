// =============================================================================
// Component: SpendingDonutChart
// Issue: #3277 - Implement 'Interactive Club Financial Transparency Dashboard'
// Description: Renders a beautiful Recharts Donut Chart visualizing the club's 
// spending breakdown by category.Supports dark mode and interactive tooltips.
// =============================================================================

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { SpendingCategory } from '../../hooks/useClubFinances';

interface SpendingDonutChartProps {
    data: SpendingCategory[];
}

// Vibrant color palette for the chart segments
const COLORS = [
    '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#F97316',
    '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6'
];

export const SpendingDonutChart: React.FC<SpendingDonutChartProps> = ({ data }) => {

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload;
            return (
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                        {item.category}
                    </p>
                    <p className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                        ${item.total_spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.transaction_count} transactions
                    </p>
                </div>
            );
        }
        return null;
    };

    if (data.length === 0) {
        return (
            <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
                <p>No expense data available for this academic year.</p>
            </div>
        );
    }

    return (
        <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={3}
                        dataKey="total_spent"
                        nameKey="category"
                        stroke="none"
                    >
                        {data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value) => <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{value}</span>}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};
