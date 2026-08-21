import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function StreamVideoPlayer({ streamId }) {
  const [activePoll, setActivePoll] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [votesData, setVotesData] = useState([]);

  useEffect(() => {
    const channel = supabase.channel(`stream_${streamId}`)
      .on('broadcast', { event: 'poll_update' }, ({ payload }) => {
        if (payload.type === 'POLL_START') {
          setActivePoll(payload.data);
          setVotesData(payload.data.options);
          setHasVoted(false);
        } else if (payload.type === 'POLL_CLOSE') {
          setActivePoll(null);
        } else if (payload.type === 'VOTE_CAST') {
          setVotesData(payload.data);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  const castVote = async (index) => {
    if (hasVoted) return;
    
    const updatedVotes = [...votesData];
    updatedVotes[index].votes += 1;
    setHasVoted(true);
    setVotesData(updatedVotes);

    const channel = supabase.channel(`stream_${streamId}`);
    await channel.send({
      type: 'broadcast',
      event: 'poll_update',
      payload: { type: 'VOTE_CAST', data: updatedVotes },
    });
  };

  const totalVotes = votesData.reduce((acc, curr) => acc + curr.votes, 0);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
      {/* Simulated Video Stream Element */}
      <div className="text-white text-opacity-40 font-mono">Live Video Stream Feed</div>

      {/* Absolute Positioned Semi-Transparent Poll Overlay */}
      {activePoll && (
        <div className="absolute bottom-4 right-4 w-80 bg-gray-900 bg-opacity-90 backdrop-blur-md p-4 rounded-xl text-white shadow-2xl border border-gray-700 animate-fade-in">
          <h4 className="font-bold text-base mb-2">{activePoll.question}</h4>
          <div className="space-y-2">
            {votesData.map((opt, idx) => {
              const percentage = totalVotes === 0 ? 0 : Math.round((opt.votes / totalVotes) * 100);
              return (
                <button
                  key={idx}
                  disabled={hasVoted}
                  onClick={() => castVote(idx)}
                  className={`relative w-full text-left p-2 rounded overflow-hidden border border-gray-700 transition-all ${
                    hasVoted ? 'cursor-default bg-gray-800' : 'hover:bg-gray-800 bg-gray-900'
                  }`}
                >
                  <div
                    className="absolute top-0 left-0 bottom-0 bg-blue-600 bg-opacity-40 transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                  <div className="relative flex justify-between text-sm z-10">
                    <span>{opt.text}</span>
                    <span className="font-semibold">{percentage}%</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="text-right text-xs text-gray-400 mt-2">{totalVotes} total votes</div>
        </div>
      )}
    </div>
  );
}
