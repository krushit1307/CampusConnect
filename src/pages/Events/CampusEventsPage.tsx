import React, { useState } from "react";
import {
  Calendar as CalendarIcon,
  MapPin,
  Users,
  Ticket,
  Filter,
  Search,
  PlusCircle,
  Sparkles,
  Clock,
  CheckCircle2,
  Share2,
  Tag,
  ShieldCheck,
  Heart,
  AlertCircle,
} from "lucide-react";
import EventCard, { CampusEvent } from "../../components/events/EventCard";
import { useTaxonomySearch } from "../../hooks/useTaxonomySearch";
import EventScheduleTimeline from "../../components/events/EventScheduleTimeline";

const INITIAL_EVENTS: CampusEvent[] = [
  {
    id: "evt-101",
    title: "Annual Campus AI & Machine Learning Hackathon 2026",
    organizer: "Computer Science Society",
    organizerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    category: "Hackathon",
    date: "2026-09-15",
    time: "09:00 AM - 09:00 PM",
    location: "Innovation Hub, Main Auditorium",
    capacity: 250,
    registeredCount: 198,
    price: "Free",
    tags: ["Artificial Intelligence", "Coding", "Prizes", "Networking"],
    description:
      "36-hour intensive hackathon assembling student developers, researchers, and mentors to build AI solutions for modern campus challenges.",
    isRSVPed: true,
    bannerUrl: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800",
    status: "Upcoming",
  },
  {
    id: "evt-102",
    title: "Quantum Computing Frontiers & Biophysics Symposium",
    organizer: "Department of Physics & Bioengineering",
    organizerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    category: "Symposium",
    date: "2026-09-20",
    time: "01:30 PM - 06:00 PM",
    location: "Science Complex, Lecture Hall B",
    capacity: 120,
    registeredCount: 112,
    price: "Free",
    tags: ["Quantum Mechanics", "Research", "Keynote", "Biophysics"],
    description:
      "Distinguished lectures by visiting scholars exploring quantum algorithms in protein folding and molecular dynamics simulations.",
    isRSVPed: false,
    bannerUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800",
    status: "Upcoming",
  },
  {
    id: "evt-103",
    title: "Inter-College Esports & Game Development Expo",
    organizer: "Campus Gaming League",
    organizerAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    category: "Workshop",
    date: "2026-09-28",
    time: "11:00 AM - 07:00 PM",
    location: "Student Union Center, East Wing",
    capacity: 400,
    registeredCount: 340,
    price: "$5.00",
    tags: ["Esports", "Unreal Engine 5", "Tournaments", "Indie Games"],
    description:
      "Competitive tournament showcases paired with hands-on game design workshops run by industry studio veterans.",
    isRSVPed: false,
    bannerUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800",
    status: "Upcoming",
  },
  {
    id: "evt-104",
    title: "Global Cultural Music & Culinary Night",
    organizer: "International Student Association",
    organizerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    category: "Cultural",
    date: "2026-10-05",
    time: "05:00 PM - 10:00 PM",
    location: "Campus Green Pavilion",
    capacity: 500,
    registeredCount: 480,
    price: "Free",
    tags: ["Culture", "Live Music", "Food Festival", "Community"],
    description:
      "An evening celebrating global heritage with student musical ensembles, dance performances, and traditional cuisine tastings.",
    isRSVPed: true,
    bannerUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800",
    status: "Upcoming",
  },
];

