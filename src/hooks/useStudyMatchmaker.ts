import { useState, useEffect, useRef, useCallback } from 'react';

interface MatchState {
  isSearching: boolean;
  matchFound: string | null;
  error: string | null;
}

export const useStudyMatchmaker = (userId: string, wsUrl: string) => {
  const [state, setState] = useState<MatchState>({
    isSearching: false,
    matchFound: null,
    error: null
  });
  
  const wsRef = useRef<WebSocket | null>(null);

  const startMatchmaking = useCallback(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocation is not supported by your browser' }));
      return;
    }

    setState({ isSearching: true, matchFound: null, error: null });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        // Establish WS connection
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          // Send live coordinates to the Redis backend
          wsRef.current?.send(JSON.stringify({
            type: 'START_MATCHMAKING',
            data: {
              userId,
              lat: latitude,
              lng: longitude
            }
          }));
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'MATCH_FOUND') {
              setState(s => ({ ...s, isSearching: false, matchFound: data.peerId }));
              // Close connection after match to preserve resources
              wsRef.current?.close();
            }
          } catch (err) {
            console.error('Study WS Parse Error:', err);
          }
        };

        wsRef.current.onerror = () => {
          setState(s => ({ ...s, isSearching: false, error: 'WebSocket connection failed' }));
        };
      },
      (geoError) => {
        setState(s => ({ ...s, isSearching: false, error: 'Failed to access location: ' + geoError.message }));
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, [userId, wsUrl]);

  const stopMatchmaking = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'STOP_MATCHMAKING' }));
      wsRef.current.close();
    }
    setState({ isSearching: false, matchFound: null, error: null });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { ...state, startMatchmaking, stopMatchmaking };
};
