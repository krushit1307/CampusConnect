import { useState, useEffect, useRef } from 'react';
import { BusLocation } from '../api/transit-stream';

export const useTransitStream = (url: string) => {
  const [buses, setBuses] = useState<BusLocation[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Establish WebSocket connection for real-time transit data
    wsRef.current = new WebSocket(url);

    wsRef.current.onopen = () => {
      console.log('Connected to Transit WebSocket');
      setIsConnected(true);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'TRANSIT_UPDATE') {
          // Instantly update bus locations without polling HTTP delays
          setBuses(data.buses);
        }
      } catch (err) {
        console.error('Error parsing transit WS message:', err);
      }
    };

    wsRef.current.onclose = () => {
      console.log('Transit WebSocket disconnected');
      setIsConnected(false);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url]);

  return { buses, isConnected };
};
