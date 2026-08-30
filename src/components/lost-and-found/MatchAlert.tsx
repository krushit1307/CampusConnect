import React from 'react';

interface MatchAlertProps {
  match: {
    id: string;
    type: string;
    imageUrl: string;
    description: string;
    similarity: number;
  };
}

export const MatchAlert: React.FC<MatchAlertProps> = ({ match }) => {
  // Convert cosine similarity (e.g., 0.89) to a percentage for user display
  const confidencePercent = Math.round(match.similarity * 100);

  return (
    <div className="mb-6 p-4 border-2 border-green-500 bg-green-50 rounded-xl flex flex-col sm:flex-row gap-4 items-center">
      <div className="flex-shrink-0">
        <div className="w-16 h-16 rounded-full bg-green-200 flex items-center justify-center border-4 border-green-100">
          <span className="text-2xl">🎉</span>
        </div>
      </div>
      
      <div className="flex-grow text-center sm:text-left">
        <h3 className="text-lg font-bold text-green-900 mb-1">Visual Match Found!</h3>
        <p className="text-sm text-green-800">
          Our AI detected a <span className="font-bold">{confidencePercent}% visual match</span> with an item currently marked as {match.type}.
        </p>
      </div>

      <div className="flex-shrink-0">
        <img 
          src={match.imageUrl} 
          alt="Matched item" 
          className="w-20 h-20 object-cover rounded-lg border-2 border-green-300"
        />
      </div>

      <div className="flex-shrink-0 mt-2 sm:mt-0">
        <button className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors">
          Connect
        </button>
      </div>
    </div>
  );
};
