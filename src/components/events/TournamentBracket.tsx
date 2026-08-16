import React, { useState } from 'react';

export function TournamentBracket() {
  // A simple 8-team single elimination bracket mock
  const [matches, setMatches] = useState([
    // Quarterfinals
    { id: 1, round: 1, team1: 'Eagles', team2: 'Tigers', score1: 2, score2: 1, winner: 'Eagles' },
    { id: 2, round: 1, team1: 'Lions', team2: 'Bears', score1: 0, score2: 3, winner: 'Bears' },
    { id: 3, round: 1, team1: 'Sharks', team2: 'Dolphins', score1: 1, score2: 0, winner: 'Sharks' },
    { id: 4, round: 1, team1: 'Hawks', team2: 'Falcons', score1: 2, score2: 2, winner: 'Hawks' },
    // Semifinals
    { id: 5, round: 2, team1: 'Eagles', team2: 'Bears', score1: 1, score2: 2, winner: 'Bears' },
    { id: 6, round: 2, team1: 'Sharks', team2: 'Hawks', score1: null, score2: null, winner: null },
    // Finals
    { id: 7, round: 3, team1: 'Bears', team2: 'TBD', score1: null, score2: null, winner: null },
  ]);

  const [isAdmin, setIsAdmin] = useState(false); // Toggle to show organizer tools

  const handleScoreUpdate = (matchId: number, t1: number, t2: number) => {
    setMatches(matches.map(m => {
      if (m.id === matchId) {
        return { ...m, score1: t1, score2: t2, winner: t1 > t2 ? m.team1 : (t2 > t1 ? m.team2 : m.winner) };
      }
      return m;
    }));
  };

  const renderMatch = (match: any) => (
    <div key={match.id} className="neu-border bg-white mb-4 p-3 flex flex-col text-black min-w-[200px]">
      <div className="flex justify-between items-center border-b-2 border-gray-100 pb-2 mb-2">
        <span className={`font-mono text-sm font-bold ${match.winner === match.team1 ? 'text-green-600' : ''}`}>{match.team1}</span>
        {isAdmin ? (
          <input 
            type="number" 
            className="w-12 border-2 border-black p-1 text-center font-mono text-xs" 
            value={match.score1 ?? ''}
            onChange={(e) => handleScoreUpdate(match.id, parseInt(e.target.value) || 0, match.score2 || 0)}
          />
        ) : (
          <span className="font-mono text-sm">{match.score1 ?? '-'}</span>
        )}
      </div>
      <div className="flex justify-between items-center">
        <span className={`font-mono text-sm font-bold ${match.winner === match.team2 ? 'text-green-600' : ''}`}>{match.team2}</span>
        {isAdmin ? (
          <input 
            type="number" 
            className="w-12 border-2 border-black p-1 text-center font-mono text-xs" 
            value={match.score2 ?? ''}
            onChange={(e) => handleScoreUpdate(match.id, match.score1 || 0, parseInt(e.target.value) || 0)}
          />
        ) : (
          <span className="font-mono text-sm">{match.score2 ?? '-'}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="my-12 max-w-6xl mx-auto border-t-4 border-black pt-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-display font-black uppercase text-black">Tournament Bracket</h2>
        <button 
          onClick={() => setIsAdmin(!isAdmin)}
          className="neu-border bg-yellow-300 text-black px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-yellow-400"
        >
          {isAdmin ? 'View as Public' : 'Organizer View'}
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-8 overflow-x-auto pb-8">
        {/* Quarterfinals */}
        <div className="flex-1 flex flex-col justify-around gap-4">
          <h3 className="font-mono font-bold text-center mb-4 uppercase bg-black text-white py-1">Quarterfinals</h3>
          {matches.filter(m => m.round === 1).map(renderMatch)}
        </div>
        
        {/* Semifinals */}
        <div className="flex-1 flex flex-col justify-around gap-12">
          <h3 className="font-mono font-bold text-center mb-4 uppercase bg-black text-white py-1">Semifinals</h3>
          {matches.filter(m => m.round === 2).map(renderMatch)}
        </div>

        {/* Finals */}
        <div className="flex-1 flex flex-col justify-around gap-24">
          <h3 className="font-mono font-bold text-center mb-4 uppercase bg-black text-white py-1">Finals</h3>
          {matches.filter(m => m.round === 3).map(renderMatch)}
        </div>
      </div>
    </div>
  );
}
