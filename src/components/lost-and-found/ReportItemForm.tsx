import React, { useState } from 'react';
import axios from 'axios';
import { MatchAlert } from './MatchAlert';

export const ReportItemForm: React.FC = () => {
  const [type, setType] = useState<'LOST' | 'FOUND'>('LOST');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<any | null>(null);
  
  // Note: For a real app, reporterId would come from an Auth Context.
  const mockReporterId = 'user-123';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMatchResult(null);

    try {
      // In production, the imageUrl would be uploaded to Supabase Storage first.
      // Here we assume it's a direct URL provided by the user or an uploaded file path.
      const response = await axios.post('/api/lost-and-found/report', {
        type,
        imageUrl,
        description,
        reporterId: mockReporterId
      });

      if (response.data.match) {
        setMatchResult(response.data.match);
      } else {
        alert(response.data.message);
      }
    } catch (error) {
      console.error('Failed to report item', error);
      alert('An error occurred while reporting the item.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-8 p-6 bg-white rounded-xl shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Report an Item</h2>
      
      {matchResult && <MatchAlert match={matchResult} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setType('LOST')}
              className={`flex-1 py-2 rounded-lg font-medium ${type === 'LOST' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              I Lost Something
            </button>
            <button
              type="button"
              onClick={() => setType('FOUND')}
              className={`flex-1 py-2 rounded-lg font-medium ${type === 'FOUND' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              I Found Something
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
          <input 
            type="url" 
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="https://example.com/image.jpg"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">Our AI will visually scan this image to find matches.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
          <textarea 
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"
            placeholder="Any additional details..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button 
          type="submit" 
          disabled={isLoading}
          className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
        >
          {isLoading ? 'Scanning visually...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
};
