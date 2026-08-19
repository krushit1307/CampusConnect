import React, { useState } from 'react';

export function CoCreationSandbox({ event, proposals, onVote }) {
  const [selectedVotes, setSelectedVotes] = useState({});

  const handleVoteChange = (category, proposalId) => {
    setSelectedVotes(prev => ({ ...prev, [category]: proposalId }));
  };

  const submitVotes = async () => {
    for (const [category, proposalId] of Object.entries(selectedVotes)) {
      await onVote(proposalId);
    }
    alert('Your votes have been successfully recorded!');
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
      <div className="space-y-1">
        <span className="inline-block px-3 py-1 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-xs font-semibold rounded-md">
          Co-Creation Sandbox (72-Hour Ideation Phase)
        </span>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Help Shape: {event.title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Vote on preferred attributes before final budget commitment.</p>
      </div>

      {/* Render proposal categories (Time, Theme, Food) */}
      {['time', 'speaker', 'food'].map(category => {
        const categoryProposals = proposals.filter(p => p.category === category);
        if (categoryProposals.length === 0) return null;

        return (
          <div key={category} className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Select {category}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categoryProposals.map(proposal => (
                <button
                  key={proposal.id}
                  onClick={() => handleVoteChange(category, proposal.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedVotes[category] === proposal.id
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 ring-2 ring-blue-400/30'
                      : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{proposal.option_value}</p>
                  <span className="text-xs text-gray-500 mt-1 block">{proposal.votes_count} votes</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <button
        onClick={submitVotes}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
      >
        Submit Preferences
      </button>
    </div>
  );
}
