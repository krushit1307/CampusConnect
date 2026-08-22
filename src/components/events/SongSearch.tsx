import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SongSearch({ onSelect }: { onSelect: (track: any) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const search = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(`spotify-search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
      });
      if (data && data.tracks && data.tracks.items) {
        setResults(data.tracks.items);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          placeholder="Search for a song..." 
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <Button onClick={search} disabled={loading}>{loading ? 'Searching...' : 'Search'}</Button>
      </div>
      {results.length > 0 && (
        <ul className="neu-border divide-y divide-black max-h-64 overflow-y-auto bg-white">
          {results.map((track) => (
            <li key={track.id} className="flex items-center justify-between p-2 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                {track.album?.images?.[0] ? (
                  <img src={track.album.images[0].url} className="w-10 h-10 object-cover border border-black" alt="Album Art" />
                ) : (
                  <div className="w-10 h-10 bg-gray-200 border border-black" />
                )}
                <div>
                  <p className="font-bold text-sm leading-tight">{track.name}</p>
                  <p className="text-xs text-gray-600">{track.artists.map((a: any) => a.name).join(', ')}</p>
                </div>
              </div>
              <Button size="sm" onClick={() => onSelect(track)}>Request</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
