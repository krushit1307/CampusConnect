import React from 'react';
import { Calendar, Clock, MapPin, Sparkles, CheckCircle2, UserCheck, Flame } from 'lucide-react';

interface ScheduleSlot {
  timeSlot: string;
  sessionTitle: string;
  speaker: string;
  speakerRole: string;
  locationRoom: string;
  categoryTag: string;
  attendeesCount: number;
}

const DAILY_SCHEDULE: ScheduleSlot[] = [
  {
    timeSlot: '09:00 AM - 10:30 AM',
    sessionTitle: 'Opening Keynote: Next-Gen Autonomous AI Agents in Higher Education',
    speaker: 'Dr. Evelyn Carter',
    speakerRole: 'Director of AI Research',
    locationRoom: 'Grand Auditorium A',
    categoryTag: 'Keynote',
    attendeesCount: 310,
  },
  {
    timeSlot: '11:00 AM - 01:00 PM',
    sessionTitle: 'Hands-on Workshop: Building Scalable Microservices with Rust & WebAssembly',
    speaker: 'Marcus Sterling',
    speakerRole: 'Principal Cloud Architect',
    locationRoom: 'Computer Lab 304',
    categoryTag: 'Workshop',
    attendeesCount: 85,
  },
  {
    timeSlot: '02:00 PM - 04:00 PM',
    sessionTitle: 'Panel Discussion: Ethical AI Governance & Academic Integrity Standards',
    speaker: 'Panel of 4 University Deans',
    speakerRole: 'Academic Governance Council',
    locationRoom: 'Conference Center East',
    categoryTag: 'Panel',
    attendeesCount: 220,
  },
  {
    timeSlot: '04:30 PM - 06:30 PM',
    sessionTitle: 'Student Startup Pitch Finals & Angel Investor Networking Showcase',
    speaker: 'Entrepreneurship Society',
    speakerRole: 'Venture Capital Mentors',
    locationRoom: 'Innovation Hall Main Arena',
    categoryTag: 'Competition',
    attendeesCount: 450,
  },
];

export default function EventScheduleTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" /> Today's Master Schedule
          </h3>
          <p className="text-slate-400 text-xs mt-1">Live updates on upcoming hall sessions and keynotes.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-purple-300 font-semibold">
          <Flame className="w-4 h-4 text-amber-400" /> Live Synchronized Matrix
        </div>
      </div>

      <div className="space-y-6">
        {DAILY_SCHEDULE.map((slot, index) => (
          <div
            key={index}
            className="bg-slate-950/80 border border-slate-800/90 hover:border-purple-500/40 rounded-2xl p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              <div className="bg-purple-500/10 border border-purple-500/20 text-purple-300 px-3 py-2 rounded-xl text-xs font-mono font-bold shrink-0">
                {slot.timeSlot}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-slate-800 text-slate-300 text-[11px] px-2 py-0.5 rounded font-semibold">
                    {slot.categoryTag}
                  </span>
                  <span className="text-slate-400 text-xs flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-rose-400" /> {slot.locationRoom}
                  </span>
                </div>

                <h4 className="text-base font-bold text-slate-100">{slot.sessionTitle}</h4>
                <p className="text-slate-400 text-xs mt-1">
                  Presented by <span className="text-slate-200 font-semibold">{slot.speaker}</span> ({slot.speakerRole})
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>{slot.attendeesCount} Registered</span>
              </div>
              <button className="bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-purple-500/30 transition">
                Add to Calendar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
