// =============================================================================
// Component: AssetDepreciationTable
// Issue: #3685 - Implement 'Automated "Event Equipment" Depreciation Tracker'
// Description: Detailed ledger of every tracked asset: age in months, monthly
// depreciation, accumulated depreciation and current book value.
// =============================================================================

import React from 'react';
import { AssetDepreciationRow } from '../../hooks/useAssetDepreciation';

interface AssetDepreciationTableProps {
    rows: AssetDepreciationRow[];
}

export const AssetDepreciationTable: React.FC<AssetDepreciationTableProps> = ({ rows }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            {['Asset', 'Age (mo)', 'Lifespan (mo)', 'Monthly Dep.', 'Accumulated', 'Book Value', 'Health'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {rows.map(row => (
                            <tr key={row.item_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.item_name}</td>
                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.months_active}</td>
                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.lifespan_months}</td>
                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                    ${((Number(row.purchase_price) / Math.max(1, row.lifespan_months))).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                    ${(Number(row.purchase_price) - Number(row.book_value)).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                                    ${Number(row.book_value).toLocaleString()}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.remaining_value_pct < 20
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                            : row.remaining_value_pct < 50
                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                                : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                        }`}>
                                        {row.remaining_value_pct}%
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
