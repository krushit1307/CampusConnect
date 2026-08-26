import React, { useState } from "react";
import {
    X, MapPin, Calendar, Home, DollarSign, Edit3, Send, CheckCircle2, ShieldCheck, PawPrint, Users, Volume2, Sparkles, CigaretteOff, BadgeAlert
} from "lucide-react";
import { HousingListing, requestTour } from "../../services/HousingService";

interface ListingModalProps {
    listing: HousingListing;
    onClose: () => void;
    onSuccess: (msg: string) => void;
}

export function ListingModal({ listing, onClose, onSuccess }: ListingModalProps) {
    const [msgCode, setMsgCode] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        setLoading(true);
        try {
            const res = await requestTour(listing.id, msgCode);
            onSuccess(res.message);
        } catch {
            // Silent error for mock
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden max-h-[90vh]">

                {/* Left: Image & Quick Stats */}
                <div className="md:w-5/12 bg-slate-800 relative">
                    <img src={listing.images[0]} alt="Property" className="w-full h-48 md:h-full object-cover opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-slate-900 via-slate-900/40 to-transparent p-6 flex flex-col justify-end">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider w-max mb-3 ${listing.type === 'sublease' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'}`}>
                            {listing.type}
                        </span>
                        <h2 className="text-2xl font-black text-white leading-tight mb-2">{listing.title}</h2>
                        <div className="flex items-center gap-1.5 text-white/70 text-sm font-medium">
                            <MapPin className="w-4 h-4 text-rose-400" /> {listing.location.name} ({listing.location.distanceToCampusMiles} mi)
                        </div>
                    </div>

                    <button onClick={onClose} className="absolute top-4 left-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 md:hidden">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Right: Details & Contact */}
                <div className="flex-1 p-6 md:p-8 overflow-y-auto no-scrollbar relative flex flex-col">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full bg-slate-800 text-white/50 hover:text-white transition-colors hidden md:block">
                        <X className="w-5 h-5" />
                    </button>

                    {/* Price Row */}
                    <div className="flex gap-6 border-b border-slate-800 pb-6 mb-6">
                        <div>
                            <p className="text-xs uppercase font-bold text-slate-500 mb-1">Rent</p>
                            <p className="text-2xl font-black text-white flex items-center"><DollarSign className="w-5 h-5 text-emerald-400" />{listing.pricePerMonth}<span className="text-sm text-slate-500 font-medium ml-1">/mo</span></p>
                        </div>
                        <div className="w-px bg-slate-800" />
                        <div>
                            <p className="text-xs uppercase font-bold text-slate-500 mb-1">Move-in Date</p>
                            <p className="text-lg font-bold text-white flex items-center gap-2"><Calendar className="w-4 h-4 text-indigo-400" /> {new Date(listing.moveInDate).toLocaleDateString()}</p>
                        </div>
                    </div>

                    {/* Author Strip */}
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 mb-6">
                        <img src={listing.authorAvatar} alt={listing.authorName} className="w-12 h-12 rounded-full border-2 border-slate-700" />
                        <div>
                            <p className="text-sm font-bold text-white flex items-center gap-1.5">{listing.authorName} <ShieldCheck className="w-4 h-4 text-sky-400" /></p>
                            <p className="text-xs text-slate-400 font-medium">{listing.authorDept} · {listing.authorYear}</p>
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-slate-300 leading-relaxed mb-6">{listing.description}</p>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Amenities</p>
                            <ul className="space-y-1">
                                {listing.amenities.slice(0, 4).map(a => <li key={a} className="text-xs font-medium text-slate-300 flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> {a}</li>)}
                            </ul>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Roommate Vibe</p>
                            <ul className="space-y-1">
                                <li className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                                    <PawPrint className={`w-3 h-3 ${listing.preferences.petsAllowed ? 'text-emerald-400' : 'text-slate-500'}`} /> {listing.preferences.petsAllowed ? "Pets OK" : "No Pets"}
                                </li>
                                <li className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                                    <Volume2 className="w-3 h-3 text-indigo-400" /> Noise: {listing.preferences.noiseLevel}/5
                                </li>
                                <li className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3 text-amber-400" /> Clean: {listing.preferences.cleanliness}/5
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="mt-auto">
                        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 focus-within:border-indigo-500 transition-colors">
                            <textarea
                                rows={2}
                                placeholder={`Send a quick message to ${listing.authorName}...`}
                                value={msgCode}
                                onChange={(e) => setMsgCode(e.target.value)}
                                className="w-full bg-transparent text-sm text-white focus:outline-none resize-none placeholder-slate-500"
                            />
                            <div className="flex justify-between items-center mt-2">
                                <p className="text-[10px] uppercase font-bold text-slate-500">Replies go to your Inbox</p>
                                <button
                                    onClick={handleSend}
                                    disabled={loading || msgCode.length < 5}
                                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {loading ? "Sending..." : "Send Message"} <Send className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