export default function CampusEventsPage() {
  const { expandQuery } = useTaxonomySearch();
  const [events, setEvents] = useState<CampusEvent[]>(INITIAL_EVENTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeTab, setActiveTab] = useState<"discover" | "schedule" | "my-rsvps">("discover");
  const [selectedEventModal, setSelectedEventModal] = useState<CampusEvent | null>(null);

  const categories = ["All", "Hackathon", "Symposium", "Workshop", "Cultural", "Sports"];

  const toggleRSVP = (eventId: string) => {
    setEvents((prev) =>
      prev.map((evt) => {
        if (evt.id === eventId) {
          const nextRSVP = !evt.isRSVPed;
          return {
            ...evt,
            isRSVPed: nextRSVP,
            registeredCount: nextRSVP ? evt.registeredCount + 1 : evt.registeredCount - 1,
          };
        }
        return evt;
      }),
    );
  };

  const filteredEvents = events.filter((evt) => {
    const expandedTerms = expandQuery(searchQuery);

    const matchesSearch =
      !searchQuery ||
      expandedTerms.some((term) => evt.title.toLowerCase().includes(term)) ||
      expandedTerms.some((term) => evt.location.toLowerCase().includes(term)) ||
      evt.tags.some((t) => expandedTerms.some((term) => t.toLowerCase().includes(term)));
    const matchesCategory = selectedCategory === "All" || evt.category === selectedCategory;
    const matchesTab = activeTab !== "my-rsvps" || evt.isRSVPed;

    return matchesSearch && matchesCategory && matchesTab;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-purple-900/60 via-indigo-900/40 to-slate-900 border border-purple-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-500/20 text-purple-300 text-xs px-3 py-1 rounded-full font-semibold border border-purple-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> CampusConnect Event Nexus
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <Ticket className="w-3.5 h-3.5 text-indigo-400" /> 1,200+ Registrations Today
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-purple-200 bg-clip-text text-transparent">
              Campus Events & Activity Portal
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Discover upcoming academic conferences, hackathons, cultural festivals, and student
              organization workshops across all campuses.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-purple-600/30 transition flex items-center gap-2 border border-purple-400/20 text-sm">
              <PlusCircle className="w-4 h-4" /> Host New Event
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Tabs & Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab("discover")}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === "discover"
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <CalendarIcon className="w-4 h-4" /> Discover Events
            </button>
            <button
              onClick={() => setActiveTab("schedule")}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === "schedule"
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Clock className="w-4 h-4" /> Interactive Schedule
            </button>
            <button
              onClick={() => setActiveTab("my-rsvps")}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === "my-rsvps"
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Ticket className="w-4 h-4" /> My Passes ({events.filter((e) => e.isRSVPed).length})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search event title, tag, or hall..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-purple-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Tab Body */}
        {activeTab === "schedule" ? (
          <EventScheduleTimeline />
        ) : (
          <>
            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2">
                Category:
              </span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    selectedCategory === cat
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                      : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Event Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredEvents.map((evt) => (
                <EventCard
                  key={evt.id}
                  event={evt}
                  onRSVP={() => toggleRSVP(evt.id)}
                  onInspect={() => setSelectedEventModal(evt)}
                />
              ))}
            </div>

            {filteredEvents.length === 0 && (
              <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/60">
                <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-300">
                  No events found matching criteria
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  Try adjusting your filters or keyword query.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal Popup Component */}
      {selectedEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl relative">
            <div className="h-44 bg-slate-800 relative">
              <img
                src={selectedEventModal.bannerUrl}
                alt={selectedEventModal.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
              <button
                onClick={() => setSelectedEventModal(null)}
                className="absolute right-4 top-4 bg-slate-950/80 text-slate-300 hover:text-white rounded-full w-8 h-8 flex items-center justify-center font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-6 relative -mt-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-purple-500/20 text-purple-300 text-xs px-2.5 py-1 rounded-md font-semibold border border-purple-500/30">
                  {selectedEventModal.category}
                </span>
                <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded-md font-semibold border border-emerald-500/30">
                  {selectedEventModal.price}
                </span>
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">{selectedEventModal.title}</h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                {selectedEventModal.description}
              </p>

              <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <CalendarIcon className="w-4 h-4 text-purple-400" />
                  <span>
                    {selectedEventModal.date} ({selectedEventModal.time})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPin className="w-4 h-4 text-rose-400" />
                  <span>{selectedEventModal.location}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>
                    {selectedEventModal.registeredCount} / {selectedEventModal.capacity} Seats
                    Claimed
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Hosted by {selectedEventModal.organizer}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSelectedEventModal(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-sm transition"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    toggleRSVP(selectedEventModal.id);
                    setSelectedEventModal(null);
                  }}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                    selectedEventModal.isRSVPed
                      ? "bg-rose-600 hover:bg-rose-500 text-white"
                      : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30"
                  }`}
                >
                  <Ticket className="w-4 h-4" />
                  {selectedEventModal.isRSVPed ? "Cancel Pass" : "Reserve Entry Pass"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
