import { useState } from "react";
import { Phone, Plus, Trash2, X, Star, Pin, MapPin, Clock, Mail, Heart } from "lucide-react";
import { useEmergencyContacts, CATEGORIES } from "../../hooks/useEmergencyContacts";
import type { EmergencyContact, ContactCategory } from "../../hooks/useEmergencyContacts";

interface AddContactModalProps {
  onAdd: (data: Omit<EmergencyContact, "id">) => void;
  onClose: () => void;
}

function AddContactModal({ onAdd, onClose }: AddContactModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ContactCategory>("other");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    onAdd({ name: name.trim(), category, phone: phone.trim(), email: email.trim(), location: location.trim(), hours: hours.trim(), description: description.trim(), isFavorite: false, isPinned: false, isCustom: true });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-sm font-bold text-slate-100">Add Contact</h4>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"><X size={16} /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Campus Library" autoFocus className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ContactCategory)} className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200">
                {Object.entries(CATEGORIES).map(([k, v]) => (<option key={k} value={k}>{v.icon} {v.label}</option>))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000" className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="office@campus.edu" className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Building..." className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Hours</label>
            <input type="text" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Mon-Fri 9am-5pm" className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What they help with..." rows={2} className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} className="flex-1 text-xs text-slate-500 hover:text-slate-300 py-2.5 rounded-xl border border-slate-700">Cancel</button>
          <button type="submit" disabled={!name.trim() || !phone.trim()} className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-xs rounded-xl py-2.5">Add Contact</button>
        </div>
      </form>
    </div>
  );
}

function ContactCard({ contact, onToggleFavorite, onTogglePinned, onRemove }: {
  contact: EmergencyContact;
  onToggleFavorite: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const cat = CATEGORIES[contact.category];
  const phoneHref = "tel:" + contact.phone.replace(/[^0-9+]/g, "");
  return (
    <div className={"p-4 rounded-xl border transition-all hover:border-slate-500 " + cat.bg}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{cat?.icon}</span>
            <span className="text-sm font-bold text-slate-200">{contact.name}</span>
            {contact.isPinned && <Pin size={10} className="text-blue-400" />}
          </div>
          {contact.description && <p className="text-[10px] text-slate-500 mb-1.5">{contact.description}</p>}
          <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
            <a href={phoneHref} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-mono font-bold"><Phone size={9} /> {contact.phone}</a>
            {contact.email && <span className="flex items-center gap-1"><Mail size={9} /> <span className="text-blue-400">{contact.email}</span></span>}
            {contact.location && <span className="flex items-center gap-1"><MapPin size={9} /> {contact.location}</span>}
            {contact.hours && <span className="flex items-center gap-1"><Clock size={9} /> {contact.hours}</span>}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button onClick={() => onToggleFavorite(contact.id)} className={"p-1.5 rounded-lg " + (contact.isFavorite ? "text-amber-400 bg-amber-500/10" : "text-slate-600 hover:text-amber-400")}>
            <Star size={14} fill={contact.isFavorite ? "currentColor" : "none"} />
          </button>
          <button onClick={() => onTogglePinned(contact.id)} className={"p-1.5 rounded-lg " + (contact.isPinned ? "text-blue-400 bg-blue-500/10" : "text-slate-600 hover:text-blue-400")}>
            <Pin size={14} />
          </button>
          {contact.isCustom && (
            <button onClick={() => onRemove(contact.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400"><Trash2 size={12} /></button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EmergencyContactsDirectory() {
  const { filteredContacts, stats, addContact, removeContact, toggleFavorite, togglePinned, clearAllData, categoryFilter, setCategoryFilter, searchTerm, setSearchTerm, showFavoritesOnly, setShowFavoritesOnly } = useEmergencyContacts();
  const [showAddModal, setShowAddModal] = useState(false);
  const categoryFilters: (ContactCategory | "all")[] = ["all", "emergency", "security", "health", "counseling", "academic", "housing", "transport", "it-support"];

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-6 shadow-xl max-w-2xl w-full mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/20"><Phone size={18} className="text-red-500" /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Emergency Contacts</h3>
            <p className="text-[10px] text-slate-500 font-mono">{stats.total} contacts &middot; {stats.favorites} favorites</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 text-xs font-bold rounded-xl px-3 py-2"><Plus size={14} /> Add</button>
          <button onClick={clearAllData} className="p-2 rounded-xl hover:bg-red-500/10 text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search contacts..." className="flex-1 bg-slate-800/60 border border-slate-700/40 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
        <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} className={"p-2 rounded-xl border " + (showFavoritesOnly ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-slate-800 border-slate-700 text-slate-500")}>
          <Heart size={14} fill={showFavoritesOnly ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="flex gap-1 mb-4 flex-wrap">
        {categoryFilters.map((c) => {
          const active = categoryFilter === c;
          const cat = c !== "all" ? CATEGORIES[c] : null;
          const cls = active ? (cat ? cat.bg + " " + cat.color : "bg-slate-700 border-slate-600 text-slate-200") : "bg-slate-800/50 border-slate-700/40 text-slate-500";
          return (
            <button key={c} onClick={() => setCategoryFilter(c as ContactCategory | "all")} className={"text-[10px] font-mono rounded-lg px-2 py-1 border " + cls}>
              {c === "all" ? "All" : (cat?.icon + " " + cat?.label)}
            </button>
          );
        })}
      </div>

      {filteredContacts.length > 0 ? (
        <div className="space-y-2">
          {filteredContacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} onToggleFavorite={toggleFavorite} onTogglePinned={togglePinned} onRemove={removeContact} />
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <Phone size={32} className="mx-auto text-slate-700 mb-3" />
          <p className="text-xs text-slate-500">{searchTerm || categoryFilter !== "all" || showFavoritesOnly ? "No matches" : "No contacts"}</p>
        </div>
      )}

      {showAddModal && <AddContactModal onAdd={addContact} onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
