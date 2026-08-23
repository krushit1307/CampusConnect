import { useState } from "react";
import { BookOpen, Plus, Trash2, X, Star, Play, CheckCircle2, Ban, Search } from "lucide-react";
import { useReadingList, CATEGORIES } from "../../hooks/useReadingList";
import type { Book, BookStatus, BookCategory } from "../../hooks/useReadingList";

interface AddBookModalProps {
  onAdd: (data: Omit<Book, "id" | "dateAdded" | "dateStarted" | "dateFinished">) => void;
  onClose: () => void;
}

function AddBookModal({ onAdd, onClose }: AddBookModalProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState<BookCategory>("textbook");
  const [totalPages, setTotalPages] = useState(300);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ title: title.trim(), author: author.trim(), category, status: "to-read", totalPages, currentPage: 0, rating: 0, notes: "" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-sm font-bold text-slate-100">Add Book</h4>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"><X size={16} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title..." autoFocus className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Author</label>
            <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name..." className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as BookCategory)} className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200">
                {Object.entries(CATEGORIES).map(([k, v]) => (<option key={k} value={k}>{v.icon} {v.label}</option>))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Pages</label>
              <input type="number" min={1} value={totalPages} onChange={(e) => setTotalPages(Number(e.target.value))} className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 text-center" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} className="flex-1 text-xs text-slate-500 hover:text-slate-300 py-2.5 rounded-xl border border-slate-700">Cancel</button>
          <button type="submit" disabled={!title.trim()} className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-xs rounded-xl py-2.5">Add Book</button>
        </div>
      </form>
    </div>
  );
}

