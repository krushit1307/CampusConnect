import React, { useState } from 'react';
import {
  FestivalRoadmapService,
  MultiTrackSession,
  PersonalizedItineraryTicket,
} from '../../backend/src/services/FestivalRoadmapService';

export const InteractiveFestivalRoadmap: React.FC = () => {
  const [selectedTrack, setSelectedTrack] = useState<string>('ALL');
  const [sessions, setSessions] = useState<MultiTrackSession[]>(
    FestivalRoadmapService.getSessions()
  );
  const [itinerary, setItinerary] = useState<PersonalizedItineraryTicket[]>(
    FestivalRoadmapService.getUserItinerary('USER-101')
  );

  const [activeModalSession, setActiveModalSession] = useState<MultiTrackSession | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const metrics = FestivalRoadmapService.getMetrics();

  const handleTrackChange = (track: string) => {
    setSelectedTrack(track);
    setSessions(FestivalRoadmapService.getSessions(track));
  };

  const handleBookmark = (session: MultiTrackSession) => {
    try {
      setErrorMessage(null);
      const ticket = FestivalRoadmapService.bookmarkSession('USER-101', session.sessionId);
      setItinerary([...itinerary, ticket]);
      setSessions([...FestivalRoadmapService.getSessions(selectedTrack)]);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleExportICS = () => {
    const icsData = FestivalRoadmapService.generateICalendarExport('USER-101');
    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'campusconnect_festival_agenda.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Interactive Event Roadmap Engine
            </span>
            <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold px-3 py-1 rounded-full font-mono">
              Multi-Track Gantt Time Matrix
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Multi-Track Campus Event & Festival Schedule
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Explore concurrent sessions across AI/ML, Cyber Security, UX Design, and Founders tracks with real-time conflict detection and 1-click RFC 5545 iCalendar (.ics) export.
          </p>
        </div>

        <button
          onClick={handleExportICS}
          className="py-3 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-lg hover:shadow-rose-500/20 flex items-center gap-2"
        >
          Export Agenda (.ics) 📅
        </button>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-xs font-bold flex justify-between items-center">
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 font-black hover:text-white">✕</button>
        </div>
      )}

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Festival Sessions</span>
          <div className="text-2xl md:text-3xl font-black text-rose-400 mt-1">
            {metrics.totalSessions} Sessions
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">5 Parallel Track Matrix</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bookmarked Itineraries</span>
          <div className="text-2xl md:text-3xl font-black text-indigo-400 mt-1">
            {itinerary.length} Sessions Saved
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Personalized Agenda</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Capacity Utilization</span>
          <div className="text-2xl md:text-3xl font-black text-emerald-400 mt-1">
            {metrics.avgCapacityPct}% Full
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">{metrics.totalBookings} Total Attendees Reserved</span>
        </div>
      </div>

      {/* Track Selector Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap gap-2 items-center justify-between">
        <span className="text-xs font-bold text-slate-300">Filter Sessions by Track:</span>
        <div className="flex flex-wrap gap-2">
          {['ALL', 'AI_ML', 'CYBER_SECURITY', 'FOUNDERS', 'MAINSTAGE', 'UX_DESIGN'].map((tr) => (
            <button
              key={tr}
              onClick={() => handleTrackChange(tr)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedTrack === tr
                  ? 'bg-rose-600 text-white shadow-lg'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tr.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Gantt Time Matrix Session Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sessions.map((sess) => {
          const isBookmarked = itinerary.some((i) => i.sessionId === sess.sessionId);
          return (
            <div
              key={sess.sessionId}
              className="bg-slate-900/80 backdrop-blur-md border border-slate-800 hover:border-rose-500/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-all space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-1 rounded-full">
                    {sess.track.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-bold text-slate-400 bg-slate-950 border border-slate-800 px-3 py-1 rounded-full">
                    📍 {sess.locationRoom}
                  </span>
                </div>

                <h3 className="text-xl font-black text-white">{sess.title}</h3>
                <p className="text-xs text-slate-400 mb-2">Speaker: {sess.speakerName} ({sess.speakerTitle})</p>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">{sess.abstractText}</p>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs flex justify-between items-center text-slate-300">
                  <span>🕒 {new Date(sess.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(sess.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-emerald-400 font-bold">{sess.currentBookings} / {sess.capacityLimit} Seats Filled</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setActiveModalSession(sess)}
                  className="w-1/2 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 font-bold text-xs hover:bg-slate-800"
                >
                  View Details & Bio 🔍
                </button>
                <button
                  onClick={() => handleBookmark(sess)}
                  disabled={isBookmarked}
                  className={`w-1/2 py-3 rounded-xl font-bold text-xs transition-all ${
                    isBookmarked
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg'
                  }`}
                >
                  {isBookmarked ? 'Bookmarked ✅' : 'Bookmark Session'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Inspector */}
      {activeModalSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-rose-400 uppercase">{activeModalSession.track}</span>
                <h2 className="text-xl font-bold text-white mt-1">{activeModalSession.title}</h2>
              </div>
              <button onClick={() => setActiveModalSession(null)} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{activeModalSession.abstractText}</p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-rose-400 block">Featured Keynote Speaker</span>
              <p className="text-white font-bold">{activeModalSession.speakerName}</p>
              <p className="text-slate-400">{activeModalSession.speakerTitle}</p>
            </div>

            <button
              onClick={() => setActiveModalSession(null)}
              className="w-full py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-800"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
