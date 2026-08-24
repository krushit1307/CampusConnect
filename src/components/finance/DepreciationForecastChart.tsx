import React, { useMemo } from 'react';
import { AssetForecast, AssetClass, InventoryItem } from '../../types/finance';
import { useDepreciation } from '../../hooks/useDepreciation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingDown, Calendar, DollarSign } from 'lucide-react';

interface ForecastChartProps {
    clubId: string;
    item: InventoryItem;
    assetClass: AssetClass;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-4 border border-gray-200 shadow-xl rounded-xl">
                <p className="text-sm font-bold text-gray-900 mb-2 border-b border-gray-100 pb-2">{label}</p>
                <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium">
                        Book Value: <span className="text-indigo-600 font-bold ml-1">{formatCurrency(payload[0].value)}</span>
                    </p>
                    {payload[0].payload.depreciation_expense > 0 && (
                        <p className="text-xs text-gray-500 font-medium">
                            Annual Discard: <span className="text-red-500 font-bold ml-1">-{formatCurrency(payload[0].payload.depreciation_expense)}</span>
                        </p>
                    )}
                </div>
            </div>
        );
    }
    return null;
};

export const DepreciationForecastChart: React.FC<ForecastChartProps> = ({ clubId, item, assetClass }) => {
    const { generateForecast } = useDepreciation(clubId);

    const data = useMemo<AssetForecast[]>(() => {
        return generateForecast(item, assetClass);
    }, [item, assetClass, generateForecast]);

    if (!data.length) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500">
                Cannot generate forecast without valid purchase data.
            </div>
        );
    }

    const salvageValue = data[data.length - 1].value;
    const isFullyDepreciated = data.findIndex(d => new Date(d.date).getTime() < Date.now()) === data.length - 1;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden w-full font-sans mb-6">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                        <TrendingDown className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-md font-bold text-gray-900">Lifecycle Trajectory: {item.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {assetClass.lifespan_years}-Year Lifespan Schedule
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-4 text-sm bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-400 font-medium uppercase">Expected Salvage</span>
                        <span className="font-bold text-gray-900">{formatCurrency(salvageValue)}</span>
                    </div>
                    <div className="w-px h-8 bg-gray-200"></div>
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-400 font-medium uppercase">Depreciation Model</span>
                        <span className="font-bold text-gray-900">Straight-Line</span>
                    </div>
                </div>
            </div>

            <div className="p-6 relative">
                {isFullyDepreciated && (
                    <div className="absolute top-8 right-8 z-10 bg-red-100 text-red-800 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center shadow-sm">
                        <DollarSign className="w-4 h-4 mr-1" /> Fully Depreciated
                    </div>
                )}

                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={data}
                            margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                        >
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(val) => new Date(val).getFullYear().toString()}
                                stroke="#9ca3af"
                                fontSize={12}
                                tickMargin={10}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                stroke="#9ca3af"
                                fontSize={12}
                                tickFormatter={(val) => `$${val}`}
                                axisLine={false}
                                tickLine={false}
                                width={60}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#4f46e5"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorValue)"
                                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-6 border-t border-gray-100 pt-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        {data.map((point) => (
                            <div key={point.year} className="bg-gray-50 rounded p-3">
                                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Year {point.year}</p>
                                <p className="text-sm font-bold text-gray-900">{formatCurrency(point.value)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