function StarRating({ rating, onRate }: { rating: number; onRate: (r: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} onClick={() => onRate(s)} className="transition-colors">
          <Star size={12} className={s <= rating ? "text-amber-400" : "text-slate-700"} fill={s <= rating ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

export default function ReadingListTracker() {
  const { filteredBooks, stats, addBook, removeBook, startReading, updateProgress, finishBook, abandonBook, rateBook, clearAllData, statusFilter, setStatusFilter, categoryFilter, setCategoryFilter, searchTerm, setSearchTerm } = useReadingList();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editPage, setEditPage] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState("");

  const statusFilters: (BookStatus | "all")[] = ["all", "reading", "to-read", "finished", "abandoned"];
  const categoryFilters: (BookCategory | "all")[] = ["all", "textbook", "novel", "research", "self-help", "reference"];

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-6 shadow-xl max-w-2xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20"><BookOpen size={18} className="text-emerald-500" /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Reading List</h3>
            <p className="text-[10px] text-slate-500 font-mono">{stats.totalBooks} books &middot; {stats.totalPagesRead} pages read</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 text-xs font-bold rounded-xl px-3 py-2"><Plus size={14} /> Add</button>
          <button onClick={clearAllData} className="p-2 rounded-xl hover:bg-red-500/10 text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5 text-center">
          <span className="text-sm font-black text-blue-400 block">{stats.booksReading}</span>
          <span className="text-[8px] font-mono text-slate-500">Reading</span>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center">
          <span className="text-sm font-black text-amber-400 block">{stats.booksToRead}</span>
          <span className="text-[8px] font-mono text-slate-500">To Read</span>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-center">
          <span className="text-sm font-black text-emerald-400 block">{stats.booksFinished}</span>
          <span className="text-[8px] font-mono text-slate-500">Finished</span>
        </div>
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-2.5 text-center">
          <span className="text-sm font-black text-violet-400 block">{stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "-"}</span>
          <span className="text-[8px] font-mono text-slate-500">Avg Rating</span>
        </div>
      </div>

      {/* Current Book */}
      {stats.currentBookTitle && (
        <div className="mb-4 bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono text-blue-400 uppercase">Currently Reading</span>
            <span className="text-[10px] font-mono text-slate-400">{stats.currentBookProgress}%</span>
          </div>
          <p className="text-xs text-slate-200 mb-2">{stats.currentBookTitle}</p>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all" style={{ width: stats.currentBookProgress + "%" }} />
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search books..." className="w-full bg-slate-800/60 border border-slate-700/40 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
      </div>

      <div className="flex gap-1 mb-4 flex-wrap">
        {statusFilters.map((s) => {
          const active = statusFilter === s;
          const label = s === "all" ? "All" : s.replace("-", " ");
          return (<button key={s} onClick={() => setStatusFilter(s)} className={"text-[10px] font-mono rounded-lg px-2 py-1 border capitalize " + (active ? "bg-blue-500/15 border-blue-500/30 text-blue-400" : "bg-slate-800/50 border-slate-700/40 text-slate-500")}>{label}</button>);
        })}
        <span className="text-slate-700 mx-1">|</span>
        {categoryFilters.map((c) => {
          const active = categoryFilter === c;
          const cat = c !== "all" ? CATEGORIES[c] : null;
          return (<button key={c} onClick={() => setCategoryFilter(c as BookCategory | "all")} className={"text-[10px] font-mono rounded-lg px-2 py-1 border " + (active ? "bg-blue-500/15 border-blue-500/30 text-blue-400" : "bg-slate-800/50 border-slate-700/40 text-slate-500")}>{c === "all" ? "All Types" : (cat?.icon + " " + cat?.label)}</button>);
        })}
      </div>

      {/* Books */}
      {filteredBooks.length > 0 ? (
        <div className="space-y-2">
          {filteredBooks.map((book) => {
            const cat = CATEGORIES[book.category];
            const progress = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
            const statusColor = book.status === "reading" ? "text-blue-400" : book.status === "finished" ? "text-emerald-400" : book.status === "abandoned" ? "text-red-400" : "text-amber-400";
            return (
              <div key={book.id} className="p-4 rounded-xl border border-slate-700/40 bg-slate-800/30 hover:border-slate-500 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{cat?.icon}</span>
                      <span className="text-sm font-bold text-slate-200">{book.title}</span>
                      <span className={"text-[9px] font-mono capitalize " + statusColor}>{book.status.replace("-", " ")}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-1">{book.author}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span>{book.currentPage} / {book.totalPages} pages</span>
                      {book.rating > 0 && <StarRating rating={book.rating} onRate={(r) => rateBook(book.id, r)} />}
                    </div>
                    {book.status === "reading" && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: progress + "%" }} />
                        </div>
                        <span className="text-[9px] font-mono text-slate-500">{progress}%</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    {book.status === "to-read" && (
                      <button onClick={() => startReading(book.id)} className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"><Play size={14} /></button>
                    )}
                    {book.status === "reading" && (
                      <>
                        {editPage === book.id ? (
                          <div className="flex gap-1">
                            <input type="number" value={pageInput} onChange={(e) => setPageInput(e.target.value)} className="w-14 bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-[10px] text-slate-200" autoFocus onKeyDown={(e) => { if (e.key === "Enter") { updateProgress(book.id, Number(pageInput)); setEditPage(null); } }} />
                            <button onClick={() => { updateProgress(book.id, Number(pageInput)); setEditPage(null); }} className="text-[9px] text-emerald-400">OK</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditPage(book.id); setPageInput(String(book.currentPage)); }} className="text-[9px] text-slate-500 hover:text-blue-400 font-mono">Edit pg</button>
                        )}
                        <button onClick={() => finishBook(book.id, 0)} className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"><CheckCircle2 size={14} /></button>
                        <button onClick={() => abandonBook(book.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400"><Ban size={12} /></button>
                      </>
                    )}
                    <button onClick={() => removeBook(book.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400"><Trash2 size={12} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10">
          <BookOpen size={32} className="mx-auto text-slate-700 mb-3" />
          <p className="text-xs text-slate-500 mb-1">{searchTerm || statusFilter !== "all" || categoryFilter !== "all" ? "No books match" : "No books yet"}</p>
          <p className="text-[10px] text-slate-600">Click &quot;Add&quot; to start your reading list</p>
        </div>
      )}

      {showAddModal && <AddBookModal onAdd={addBook} onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
