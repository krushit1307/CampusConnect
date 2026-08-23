import React from 'react';
import { InventoryItemWithValuation } from '../../types/finance';
import { HardDrive, AlertTriangle, CheckCircle, Package } from 'lucide-react';

interface AssetListProps {
    items: InventoryItemWithValuation[];
    loading: boolean;
}

const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export const AssetList: React.FC<AssetListProps> = ({ items, loading }) => {

    const getConditionBadge = (condition: string) => {
        switch (condition) {
            case 'NEW':
            case 'EXCELLENT':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800"><CheckCircle className="w-3 h-3 mr-1" /> {condition}</span>;
            case 'GOOD':
            case 'FAIR':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">{condition}</span>;
            case 'POOR':
            case 'BROKEN':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1" /> {condition}</span>;
            default:
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{condition}</span>;
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow border border-gray-100 p-8 flex flex-col items-center justify-center min-h-[300px]">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="mt-4 text-sm text-gray-500 font-medium">Loading inventory valuation...</p>
            </div>
        );
    }

    if (!items.length) {
        return (
            <div className="bg-white rounded-xl shadow border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
                <Package className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No capital assets found</h3>
                <p className="mt-2 text-sm text-gray-500 max-w-sm">
                    Items with a purchase price and asset class will appear here with dynamic depreciation calculations.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <HardDrive className="w-5 h-5 text-indigo-600 mr-2" />
                    Individual Asset Valuation Register
                </h3>
            </div>

            <ul className="divide-y divide-gray-100">
                {items.map((item) => (
                    <li key={item.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

                            <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-1">
                                    <h4 className="text-base font-bold text-gray-900">{item.name}</h4>
                                    {getConditionBadge(item.condition_status)}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 mt-2">
                                    <span className="flex items-center">
                                        <span className="font-semibold text-gray-700 mr-1">Class:</span>
                                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{item.asset_class}</span>
                                    </span>
                                    <span>
                                        <span className="font-semibold text-gray-700 mr-1">Purchased:</span>
                                        {item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex bg-white rounded-lg border border-gray-200 shadow-sm divide-x divide-gray-100 overflow-hidden w-full lg:w-auto">
                                <div className="px-4 py-3 bg-gray-50/50">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Purchase Price</p>
                                    <p className="text-sm font-semibold text-gray-900">
                                        {item.purchase_price ? formatCurrency(item.purchase_price) : 'N/A'}
                                    </p>
                                </div>

                                <div className="px-4 py-3 bg-indigo-50/30">
                                    <p className="text-xs font-bold text-indigo-900 uppercase tracking-wide mb-1">Net Book Value</p>
                                    <p className="text-lg font-black text-indigo-700">
                                        {formatCurrency(item.net_book_value)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Lifecycle Progress Bar */}
                        <div className="mt-5">
                            <div className="flex justify-between text-xs font-medium text-gray-500 mb-1.5">
                                <span>Lifecycle Consumed</span>
                                <span>{item.percent_lifespan_used}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden shadow-inner">
                                <div
                                    className={`h-2 rounded-full transition-all duration-1000 ${item.percent_lifespan_used > 90 ? 'bg-red-500' :
                                            item.percent_lifespan_used > 75 ? 'bg-amber-400' :
                                                'bg-emerald-500'
                                        }`}
                                    style={{ width: `${Math.min(100, item.percent_lifespan_used)}%` }}
                                ></div>
                            </div>
                            {item.percent_lifespan_used >= 100 && (
                                <p className="text-xs text-red-600 font-medium mt-2 flex items-center">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Asset is fully depreciated to salvage value. Consider replacement.
                                </p>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};
