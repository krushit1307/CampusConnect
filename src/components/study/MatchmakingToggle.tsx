import React from 'react';
import { useStudyMatchmaker } from '../../hooks/useStudyMatchmaker';

interface MatchmakingToggleProps {
  currentUserId: string;
}

export const MatchmakingToggle: React.FC<MatchmakingToggleProps> = ({ currentUserId }) => {
  // Use a dynamic WS URL in production
  const wsUrl = 'ws://localhost:5174/api/study-match';
  
  const { 
    isSearching, 
    matchFound, 
    error, 
    startMatchmaking, 
    stopMatchmaking 
  } = useStudyMatchmaker(currentUserId, wsUrl);

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow-xl text-center border border-gray-100">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Study Matchmaker</h2>
        <p className="text-gray-500 mt-2">
          Instantly connect with peers within a 500m radius for impromptu study sessions.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-200">
          ⚠️ {error}
        </div>
      )}

      {matchFound ? (
        <div className="mb-6 p-6 bg-green-50 rounded-xl border-2 border-green-400 transform transition-all scale-105">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-200">
            <span className="text-white text-3xl">🎉</span>
          </div>
          <h3 className="text-xl font-bold text-green-900 mb-2">Match Found!</h3>
          <p className="text-green-800 mb-4">
            You've matched with <span className="font-bold font-mono bg-green-200 px-2 py-1 rounded">User {matchFound.substring(0, 5)}...</span> who is nearby right now.
          </p>
          <button 
            className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-md shadow-green-200"
            onClick={() => {/* Navigate to chat/meetup */}}
          >
            Start Chat
          </button>
        </div>
      ) : (
        <div className="relative mb-6 flex justify-center items-center h-32">
          {/* Radar Animation when searching */}
          {isSearching && (
            <>
              <div className="absolute w-32 h-32 bg-blue-100 rounded-full animate-ping opacity-75"></div>
              <div className="absolute w-24 h-24 bg-blue-200 rounded-full animate-ping delay-75 opacity-75"></div>
            </>
          )}
          
          <button
            onClick={isSearching ? stopMatchmaking : startMatchmaking}
            className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white font-bold shadow-xl transition-all transform hover:scale-105 ${
              isSearching 
                ? 'bg-red-500 hover:bg-red-600 shadow-red-200' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
            }`}
          >
            {isSearching ? 'STOP' : 'FIND'}
          </button>
        </div>
      )}

      {!matchFound && (
        <p className="text-sm font-medium text-gray-600">
          {isSearching ? (
            <span className="text-blue-600 animate-pulse">Scanning immediate area...</span>
          ) : (
            'Tap to broadcast your location'
          )}
        </p>
      )}
    </div>
  );
};
