import React, { useState } from "react";
import { X, BookOpen, Key, Edit3, Send, CheckCircle2, Bookmark, DollarSign } from "lucide-react";
import { TextbookListing, requestPurchase } from "../../services/TextbookService";

interface BookRequestModalProps {
    book: TextbookListing;
    onClose: () => void;
    onSuccess: (msg: string) => void;
}

export function BookRequestModal({ book, onClose, onSuccess }: BookRequestModalProps) {
    const [loading, setLoading] = useState(false);
    const savings = book.retailPrice - book.askingPrice;
    const savingPct = Math.round((savings / book.retailPrice) * 100);

    const handlePurchase = async () => {
        setLoading(true);
        try {
            const res = await requestPurchase(book.id);
            onSuccess(res.message);
        } catch {
            // Silent for mock
        } finally {
            setLoading(false);
        }
    }

    const conditionColors: Record<string, string> = {
        "Brand New": "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
        "Like New": "bg-indigo-500/20 text-indigo-400 border-indigo-500/50",
        "Good": "bg-sky-500/20 text-sky-400 border-sky-500/50",
        "Fair": "bg-amber-500/20 text-amber-400 border-amber-500/50",
        "Poor": "bg-rose-500/20 text-rose-400 border-rose-500/50",
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="relative w-full max-w-2xl bg-[#0f172a] border border-slate-700/60 rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden max-h-[90vh]">

                {/* Left Side cover */}
                <div className="md:w-5/12 bg-slate-900 border-r border-slate-700/50 p-6 flex flex-col items-center text-center relative isolate">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent -z-10" />
                    <p className="text-xs font-black tracking-widest uppercase text-slate-500 mb-6 w-full text-left">Condition</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border ${conditionColors[book.condition]}`}>
                        {book.condition}
                    </span>

                    <div className="w-32 h-44 bg-slate-800 rounded-xl shadow-2xl mb-6 relative overflow-hidden group">
                        <img src={book.images[0]} alt="Cover" className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-3">
                            <BookOpen className="w-6 h-6 text-white/50" />
                        </div>
                    </div>

                    <p className="text-sm font-bold text-slate-300">ISBN: <span className="text-white/60 font-mono tracking-wider">{book.isbn}</span></p>

                    <button onClick={onClose} className="absolute top-4 left-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white md:hidden">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Right side info */}
                <div className="flex-1 p-6 flex flex-col">
                    <button onClick={onClose} className="self-end p-2 rounded-full bg-slate-800/50 text-slate-400 hover:text-white transition-colors hidden md:block border border-slate-700">
                        <X className="w-4 h-4" />
                    </button>

                    <div className="mb-6 -mt-3">
                        <div className="flex gap-2 mb-2">
                            <span className="px-2 py-0.5 roundedbg-slate-800 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 uppercase border border-indigo-500/20">{book.courseCode}</span>
                            <span className="px-2 py-0.5 roundedbg-slate-800 text-[10px] font-bold text-slate-400 bg-slate-800 uppercase border border-slate-700">{book.edition}</span>
                        </div>
                        <h2 className="text-2xl font-black text-white leading-tight mb-2">{book.title}</h2>
                        <p className="text-sm text-slate-400 font-medium tracking-wide">{book.author}</p>
                    </div>

                    {/* Price block */}
                    <div className="flex items-center gap-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 mb-6">
                        <div>
                            <p className="text-3xl font-black text-emerald-400 flex items-center"><DollarSign className="w-6 h-6 mr-[-2px] opacity-70" />{book.askingPrice}</p>
                        </div>
                        <div className="w-px h-10 bg-slate-700/50" />
                        <div className="flex-1">
                            <p className="text-xs text-slate-500 font-bold uppercase mb-0.5">Retail: ${book.retailPrice}</p>
                            <p className="text-sm text-emerald-500/80 font-bold flex items-center gap-1">Save ${savings} ({savingPct}%)</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 mb-6 border-b border-slate-800 pb-6">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            <Key className={`w-4 h-4 ${book.hasAccessCode ? 'text-indigo-400' : 'text-slate-600'}`} />
                            {book.hasAccessCode ? "Includes Unused Access Code" : "No Access Code"}
                        </div>
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            <Edit3 className={`w-4 h-4 ${book.isAnnotated ? 'text-amber-400' : 'text-emerald-400'}`} />
                            {book.isAnnotated ? "Contains highlights/writing" : "Clean pages (No writing)"}
                        </div>
                    </div>

                    <p className="text-sm text-slate-400 leading-relaxed italic mb-8">"{book.description}"</p>

                    {/* Seller & Action */}
                    <div className="mt-auto flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <img src={book.sellerAvatar} className="w-10 h-10 rounded-full border border-slate-700 bg-slate-800" alt={book.sellerName} />
                            <div>
                                <p className="text-xs uppercase text-slate-500 font-bold">Seller</p>
                                <p className="text-sm font-bold text-white">{book.sellerName}</p>
                            </div>
                        </div>

                        <button
                            onClick={handlePurchase}
                            disabled={loading || book.status !== 'available'}
                            className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95"
                        >
                            {loading ? "Sending..." : "Request to Buy"} <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    )
}
