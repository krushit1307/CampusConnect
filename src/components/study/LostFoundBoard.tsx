import { useState } from "react";
import { SearchCircle, Plus, Trash2, X, MapPin, Clock, ThumbsUp } from "lucide-react";
import { useLostFound, CATEGORIES, STATUS_CONFIG } from "../../hooks/useLostFound";
import type { LostFoundItem, ItemStatus, ItemCategory } from "../../hooks/useLostFound";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHrs < 1) return "Just now";
  if (diffHrs < 24) return diffHrs + "h ago";
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return diffDays + "d ago";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface AddItemModalProps {
  onAdd: (data: Omit<LostFoundItem, "id" | "upvotes">) => void;
  onClose: () => void;
}

function AddItemModal({ onAdd, onClose }: AddItemModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ItemCategory>("other");
  const [status, setStatus] = useState<ItemStatus>("lost");
  const [location, setLocation] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [reward, setReward] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      description: description.trim(),
      category,
      status,
      location: location.trim(),
      dateReported: new Date().toISOString(),
      dateLostOrFound: new Date().toISOString(),
      contactName: contactName.trim(),
      contactInfo: contactInfo.trim(),
      reward: reward.trim(),
      imageUrl: "",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-sm font-bold text-slate-100">Report Item</h4>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"><X size={16} /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-2">
            {(["lost", "found"] as ItemStatus[]).map((s) => {
              const sc = STATUS_CONFIG[s];
              const active = status === s;
              return (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={"text-xs font-bold rounded-xl py-2.5 border transition-all " + (active ? sc.bg + " " + sc.color : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300")}>
                  {s === "lost" ? "\u{1F6A8} Lost" : "\u2705 Found"}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Item Name</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Blue iPhone 15" autoFocus
              className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details about the item..." rows={2}
              className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ItemCategory)}
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500">
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Library, Room 201..."
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Your Name</label>
              <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane D."
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Contact</label>
              <input type="text" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} placeholder="jane@campus.edu"
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Reward (optional)</label>
            <input type="text" value={reward} onChange={(e) => setReward(e.target.value)} placeholder="e.g. $20 gift card"
              className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} className="flex-1 text-xs text-slate-500 hover:text-slate-300 py-2.5 rounded-xl border border-slate-700 transition-colors">Cancel</button>
          <button type="submit" disabled={!title.trim()}
            className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-xs rounded-xl py-2.5 transition-colors">Post Item</button>
        </div>
      </form>
    </div>
  );
}

export default function LostFoundBoard() {
  const {
    filteredItems, stats, addItem, removeItem, upvoteItem, claimItem, clearAllData,
    statusFilter, setStatusFilter, categoryFilter, setCategoryFilter,
    searchTerm, setSearchTerm,
  } = useLostFound();

  const [showAddModal, setShowAddModal] = useState(false);

  const statusFilters: (ItemStatus | "all")[] = ["all", "lost", "found", "claimed"];
  const categoryFilters: (ItemCategory | "all")[] = ["all", "electronics", "clothing", "keys", "bags", "documents", "books", "jewelry"];

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-6 shadow-xl max-w-2xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/20">
            <SearchCircle size={18} className="text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Lost &amp; Found</h3>
            <p className="text-[10px] text-slate-500 font-mono">{stats.recentItems} new this week</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 text-xs font-bold rounded-xl px-3 py-2 transition-all">
            <Plus size={14} /> Report
          </button>
          <button onClick={clearAllData} className="p-2 rounded-xl hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="rounded-xl p-2.5 text-center border text-red-400 bg-red-500/10 border-red-500/20">
          <span className="text-sm block">{"\u{1F6A8}"}</span>
          <span className="text-sm font-black tabular-nums">{stats.lostItems}</span>
          <span className="text-[8px] font-mono block opacity-60">Lost</span>
        </div>
        <div className="rounded-xl p-2.5 text-center border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
          <span className="text-sm block">{"\u2705"}</span>
          <span className="text-sm font-black tabular-nums">{stats.foundItems}</span>
          <span className="text-[8px] font-mono block opacity-60">Found</span>
        </div>
        <div className="rounded-xl p-2.5 text-center border text-blue-400 bg-blue-500/10 border-blue-500/20">
          <span className="text-sm block">{"\u{1F389}"}</span>
          <span className="text-sm font-black tabular-nums">{stats.claimedItems}</span>
          <span className="text-[8px] font-mono block opacity-60">Claimed</span>
        </div>
        <div className="rounded-xl p-2.5 text-center border text-slate-400 bg-slate-500/10 border-slate-500/20">
          <span className="text-sm block">{"\u{1F4CB}"}</span>
          <span className="text-sm font-black tabular-nums">{stats.totalItems}</span>
          <span className="text-[8px] font-mono block opacity-60">Total</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <SearchCircle size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search items..."
          className="w-full bg-slate-800/60 border border-slate-700/40 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {statusFilters.map((s) => {
          const active = statusFilter === s;
          const sc = s !== "all" ? STATUS_CONFIG[s] : null;
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={"text-[10px] font-mono rounded-lg px-2.5 py-1 border transition-all " + (active ? (sc ? sc.bg + " " + sc.color : "bg-slate-700 border-slate-600 text-slate-200") : "bg-slate-800/50 border-slate-700/40 text-slate-500 hover:text-slate-300")}>
              {s === "all" ? "All" : sc?.label}
            </button>
          );
        })}
        <span className="text-slate-700 mx-1">|</span>
        {categoryFilters.map((c) => {
          const active = categoryFilter === c;
          const cat = c !== "all" ? CATEGORIES[c] : null;
          return (
            <button key={c} onClick={() => setCategoryFilter(c as ItemCategory | "all")}
              className={"text-[10px] font-mono rounded-lg px-2 py-1 border transition-all " + (active ? "bg-blue-500/15 border-blue-500/30 text-blue-400" : "bg-slate-800/50 border-slate-700/40 text-slate-500 hover:text-slate-300")}>
              {c === "all" ? "All Types" : (cat?.icon + " " + cat?.label)}
            </button>
          );
        })}
      </div>

      {/* Items */}
      {filteredItems.length > 0 ? (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const sc = STATUS_CONFIG[item.status];
            const cat = CATEGORIES[item.category];
            return (
              <div key={item.id} className={"p-4 rounded-xl border transition-all hover:border-slate-500 " + sc.bg}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-lg">{cat?.icon}</span>
                      <span className="text-sm font-bold text-slate-200">{item.title}</span>
                      <span className={"text-[9px] font-mono px-1.5 py-0.5 rounded-md border " + sc.bg + " " + sc.color}>{sc.label}</span>
                      <span className="text-[9px] text-slate-600">{cat?.label}</span>
                    </div>
                    {item.description && <p className="text-[10px] text-slate-500 mb-1.5 line-clamp-2">{item.description}</p>}
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
                      {item.location && <span className="flex items-center gap-1"><MapPin size={9} /> {item.location}</span>}
                      <span className="flex items-center gap-1"><Clock size={9} /> {formatDate(item.dateReported)}</span>
                      {item.reward && <span className="text-amber-400 font-bold">{"\u{1F381}"} {item.reward}</span>}
                    </div>
                    {item.contactInfo && (
                      <div className="mt-1.5 text-[10px] text-slate-600">
                        Contact: <span className="text-slate-400">{item.contactName}</span> &middot; <span className="text-blue-400">{item.contactInfo}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button onClick={() => upvoteItem(item.id)}
                      className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 text-slate-500 hover:text-blue-400 transition-all">
                      <ThumbsUp size={12} />
                      <span className="text-[9px] font-mono">{item.upvotes}</span>
                    </button>
                    {item.status === "found" && (
                      <button onClick={() => claimItem(item.id)}
                        className="px-2 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 text-[9px] font-bold transition-all">
                        Claim
                      </button>
                    )}
                    <button onClick={() => removeItem(item.id)}
                      className="p-1 rounded hover:bg-red-500/10 text-slate-700 hover:text-red-400 transition-colors">
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10">
          <SearchCircle size={32} className="mx-auto text-slate-700 mb-3" />
          <p className="text-xs text-slate-500 mb-1">
            {searchTerm || statusFilter !== "all" || categoryFilter !== "all"
              ? "No items match your filter"
              : "No items posted yet"}
          </p>
          <p className="text-[10px] text-slate-600">Click &quot;Report&quot; to post a lost or found item</p>
        </div>
      )}

      {showAddModal && <AddItemModal onAdd={addItem} onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
