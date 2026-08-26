import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SongSearch } from './SongSearch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function SongRequestSection({ eventId, isOrganizer }: { eventId: string; isOrganizer: boolean }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadRequests = async () => {
    const { data, error } = await supabase
      .from('song_requests')
      .select('*, song_upvotes(user_id)')
      .eq('event_id', eventId)
      .order('upvotes', { ascending: false });
    
    if (data) setRequests(data);
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
    
    const channel = supabase
      .channel('song_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_requests', filter: `event_id=eq.${eventId}` }, loadRequests)
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const handleRequestSong = async (track: any) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return toast.error('You must be logged in to request a song.');

    const { error } = await supabase.from('song_requests').insert({
      event_id: eventId,
      spotify_track_id: track.id,
      title: track.name,
      artist: track.artists.map((a: any) => a.name).join(', '),
      album_art_url: track.album?.images?.[0]?.url || '',
      requested_by: user.user.id
    } as any);
    
    if (error) {
      toast.error('Error requesting song');
    } else {
      toast.success('Song requested!');
      loadRequests();
    }
  };

  const handleUpvote = async (requestId: string, currentUpvotes: number) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return toast.error('You must be logged in to upvote.');

    // Add upvote
    const { error } = await supabase.from('song_upvotes').insert({
      song_request_id: requestId,
      user_id: user.user.id
    } as any);
    
    if (error && error.code !== '23505') {
      toast.error('Error upvoting');
    } else if (!error) {
      // Mock upvote increment for MVP without RPC
      await (supabase.from('song_requests') as any).update({ upvotes: currentUpvotes + 1 }).eq('id', requestId);
      loadRequests();
    } else {
      toast.info('You already upvoted this song');
    }
  };

  const exportToSpotify = async () => {
    toast.info('Exporting to Spotify...');
    const { data, error } = await supabase.functions.invoke('spotify-export', { method: 'POST', body: { eventId } });
    if (error || data?.error) {
      toast.error(data?.message || 'Failed to export');
    } else {
      toast.success('Exported to Spotify!');
    }
  };

  return (
    <div className="p-6 bg-[#f8f9fa] neu-border space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold font-display">Song Requests</h2>
        {isOrganizer && (
          <Button onClick={exportToSpotify} variant="primary" className="bg-[#1DB954] text-white hover:bg-[#1ed760]">
            Export to Spotify
          </Button>
        )}
      </div>

      <SongSearch onSelect={handleRequestSong} />

      {loading ? (
        <p className="font-mono">Loading requests...</p>
      ) : (
        <div className="space-y-4 mt-6">
          {requests.map(req => (
            <div key={req.id} className="flex items-center justify-between p-3 bg-white neu-border">
              <div className="flex items-center gap-4">
                {req.album_art_url ? (
                  <img src={req.album_art_url} className="w-12 h-12 border border-black object-cover" alt="" />
                ) : (
                  <div className="w-12 h-12 bg-gray-200 border border-black" />
                )}
                <div>
                  <p className="font-bold">{req.title}</p>
                  <p className="text-sm text-gray-600">{req.artist}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold font-mono">{req.upvotes} votes</span>
                <Button variant="outline" size="sm" onClick={() => handleUpvote(req.id, req.upvotes)}>
                  ▲ Upvote
                </Button>
              </div>
            </div>
          ))}
          {requests.length === 0 && <p className="text-gray-500 italic font-mono text-sm">No songs requested yet. Be the first!</p>}
        </div>
      )}
    </div>
  );
}
