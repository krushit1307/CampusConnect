// =============================================================================
// Component: AssetHealthChart
// Issue: #3685 - Implement 'Automated "Event Equipment" Depreciation Tracker'
// Description: Horizontal bar chart of current book value vs original price
// for every tracked asset, rendered with pure SVG (no chart dependency).
// =============================================================================

import React from 'react';
import { AssetDepreciationRow } from '../../hooks/useAssetDepreciation';

interface AssetHealthChartProps {
    rows: AssetDepreciationRow[];
    totalBookValue: number;
    totalOriginalValue: number;
}

export const AssetHealthChart: React.FC<AssetHealthChartProps> = ({ rows, totalBookValue, totalOriginalValue }) => {
    const healthPct = totalOriginalValue > 0 ? Math.round((totalBookValue / totalOriginalValue) * 100) : 0;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Asset Health</h3>
                <div className="text-right">
                    <p className="text-2xl font-black text-gray-900 dark:text-white">
                        ${totalBookValue.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">
                        Current Book Value ({healthPct}% of original)
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                {rows.map(row => {
                    const pct = Number(row.remaining_value_pct);
                    const barColor = pct < 20 ? 'bg-red-500' : pct < 50 ? 'bg-amber-500' : 'bg-green-500';
                    return (
                        <div key={row.item_id}>
                            <div className="flex justify-between items-baseline mb-1 text-sm">
                                <span className="font-medium text-gray-700 dark:text-gray-300">{row.item_name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    ${Number(row.book_value).toLocaleString()} / ${Number(row.purchase_price).toLocaleString()}
                                </span>
                            </div>
                            <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                    );
                })}
                {rows.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                        Add purchase metadata to inventory items to start tracking depreciation.
                    </p>
                )}
            </div>
        </div>
    );
};
