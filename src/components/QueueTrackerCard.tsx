import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface QueueNode {
  id: string;
  node_name: string;
  current_wait_minutes: number;
  status_color: 'green' | 'amber' | 'red';
}

export default function QueueTrackerCard({ nodeId, userId, onClose }: { nodeId: string; userId: string; onClose?: () => void }) {
  const [nodeData, setNodeData] = useState<QueueNode | null>(null);
  const [voting, setVoting] = useState<boolean>(false);
  const [hasVoted, setHasVoted] = useState<boolean>(false);

  useEffect(() => {
    // 1. Seed snapshot values on mount
    const fetchInitialMetrics = async () => {
      const { data } = await supabase
        .from('queue_nodes')
        .select('id, node_name, current_wait_minutes, status_color')
        .eq('id', nodeId)
        .single();
      if (data) setNodeData(data as QueueNode);
    };
    fetchInitialMetrics();

    // 2. Open Realtime WebSocket channel streams for instant color modifications
    const queueChannel = supabase
      .channel(`queue-node:${nodeId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'queue_nodes', filter: `id=eq.${nodeId}` }, 
        (payload) => {
          setNodeData(payload.new as QueueNode);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(queueChannel);
    };
  }, [nodeId]);

  const castQueueVote = async (minutes: number) => {
    setVoting(true);
    try {
      const { error } = await supabase.rpc('submit_queue_vote', {
        target_node_id: nodeId,
        submitted_wait_minutes: minutes,
        voter_user_id: userId
      });

      if (!error) {
        setHasVoted(true);
        setTimeout(() => setHasVoted(false), 10000); // Reset UI entry buffer after 10s
      }
    } catch (err) {
      console.error('Error logging crowd metric:', err);
    } finally {
      setVoting(false);
    }
  };

  if (!nodeData) return <div className="p-4 bg-white rounded-xl shadow animate-pulse border z-50 relative pointer-events-auto w-80">Syncing line metadata...</div>;

  // Map color enums to design tokens
  const statusStyles = {
    green: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Fast (0-10m wait)' },
    amber: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Moderate (11-25m wait)' },
    red: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-800', dot: 'bg-rose-500', label: 'Crowded (25m+ wait)' }
  }[nodeData.status_color];

  return (
    <div className="w-80 p-5 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 pointer-events-auto relative">
      {onClose && (
        <button 
          onClick={onClose} 
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>
      )}
      <div className="flex items-center justify-between border-b pb-3 mb-4 mt-2">
        <div>
          <h3 className="font-extrabold text-gray-900 text-base tracking-tight">{nodeData.node_name}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Crowdsourced Wait-Time Infrastructure</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusStyles.bg} ${statusStyles.text}`}>
          <span className={`w-2 h-2 rounded-full ${statusStyles.dot} animate-pulse`} />
          {nodeData.current_wait_minutes} mins ETA
        </span>
      </div>

      {/* Input Action Panel: Voter Interfaces */}
      <div className="space-y-3">
        <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider">Are you standing in this line?</h4>
        
        {hasVoted ? (
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs font-semibold rounded-xl text-center">
            🎉 Thank you! Your submission updates live maps instantly.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[5, 15, 35].map((timeOption) => (
              <button
                key={timeOption}
                onClick={() => castQueueVote(timeOption)}
                disabled={voting}
                className="py-2 px-3 border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 text-gray-700 hover:text-indigo-900 text-xs font-bold rounded-xl transition-all disabled:opacity-40"
              >
                {timeOption === 35 ? '30+ min' : `${timeOption} min`}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
