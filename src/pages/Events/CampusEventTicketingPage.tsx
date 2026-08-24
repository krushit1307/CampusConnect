import React, { useState } from "react";
import {
  Calendar,
  Ticket,
  MapPin,
  Clock,
  DollarSign,
  Users,
  PlusCircle,
  Search,
  Filter,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  QrCode,
  Activity,
  Flame,
  ShieldAlert,
} from "lucide-react";
import EventTicketCard, { CampusEvent } from "../../components/events/EventTicketCard";
import EventActivityTimeline from "../../components/events/EventActivityTimeline";
import { TicketExchangeBoard } from "../../components/tickets/TicketExchangeBoard";
import { RealtimeCapacityHeatmap } from "../../components/events/RealtimeCapacityHeatmap";
import { CancelEventDangerModal } from "../../components/events/CancelEventDangerModal";

const INITIAL_EVENTS: CampusEvent[] = [
  {
    id: "evt-901",
    eventTitle: "Annual Campus Hackathon & AI Showcase 2026",
    organizerClub: "Association for Computing Machinery (ACM)",
    eventCategory: "Tech & Hackathons",
    dateSchedule: "Saturday, Nov 12 @ 9:00 AM",
    venueLocation: "Student Union Grand Ballroom & Innovation Lab",
    ticketPriceUSD: 0,
    availableTickets: 85,
    totalCapacity: 300,
    organizerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    verificationStatus: "Official Organization",
    description:
      "36-hour hackathon featuring $10k in prizes, sponsor workshops from Google & AWS, free meals, and exclusive swags.",
    isRSVPed: false,
    status: "RSVP_OPEN",
  },
  {
    id: "evt-902",
    eventTitle: "Fall Music Fest & Indie Band Concert",
    organizerClub: "Campus Radio & Performing Arts Guild",
    eventCategory: "Concerts & Music",
    dateSchedule: "Friday, Oct 28 @ 7:00 PM",
    venueLocation: "Outdoor Amphitheater Quad",
    ticketPriceUSD: 12,
    availableTickets: 42,
    totalCapacity: 500,
    organizerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    verificationStatus: "Official Organization",
    description:
      "Live outdoor performances by 5 student bands and headline indie guest performance. Food trucks on site!",
    isRSVPed: true,
    status: "RSVP_OPEN",
  },
  {
    id: "evt-903",
    eventTitle: "Executive Leadership & Venture Pitch Summit",
    organizerClub: "Entrepreneurship & VC Club",
    eventCategory: "Career & Business",
    dateSchedule: "Wednesday, Nov 2 @ 4:00 PM",
    venueLocation: "Business School Auditorium 101",
    ticketPriceUSD: 5,
    availableTickets: 18,
    totalCapacity: 150,
    organizerAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
    verificationStatus: "Official Organization",
    description:
      "Watch student startup finalists pitch to alumni angel investors for seed funding grants up to $25,000.",
    isRSVPed: false,
    status: "ALMOST_FULL",
  },
];

