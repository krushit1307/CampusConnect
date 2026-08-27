import { useState } from "react";
import { StickyNote, Plus, Trash2, X, ThumbsUp, Bookmark, Tag, Clock, Search } from "lucide-react";
import { useCampusNotes, CATEGORIES } from "../../hooks/useCampusNotes";
import type { CampusNote, NoteCategory } from "../../hooks/useCampusNotes";

function fmtDate(s: string): string {
  const d = new Date(s); const n = new Date();
  const h = Math.floor((n.getTime() - d.getTime()) / 3600000);
  if (h < 1) return "Just now"; if (h < 24) return h + "h ago";
  const dy = Math.floor(h / 24); if (dy === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AddNoteModal({ onAdd, onClose }: { onAdd: (d: Omit<CampusNote, "id"|"upvotes"|"isBookmarked"|"datePosted">) => void; onClose: () => void }) {
  const [t, setT] = useState(""); const [c, setC] = useState("");
  const [cat, setCat] = useState<NoteCategory>("lecture"); const [cc, setCc] = useState("");
  const [a, setA] = useState(""); const [tg, setTg] = useState("");
  const sub = (e: React.FormEvent) => { e.preventDefault(); if (!t.trim()||!c.trim()) return;
    onAdd({ title:t.trim(), content:c.trim(), category:cat, courseCode:cc.trim(), author:a.trim()||"Anonymous", tags:tg.split(",").map(x=>x.trim()).filter(Boolean) }); onClose(); };
  return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <form onSubmit={sub} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
      <div className="flex items-center justify-between mb-5"><h4 className="text-sm font-bold text-slate-100">Share a Note</h4><button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"><X size={16} /></button></div>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1"><label className="text-[10px] font-mono text-slate-400 uppercase">Title</label>
          <input type="text" value={t} onChange={e=>setT(e.target.value)} placeholder="Key concepts from Week 5" autoFocus className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1"><label className="text-[10px] font-mono text-slate-400 uppercase">Category</label>
            <select value={cat} onChange={e=>setCat(e.target.value as NoteCategory)} className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200">
              {Object.entries(CATEGORIES).map(([k,v])=>(<option key={k} value={k}>{v.icon} {v.label}</option>))}</select></div>
          <div className="flex flex-col gap-1"><label className="text-[10px] font-mono text-slate-400 uppercase">Course</label>
            <input type="text" value={cc} onChange={e=>setCc(e.target.value)} placeholder="CS101" className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600" /></div>
        </div>
        <div className="flex flex-col gap-1"><label className="text-[10px] font-mono text-slate-400 uppercase">Name</label>
          <input type="text" value={a} onChange={e=>setA(e.target.value)} placeholder="Anonymous" className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600" /></div>
        <div className="flex flex-col gap-1"><label className="text-[10px] font-mono text-slate-400 uppercase">Content</label>
          <textarea value={c} onChange={e=>setC(e.target.value)} placeholder="Share your notes..." rows={5} className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 resize-none" /></div>
        <div className="flex flex-col gap-1"><label className="text-[10px] font-mono text-slate-400 uppercase">Tags (comma sep)</label>
          <input type="text" value={tg} onChange={e=>setTg(e.target.value)} placeholder="midterm, vectors" className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600" /></div>
      </div>
      <div className="flex gap-2 mt-5">
        <button type="button" onClick={onClose} className="flex-1 text-xs text-slate-500 hover:text-slate-300 py-2.5 rounded-xl border border-slate-700">Cancel</button>
        <button type="submit" disabled={!t.trim()||!c.trim()} className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-xs rounded-xl py-2.5">Post Note</button>
      </div>
    </form>
  </div>);
}

export default function NotesSharingBoard() {
  const { filteredNotes: fn, stats, addNote, removeNote, upvoteNote, toggleBookmark, clearAllData, categoryFilter: cf, setCategoryFilter: scf, searchTerm: st, setSearchTerm: sst, sortBy: sb, setSortBy: ssb } = useCampusNotes();
  const [showAdd, setShowAdd] = useState(false);
  const [exp, setExp] = useState<string|null>(null);
  const cfs: (NoteCategory|"all")[] = ["all","lecture","study-tip","exam-prep","resource","question"];

  return (<div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-6 shadow-xl max-w-2xl w-full mx-auto">
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/20"><StickyNote size={18} className="text-amber-500" /></div>
        <div><h3 className="text-sm font-bold text-slate-100">Campus Notes</h3><p className="text-[10px] text-slate-500 font-mono">{stats.totalNotes} notes</p></div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={()=>setShowAdd(true)} className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 text-xs font-bold rounded-xl px-3 py-2"><Plus size={14} /> Share</button>
        <button onClick={clearAllData} className="p-2 rounded-xl hover:bg-red-500/10 text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
      </div>
    </div>
    <div className="flex gap-2 mb-3">
      <div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
        <input type="text" value={st} onChange={e=>sst(e.target.value)} placeholder="Search notes..." className="w-full bg-slate-800/60 border border-slate-700/40 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-300 placeholder-slate-600" /></div>
      <button onClick={()=>ssb(sb==="recent"?"popular":"recent")} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-500">{sb==="recent"?"Recent":"Popular"}</button>
    </div>
    <div className="flex gap-1 mb-4 flex-wrap">{cfs.map(c=>{const a=cf===c;const ct=c!=="all"?CATEGORIES[c]:null;
      return(<button key={c} onClick={()=>scf(c as NoteCategory|"all")} className={"text-[10px] font-mono rounded-lg px-2 py-1 border "+(a?"bg-blue-500/15 border-blue-500/30 text-blue-400":"bg-slate-800/50 border-slate-700/40 text-slate-500")}>{c==="all"?"All":(ct?.icon+" "+ct?.label)}</button>);})}</div>
    {fn.length>0?(<div className="space-y-2">{fn.map(n=>{const ct=CATEGORIES[n.category];const ie=exp===n.id;
      return(<div key={n.id} className="p-4 rounded-xl border border-slate-700/40 bg-slate-800/30 hover:border-slate-500 transition-all"><div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button onClick={()=>upvoteNote(n.id)} className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg bg-slate-800/40 hover:bg-blue-500/15 text-slate-500 hover:text-blue-400"><ThumbsUp size={12} /><span className="text-[9px] font-mono">{n.upvotes}</span></button>
          <button onClick={()=>toggleBookmark(n.id)} className={"p-1 rounded "+(n.isBookmarked?"text-amber-400":"text-slate-700 hover:text-amber-400")}><Bookmark size={12} fill={n.isBookmarked?"currentColor":"none"} /></button></div>
        <div className="flex-1 min-w-0">
          <p className={"text-xs text-slate-400 whitespace-pre-wrap " + (ie?"":"line-clamp-2")}>{n.content}</p>
          {n.content.length>150&&<button onClick={()=>setExp(ie?null:n.id)} className="text-[10px] text-blue-400 mt-1">{ie?"Show less":"Read more"}</button>}
          {n.tags.length>0&&<div className="flex gap-1 mt-2 flex-wrap">{n.tags.map(tg=>(<span key={tg} className="flex items-center gap-0.5 text-[9px] bg-slate-800/60 text-slate-500 px-1.5 py-0.5 rounded"><Tag size={8} /> {tg}</span>))}</div>}
        </div>
        <button onClick={()=>removeNote(n.id)} className="p-1 rounded hover:bg-red-500/10 text-slate-700 hover:text-red-400 shrink-0"><Trash2 size={12} /></button>
      </div></div>);})}</div>):(<div className="text-center py-10"><StickyNote size={32} className="mx-auto text-slate-700 mb-3" /><p className="text-xs text-slate-500">{st||cf!=="all"?"No notes match":"No notes yet"}</p></div>)}
    {showAdd&&<AddNoteModal onAdd={addNote} onClose={()=>setShowAdd(false)} />}
  </div>);
}
