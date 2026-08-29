import React, { useEffect } from 'react';
import { useDepreciation } from '../../hooks/useDepreciation';
import { BalanceSheetView } from './BalanceSheet';
import { AssetList } from './AssetList';
import {
    Calculator,
    TrendingDown,
    AlertCircle,
    ShieldCheck,
    Activity
} from 'lucide-react';

interface DashboardProps {
    clubId: string;
}

export const TreasurerDashboard: React.FC<DashboardProps> = ({ clubId }) => {
    const {
        balanceSheet,
        inventory,
        loading,
        error,
        fetchBalanceSheet,
        fetchValuedInventory,
        kpis
    } = useDepreciation(clubId);

    useEffect(() => {
        // Load data on mount
        fetchBalanceSheet();
        fetchValuedInventory();
    }, [fetchBalanceSheet, fetchValuedInventory]);

    const formatShortVal = (val: number) => {
        if (val > 1000000) return `$${(val / 1000000).toFixed(2)}M`;
        if (val > 1000) return `$${(val / 1000).toFixed(1)}k`;
        return `$${Math.round(val)}`;
    };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full font-sans bg-gray-50/50 min-h-screen border-t border-gray-200">

            {/* Header */}
            <div className="mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center space-x-3">
                            <Calculator className="w-8 h-8 text-indigo-600" />
                            <span>Financial Asset & Depreciation Tracker</span>
                        </h1>
                        <p className="mt-2 text-sm text-gray-500 max-w-2xl">
                            Real-time tracking of capital inventory valuation based on accurate, automated Straight-Line Depreciation.
                            Automatically aligns with GAAP reporting requirements.
                        </p>
                    </div>

                    {/* Action buttons could go here */}
                    <div className="flex gap-2 text-sm">
                        <button
                            onClick={() => { fetchBalanceSheet(); fetchValuedInventory(); }}
                            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-gray-50 transition-colors"
                        >
                            Refresh Ledgers
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-8 bg-red-50 border border-red-200 p-4 rounded-xl flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-bold text-red-900">Database Sync Error</h4>
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                </div>
            )}

            {/* KPI Banner */}
            {kpis && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

                    {/* Total Book Value */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500"></div>
                        <p className="text-sm font-medium text-gray-500 relative z-10 mb-1">Total Net Book Value</p>
                        <h3 className="text-3xl font-black text-indigo-700 relative z-10">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(kpis.totalAssetValue)}
                        </h3>
                    </div>

                    {/* Total Historical */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 relative overflow-hidden group">
                        <p className="text-sm font-medium text-gray-500 relative z-10 mb-1">Original Purchase Value</p>
                        <h3 className="text-2xl font-bold text-gray-900 relative z-10 mt-1">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(kpis.totalHistoricalCost)}
                        </h3>
                    </div>

                    {/* Total Depreciated */}
                    <div className="bg-white rounded-xl shadow-sm border border-red-100 p-5 relative overflow-hidden group hover:border-red-200 transition-colors">
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
                            <TrendingDown className="w-12 h-12 text-red-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-500 relative z-10 mb-1">Value Lost to Depreciation</p>
                        <h3 className="text-2xl font-bold text-red-600 relative z-10 mt-1">
                            -{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(kpis.totalDepreciation)}
                        </h3>
                    </div>

                    {/* Health Score */}
                    <div className={`bg-white rounded-xl shadow-sm border p-5 relative overflow-hidden ${kpis.status === 'EXCELLENT' ? 'border-emerald-200' :
                            kpis.status === 'FAIR' ? 'border-amber-200' : 'border-red-200'
                        }`}>
                        <div className="flex justify-between items-start mb-1">
                            <p className="text-sm font-medium text-gray-500">Asset Profile Health</p>
                            {kpis.status === 'EXCELLENT' ? <ShieldCheck className="w-5 h-5 text-emerald-500" /> : <Activity className="w-5 h-5 text-amber-500" />}
                        </div>
                        <div className="flex items-end space-x-2">
                            <h3 className={`text-2xl font-bold ${kpis.status === 'EXCELLENT' ? 'text-emerald-700' :
                                    kpis.status === 'FAIR' ? 'text-amber-600' : 'text-red-700'
                                }`}>
                                {Math.round(kpis.healthScore)}
                            </h3>
                            <span className="text-sm text-gray-400 mb-1">/ 100</span>
                        </div>
                        <p className={`text-xs mt-1 font-medium ${kpis.status === 'EXCELLENT' ? 'text-emerald-600' :
                                kpis.status === 'FAIR' ? 'text-amber-600' : 'text-red-600'
                            }`}>
                            {kpis.status === 'EXCELLENT' ? 'Healthy capital lifespan remaining.' :
                                kpis.status === 'FAIR' ? 'Prepare for capital replacements soon.' :
                                    'Portfolio is severely aged.'}
                        </p>
                    </div>

                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Balance Sheet Panel */}
                <div className="flex flex-col space-y-6">
                    <BalanceSheetView data={balanceSheet} loading={loading} />

                    {/* Placeholder for future charting or visualization */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 text-center">
                        <Activity className="w-8 h-8 text-indigo-300 mx-auto mb-3" />
                        <h4 className="text-sm font-semibold text-indigo-900 mb-1">Depreciation Forecast Engine</h4>
                        <p className="text-xs text-indigo-700 max-w-sm mx-auto">
                            The visual straight-line trajectory graphs will be enabled in the V2 rollout.
                            The underlying mathematics are already functioning in the current system.
                        </p>
                    </div>
                </div>

                {/* Individual Asset Register */}
                <div className="flex flex-col">
                    <AssetList items={inventory} loading={loading} />
                </div>
            </div>

        </div>
    );
};
