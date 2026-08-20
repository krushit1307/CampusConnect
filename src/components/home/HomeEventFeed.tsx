import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface LiveEvent {
  event_id: string;
  title: string;
  capacity: number;
  total_rsvps: number;
  recent_rsvps: number;
  hype_score: number;
  is_trending: boolean;
}

export function HomeEventFeed() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [filterTab, setFilterTab] = useState<'chronological' | 'trending'>('chronological');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadFeedData() {
      setLoading(true);
      if (filterTab === 'trending') {
        // Fetch strictly by velocity score from our RPC function
        const { data, error } = await supabase.rpc('get_trending_events_by_hype');
        if (!error && data) setEvents(data);
      } else {
        // Standard chronological query fallback
        const { data } = await supabase
          .from('events')
          .select('id, title, capacity')
          .gt('end_time', new Date().toISOString())
          .order('start_time', { ascending: true });
        
        if (data) {
          // Map standard formats to match feed interfaces safely
          setEvents(data.map(e => ({
            event_id: e.id, 
            title: e.title, 
            capacity: e.capacity,
            total_rsvps: 0, 
            recent_rsvps: 0, 
            hype_score: 0, 
            is_trending: false
          })));
        }
      }
      setLoading(false);
    }
    loadFeedData();
  }, [filterTab]);

  return (
    <div className="max-w-4xl mx-auto p-6 w-full">
      {/* Feed Filters Bar */}
      <div className="flex border-b border-gray-200 mb-6 gap-4">
        <button
          onClick={() => setFilterTab('chronological')}
          className={`pb-2 text-sm font-bold transition-all ${filterTab === 'chronological' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-400'}`}
        >
          All Upcoming
        </button>
        <button
          onClick={() => setFilterTab('trending')}
          className={`pb-2 text-sm font-bold flex items-center gap-1 transition-all ${filterTab === 'trending' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-400'}`}
        >
          🔥 Trending Momentum
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-gray-400">Recalculating event velocity metrics...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((ev) => (
            <div 
              key={ev.event_id} 
              className={`p-5 rounded-2xl bg-white border transition-all ${ev.is_trending ? 'border-amber-300 shadow-md ring-1 ring-amber-100' : 'border-gray-100 shadow-sm'}`}
            >
              <div className="flex justify-between items-start">
                <h3 className="font-extrabold text-gray-900 text-base leading-snug">{ev.title}</h3>
                
                {/* Dynamic Pulsating FOMO Badge */}
                {ev.is_trending && (
                  <span className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                    🔥 Hot Event
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-gray-500 font-medium">
                <span>Capacity: {ev.total_rsvps} / {ev.capacity || '∞'} filled</span>
                {ev.hype_score > 0 && (
                  <span className="font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                    +{ev.hype_score}% velocity
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
