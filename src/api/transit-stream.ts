import { WebSocketServer, WebSocket } from 'ws';

export interface BusLocation {
  busId: string;
  routeId: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
}

/**
 * Initializes a WebSocket Server to broadcast live transit coordinates.
 * In a real application, this would bind to the existing Express/HTTP server.
 */
export const setupTransitStream = (server: any) => {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: any, socket: any, head: any) => {
    if (request.url === '/api/transit-stream') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  // Keep track of connected clients
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    console.log('New client connected to Transit Stream');
    clients.add(ws);

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  // Mock IoT Bus Simulator
  // Simulates two buses driving around a fixed loop, updating every 1 second
  let tick = 0;
  setInterval(() => {
    tick += 0.01;
    
    // Simulate circular routes
    const mockBuses: BusLocation[] = [
      {
        busId: 'BUS-01',
        routeId: 'BLUE_ROUTE',
        lat: 40.7128 + Math.sin(tick) * 0.01,
        lng: -74.0060 + Math.cos(tick) * 0.01,
        heading: (tick * 180) % 360,
        speed: 25
      },
      {
        busId: 'BUS-02',
        routeId: 'RED_ROUTE',
        lat: 40.7150 + Math.sin(tick + Math.PI) * 0.015,
        lng: -74.0100 + Math.cos(tick + Math.PI) * 0.015,
        heading: ((tick + Math.PI) * 180) % 360,
        speed: 30
      }
    ];

    const payload = JSON.stringify({ type: 'TRANSIT_UPDATE', buses: mockBuses });

    // Broadcast to all active clients
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });

  }, 1000); // 1-second ultra-low latency updates
};
