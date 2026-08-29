import React, { useState, useEffect, useCallback } from "react";
import {
    BookMarked, Search, Filter, Bookmark, DollarSign, BookOpen, Clock, Tag
} from "lucide-react";
import {
    TextbookFilters, TextbookListing, fetchTextbooks, getDefaultFilters, BookCondition, AcademicSubject
} from "../../services/TextbookService";
import { BookRequestModal } from "./BookRequestModal";

export function TextbookMarketplace() {
    const [filters, setFilters] = useState<TextbookFilters>(getDefaultFilters());
    const [books, setBooks] = useState<TextbookListing[]>([]);
    const [selectedBook, setSelectedBook] = useState<TextbookListing | null>(null);
    const [successToast, setSuccessToast] = useState<string | null>(null);
    const [savedCounter, setSavedCounter] = useState(0);

    useEffect(() => { setBooks(fetchTextbooks(filters)); }, [filters]);

    const updateFilter = useCallback((partial: Partial<TextbookFilters>) => {
        setFilters(f => ({ ...f, ...partial }));
    }, []);

    const handleSuccess = (msg: string) => {
        setSelectedBook(null);
        setSuccessToast(msg);
        setBooks(fetchTextbooks(filters)); // Refresh to see "pending"
        setTimeout(() => setSuccessToast(null), 5000);
    };

    const conditionColors: Record<string, string> = {
        "Brand New": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        "Like New": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
        "Good": "bg-sky-500/20 text-sky-400 border-sky-500/30",
        "Fair": "bg-amber-500/20 text-amber-400 border-amber-500/30",
        "Poor": "bg-rose-500/20 text-rose-400 border-rose-500/30",
    };

    const subjects: AcademicSubject[] = ["Computer Science", "Mathematics", "Biology", "Physics", "Business", "History", "Literature"];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">

            {/* Top Navigation / Hero */}
            <div className="bg-[#0b1121] border-b border-slate-800/80 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <BookMarked className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-white leading-tight">Used Textbooks</h1>
                            <p className="text-xs tracking-wider text-slate-400 font-bold uppercase mt-1">Campus Exchange Hub</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 border border-slate-800 bg-slate-900/50 px-3 py-1.5 rounded-lg border-dashed">
                            <Bookmark className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold text-slate-300">You saved: <span className="text-emerald-400">${savedCounter}</span></span>
                        </div>
                        <button className="hidden sm:flex bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-2 px-5 rounded-xl transition-all shadow-lg flex-center items-center gap-2 text-sm shadow-indigo-500/20">
                            Sell a Book
                        </button>
                    </div>
                </div>
            </div>

            {successToast && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/90 backdrop-blur border border-emerald-400 text-white px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-2">
                    {successToast}
                </div>
            )}

            {/* Toolbar */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800 shadow-md">

                    {/* Search */}
                    <div className="relative md:w-1/3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search Title, Author, or ISBN..."
                            value={filters.query}
                            onChange={e => updateFilter({ query: e.target.value })}
                            className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <select
                            value={filters.subject}
                            onChange={e => updateFilter({ subject: e.target.value as AcademicSubject | "all" })}
                            className="bg-slate-950/80 border border-slate-700/60 rounded-xl px-3 py-3 text-sm font-medium focus:outline-none focus:border-indigo-500"
                        >
                            <option value="all">Any Subject</option>
                            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>

                        <select
                            value={filters.condition}
                            onChange={e => updateFilter({ condition: e.target.value as BookCondition | "all" })}
                            className="bg-slate-950/80 border border-slate-700/60 rounded-xl px-3 py-3 text-sm font-medium focus:outline-none focus:border-indigo-500"
                        >
                            <option value="all">Any Condition</option>
                            <option value="Brand New">Brand New</option>
                            <option value="Like New">Like New</option>
                            <option value="Good">Good</option>
                            <option value="Fair">Fair / Poor</option>
                        </select>

                        <div className="col-span-2 flex items-center justify-between bg-slate-950/80 border border-slate-700/60 rounded-xl px-4 py-3">
                            <label className="text-xs font-bold uppercase text-slate-500">Max Price: <span className="text-white">${filters.maxPrice}</span></label>
                            <input
                                type="range" min="10" max="250" step="10"
                                value={filters.maxPrice}
                                onChange={e => updateFilter({ maxPrice: Number(e.target.value) })}
                                className="w-1/2 accent-indigo-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Book Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
                <div className="flex items-center justify-between mb-6">
                    <p className="text-sm font-medium text-slate-400">Found <span className="text-white font-bold">{books.length}</span> books</p>
                </div>

                {books.length === 0 ? (
                    <div className="mt-8 text-center p-16 bg-slate-900/30 border border-slate-800/80 rounded-3xl border-dashed">
                        <BookOpen className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">No textbooks found</h3>
                        <p className="text-slate-400 text-sm">Try broadening your search or modifying filters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {books.map(book => (
                            <div
                                key={book.id}
                                className="group bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden hover:border-indigo-500/40 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all cursor-pointer flex flex-col relative"
                                onClick={() => setSelectedBook(book)}
                            >
                                <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
                                    <span className="bg-indigo-500 text-white font-black px-3 py-1 rounded-full text-lg shadow-lg border border-indigo-400/50">
                                        ${book.askingPrice}
                                    </span>
                                    <span className="bg-slate-900/80 backdrop-blur-md text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px] uppercase border border-emerald-500/30 line-through decoration-emerald-800">
                                        Ret. ${book.retailPrice}
                                    </span>
                                </div>

                                <div className="h-48 bg-gradient-to-t from-slate-900 to-slate-800 relative flex items-center justify-center p-4">
                                    <img src={book.images[0]} alt={book.title} className="max-h-full max-w-full rounded-md shadow-2xl group-hover:-translate-y-2 group-hover:scale-105 transition-all duration-300" />

                                    {book.status === 'pending' && (
                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-20">
                                            <span className="bg-amber-500 text-black px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg">Purchase Pending</span>
                                        </div>
                                    )}
                                </div>

                                <div className="p-5 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-3 gap-2">
                                        <span className="px-2 py-1 rounded-md bg-slate-800 text-[10px] font-bold text-slate-300 uppercase tracking-wider">{book.courseCode}</span>
                                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${conditionColors[book.condition]} whitespace-nowrap`}>
                                            {book.condition}
                                        </span>
                                    </div>

                                    <h3 className="font-bold text-white text-lg leading-tight mb-1 group-hover:text-indigo-300 transition-colors">{book.title}</h3>
                                    <p className="text-sm text-slate-500 font-medium mb-4">{book.author} · {book.edition}</p>


                                    <div className="mt-auto pt-4 border-t border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <img src={book.sellerAvatar} className="w-6 h-6 rounded-full bg-slate-800" alt="seller" />
                                            <span className="text-xs text-slate-400 font-medium">{book.sellerName}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedBook && (
                <BookRequestModal
                    book={selectedBook}
                    onClose={() => setSelectedBook(null)}
                    onSuccess={(msg) => {
                        handleSuccess(msg);
                        setSavedCounter(prev => prev + (selectedBook.retailPrice - selectedBook.askingPrice));
                    }}
                />
            )}
        </div>
    )
}