export default function CampusEventTicketingPage() {
  const [events, setEvents] = useState<CampusEvent[]>(INITIAL_EVENTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeTab, setActiveTab] = useState<
    "events" | "activity" | "my-tickets" | "ticket-exchange" | "capacity-heatmap"
  >("events");
  const [selectedEventModal, setSelectedEventModal] = useState<CampusEvent | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const categories = [
    "All",
    "Tech & Hackathons",
    "Concerts & Music",
    "Career & Business",
    "Social & Greek Life",
  ];

  const toggleRSVP = (id: string) => {
    setEvents((prev) =>
      prev.map((evt) => {
        if (evt.id === id) {
          const nextRSVP = !evt.isRSVPed;
          return {
            ...evt,
            isRSVPed: nextRSVP,
            availableTickets: nextRSVP ? evt.availableTickets - 1 : evt.availableTickets + 1,
          };
        }
        return evt;
      }),
    );
  };

  const filteredEvents = events.filter((evt) => {
    const matchesSearch =
      evt.eventTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.organizerClub.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.venueLocation.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || evt.eventCategory === selectedCategory;
    const matchesTab = activeTab !== "my-tickets" || evt.isRSVPed;

    return matchesSearch && matchesCategory && matchesTab;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-violet-950 via-purple-950 to-slate-900 border border-violet-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-violet-500/20 text-violet-300 text-xs px-3 py-1 rounded-full font-semibold border border-violet-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> CampusConnect Event Pass
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-violet-400" /> Instant Digital QR Entry
                Verification
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-violet-200 bg-clip-text text-transparent">
              Campus Events & Digital Ticketing Hub
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              RSVP for student organization hackathons, concerts, workshops, and summits with
              instant digital wallet pass generation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCancelModalOpen(true)}
              className="bg-red-600/20 hover:bg-red-600/30 text-red-300 px-4 py-3 rounded-xl font-medium shadow-md transition flex items-center gap-2 border border-red-500/30 text-sm"
            >
              <ShieldAlert className="w-4 h-4 text-red-400" /> Cancel Event Danger Zone
            </button>
            <button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-violet-600/30 transition flex items-center gap-2 border border-violet-400/20 text-sm">
              <PlusCircle className="w-4 h-4" /> Create Student Event
            </button>
          </div>
        </div>

        <CancelEventDangerModal
          eventId="evt-902"
          eventTitle="Fall Music Fest & Indie Band Concert"
          totalAttendees={200}
          totalRevenueUSD={2400}
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
        />
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab("events")}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === "events"
                  ? "bg-violet-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Calendar className="w-4 h-4" /> Upcoming Events
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === "activity"
                  ? "bg-violet-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Activity className="w-4 h-4" /> Live RSVP Stream
            </button>
            <button
              onClick={() => setActiveTab("my-tickets")}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === "my-tickets"
                  ? "bg-violet-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Ticket className="w-4 h-4" /> My Event Passes (
              {events.filter((e) => e.isRSVPed).length})
            </button>
            <button
              onClick={() => setActiveTab("ticket-exchange")}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === "ticket-exchange"
                  ? "bg-violet-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <QrCode className="w-4 h-4" /> Ticket Exchange Marketplace
            </button>
            <button
              onClick={() => setActiveTab("capacity-heatmap")}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === "capacity-heatmap"
                  ? "bg-violet-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Flame className="w-4 h-4 text-rose-400" /> Realtime Capacity Heatmap
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search event title or venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-violet-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "activity" ? (
          <EventActivityTimeline />
        ) : activeTab === "capacity-heatmap" ? (
          <RealtimeCapacityHeatmap eventId="evt-901" />
        ) : activeTab === "ticket-exchange" ? (
          <TicketExchangeBoard
            userRsvps={events
              .filter((e) => e.isRSVPed)
              .map((e) => ({
                id: `rsvp-${e.id}`,
                event_id: e.id,
                event_title: e.eventTitle,
                ticket_price: e.ticketPriceUSD * 100,
              }))}
            availableEvents={events.map((e) => ({
              id: e.id,
              title: e.eventTitle,
              ticket_price: e.ticketPriceUSD * 100,
            }))}
          />
        ) : (
          <>
            {/* Filter Pills */}
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
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm"
                      : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredEvents.map((evt) => (
                <EventTicketCard
                  key={evt.id}
                  event={evt}
                  onRSVP={() => toggleRSVP(evt.id)}
                  onInspect={() => setSelectedEventModal(evt)}
                />
              ))}
            </div>

            {filteredEvents.length === 0 && (
              <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/60">
                <ShieldAlert className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-300">
                  No campus events match criteria
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  Try updating your filters or search keywords.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal View */}
      {selectedEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedEventModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="bg-violet-500/20 text-violet-400 text-xs px-2.5 py-0.5 rounded font-mono font-bold border border-violet-500/30">
                {selectedEventModal.eventCategory}
              </span>
              <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded font-semibold">
                {selectedEventModal.organizerClub}
              </span>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">{selectedEventModal.eventTitle}</h2>
            <p className="text-slate-400 text-xs leading-relaxed mb-4">
              {selectedEventModal.description}
            </p>

            <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="w-4 h-4 text-violet-400" />
                <span>Venue: {selectedEventModal.venueLocation}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Date: {selectedEventModal.dateSchedule}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300 pt-2 border-t border-slate-900">
                <span>
                  Pass Price:{" "}
                  {selectedEventModal.ticketPriceUSD === 0
                    ? "FREE"
                    : `$${selectedEventModal.ticketPriceUSD}`}
                </span>
                <span>
                  {selectedEventModal.availableTickets} of {selectedEventModal.totalCapacity} Passes
                  Left
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedEventModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  toggleRSVP(selectedEventModal.id);
                  setSelectedEventModal(null);
                }}
                className={`px-5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                  selectedEventModal.isRSVPed
                    ? "bg-rose-600 hover:bg-rose-500 text-white"
                    : "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/30"
                }`}
              >
                <Ticket className="w-4 h-4" />
                {selectedEventModal.isRSVPed ? "Cancel Event Pass" : "RSVP Digital Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
