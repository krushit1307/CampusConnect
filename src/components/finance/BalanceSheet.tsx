import React from 'react';
import { ClubBalanceSheet, BalanceSheetCategory } from '../../types/finance';
import { FileText, TrendingDown, DollarSign } from 'lucide-react';

interface BalanceSheetProps {
    data: ClubBalanceSheet | null;
    loading: boolean;
}

const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export const BalanceSheetView: React.FC<BalanceSheetProps> = ({ data, loading }) => {
    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow border border-gray-100 p-6 w-full animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-10 bg-gray-100 rounded"></div>
                    <div className="h-10 bg-gray-100 rounded"></div>
                    <div className="h-10 bg-gray-100 rounded"></div>
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden w-full font-sans">
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <div className="flex items-center space-x-3">
                    <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Capital Asset Balance Sheet (GAAP)</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            As of {new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(data.as_of_date))}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <button className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors bg-white px-3 py-1.5 rounded-lg border border-indigo-200 shadow-sm">
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Asset Category</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Historical Cost</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Accumulated Depreciation</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-900 uppercase tracking-wider bg-gray-100">Net Book Value</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {data.categories.map((cat, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cat.category}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatCurrency(cat.historical_cost_total)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500 font-medium text-right flex items-center justify-end space-x-1">
                                    <TrendingDown className="w-3 h-3" />
                                    <span>{formatCurrency(cat.accumulated_depreciation)}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right bg-gray-50/50">
                                    {formatCurrency(cat.net_book_value)}
                                </td>
                            </tr>
                        ))}

                        {/* Empty state padding if few items */}
                        {data.categories.length < 3 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 border-t-0 bg-white"></td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-900 uppercase">Total Capital Assets</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-700 text-right">{formatCurrency(data.grand_total.historical_cost_total)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 text-right">{formatCurrency(data.grand_total.accumulated_depreciation)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-base font-black text-indigo-900 text-right flex items-center justify-end">
                                <DollarSign className="w-4 h-4 mr-0.5" />
                                {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(data.grand_total.net_book_value)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                    Depreciation calculated using Straight-Line Method based on Standard Asset Class Lifespans.
                </p>
                <p className="text-xs font-mono text-gray-300">
                    REF: B/S-{Date.now().toString().slice(-6)}
                </p>
            </div>
        </div>
    );
};
