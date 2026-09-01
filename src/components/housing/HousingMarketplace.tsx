import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Building2, Search, Map, Filter, MapPin, Grid, List as ListIcon, Home, DollarSign, Calendar
} from "lucide-react";
import {
    HousingFilters, HousingListing, fetchListings, getDefaultFilters, LeaseTerm, RoomType, ListingType
} from "../../services/HousingService";
import { ListingModal } from "./ListingModal";

export function HousingMarketplace() {
    const [filters, setFilters] = useState<HousingFilters>(getDefaultFilters());
    const [listings, setListings] = useState<HousingListing[]>([]);
    const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
    const [selectedListing, setSelectedListing] = useState<HousingListing | null>(null);
    const [successToast, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        setListings(fetchListings(filters));
    }, [filters]);

    const update = useCallback((partial: Partial<HousingFilters>) => {
        setFilters(f => ({ ...f, ...partial }));
    }, []);

    const handleSuccess = (msg: string) => {
        setSelectedListing(null);
        setSuccess(msg);
        setTimeout(() => setSuccess(null), 5000);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">

            {/* Top Navigation / Hero */}
            <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-white">Housing Hub</h1>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Subleases & Roommates</p>
                        </div>
                    </div>

                    <div className="flex p-1 bg-slate-800 rounded-lg">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-2 ${viewMode === 'grid' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Grid className="w-3.5 h-3.5" /> Grid
                        </button>
                        <button
                            onClick={() => setViewMode("map")}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-2 ${viewMode === 'map' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Map className="w-3.5 h-3.5" /> Map
                        </button>
                    </div>
                </div>
            </div>

            {successToast && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2">
                    {successToast}
                </div>
            )}

            {/* Toolbar */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by building, description, or keyword..."
                            value={filters.query}
                            onChange={e => update({ query: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>

                    {/* Filter dropdowns */}
                    <select
                        value={filters.type}
                        onChange={e => update({ type: e.target.value as ListingType | "all" })}
                        className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-indigo-500"
                    >
                        <option value="all">All Types</option>
                        <option value="sublease">Subleases Only</option>
                        <option value="roommate">Roommates Needed</option>
                    </select>

                    <select
                        value={filters.term}
                        onChange={e => update({ term: e.target.value as LeaseTerm | "all" })}
                        className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-indigo-500"
                    >
                        <option value="all">Any Term</option>
                        <option value="Summer">Summer</option>
                        <option value="Fall">Fall</option>
                        <option value="Spring">Spring</option>
                        <option value="Full Year">Full Year</option>
                    </select>

                    <select
                        value={filters.maxDistance}
                        onChange={e => update({ maxDistance: Number(e.target.value) })}
                        className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-indigo-500"
                    >
                        <option value="1">{"< 1 Mile"}</option>
                        <option value="3">{"< 3 Miles"}</option>
                        <option value="5">{"< 5 Miles"}</option>
                        <option value="10">Any Distance</option>
                    </select>
                </div>
            </div>

            {/* Main Content Area */}
            <div className={`max-w-7xl mx-auto px-4 sm:px-6 pb-20 ${viewMode === 'map' ? 'flex flex-col lg:flex-row gap-6 h-[800px] max-h-[70vh]' : ''}`}>

                {/* Map View Left Side */}
                {viewMode === "map" && (
                    <div className="lg:w-1/2 h-[400px] lg:h-full bg-slate-800 rounded-3xl overflow-hidden relative border border-slate-700 isolate shadow-lg">
                        <div className="absolute inset-0 bg-[#0f172a] opacity-80" style={{
                            backgroundImage: "url('https://maps.googleapis.com/maps/api/staticmap?center=40.7128,-74.0060&zoom=14&size=1000x1000&maptype=roadmap&style=feature:all|element:labels.text.fill|color:0x8ca6ce&style=feature:water|element:geometry|color:0x1e293b&style=feature:road|element:geometry|color:0x334155')",
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            zIndex: -1
                        }} />

                        {/* Mock Map Markers */}
                        {listings.map((l, idx) => (
                            <div key={l.id} className="absolute flex flex-col items-center group cursor-pointer"
                                style={{ top: `${20 + (idx * 15)}%`, left: `${30 + (idx % 2 === 0 ? 20 : -10)}%` }}
                                onClick={() => setSelectedListing(l)}>
                                <div className="px-2.5 py-1 bg-white text-slate-900 font-bold text-xs rounded-full shadow-lg shadow-black/50 group-hover:bg-indigo-500 group-hover:text-white transition-colors mb-1 pointer-events-none">
                                    ${l.pricePerMonth}
                                </div>
                                <MapPin className="w-6 h-6 text-indigo-500 fill-indigo-500 filter drop-shadow-md group-hover:text-indigo-400" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Listing Grid / Map Right Side */}
                <div className={`${viewMode === 'map' ? 'lg:w-1/2 overflow-y-auto pr-2 no-scrollbar' : 'w-full'}`}>

                    {/* Info Bar */}
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-slate-400 font-medium">Found <span className="text-white font-bold">{listings.length}</span> matching listings</p>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Sorted by Newest</p>
                    </div>

                    {listings.length === 0 ? (
                        <div className="mt-12 text-center p-12 bg-slate-900 border border-slate-800 rounded-3xl">
                            <Home className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-white mb-2">No listings found.</h3>
                            <p className="text-slate-400 text-sm">Expand your search radius or clear filters.</p>
                        </div>
                    ) : (
                        <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                            {listings.map(l => (
                                <div
                                    key={l.id}
                                    className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer flex flex-col"
                                    onClick={() => setSelectedListing(l)}
                                >
                                    <div className="h-44 bg-slate-800 relative overflow-hidden">
                                        <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <div className="absolute top-3 left-3 flex gap-2">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${l.type === 'sublease' ? 'bg-indigo-500/80 text-white border-indigo-400' : 'bg-emerald-500/80 text-white border-emerald-400'}`}>
                                                {l.type}
                                            </span>
                                        </div>
                                        {l.status === 'pending' && (
                                            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                                                <span className="bg-amber-500 text-black px-3 py-1 rounded-full text-xs font-black uppercase">Lease Pending</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-2 gap-2">
                                            <h3 className="font-bold text-white leading-tight line-clamp-2">{l.title}</h3>
                                            <p className="text-lg font-black text-emerald-400 shrink-0">${l.pricePerMonth}</p>
                                        </div>

                                        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium mb-3">
                                            <MapPin className="w-3.5 h-3.5" /> {l.location.distanceToCampusMiles} mi from campus
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mt-auto pt-3 border-t border-slate-800">
                                            <div className="flex items-center gap-1.5 text-slate-300 text-xs font-medium">
                                                <Home className="w-3.5 h-3.5 text-slate-500" /> {l.roomType}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-300 text-xs font-medium">
                                                <Calendar className="w-3.5 h-3.5 text-slate-500" /> {l.leaseTerm}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {selectedListing && (
                <ListingModal listing={selectedListing} onClose={() => setSelectedListing(null)} onSuccess={handleSuccess} />
            )}

        </div>
    )
}
