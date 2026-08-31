import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';

// In a real application, connection strings would come from env variables
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const REDIS_GEO_KEY = 'campus:study_seekers';

interface MatchRequest {
  userId: string;
  lat: number;
  lng: number;
  subject?: string;
}

/**
 * Initializes a WebSocket Server to manage real-time geospatial matchmaking.
 * Binds to the existing Express/HTTP server on the `/api/study-match` route.
 */
export const setupStudyMatchStream = (server: any) => {
  const wss = new WebSocketServer({ noServer: true });
  
  // Track active socket connections by userId
  const activeConnections = new Map<string, WebSocket>();

  server.on('upgrade', (request: any, socket: any, head: any) => {
    if (request.url === '/api/study-match') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    let currentUserId: string | null = null;

    ws.on('message', async (data) => {
      try {
        const payload = JSON.parse(data.toString());

        if (payload.type === 'START_MATCHMAKING') {
          const req: MatchRequest = payload.data;
          currentUserId = req.userId;
          activeConnections.set(req.userId, ws);

          // 1. Index user's live location in Redis
          await redis.geoadd(REDIS_GEO_KEY, req.lng, req.lat, req.userId);

          // 2. Perform a high-speed radius search (500 meters)
          // geosearch returns an array of member strings (userIds) within the radius
          const nearbyPeers = await redis.geosearch(
            REDIS_GEO_KEY, 
            'FROMLONLAT', req.lng, req.lat, 
            'BYRADIUS', 500, 'm'
          ) as string[];

          // 3. Filter out the current user and find the first active peer
          const matchId = nearbyPeers.find(peerId => peerId !== req.userId);

          if (matchId) {
            // Send instant match notification to the current user
            ws.send(JSON.stringify({ 
              type: 'MATCH_FOUND', 
              peerId: matchId 
            }));

            // Push notification to the peer if they are still connected
            const peerSocket = activeConnections.get(matchId);
            if (peerSocket && peerSocket.readyState === WebSocket.OPEN) {
              peerSocket.send(JSON.stringify({ 
                type: 'MATCH_FOUND', 
                peerId: req.userId 
              }));
            }

            // Optional: Remove both users from the matchmaking pool now that they are matched
            await redis.zrem(REDIS_GEO_KEY, req.userId, matchId);
          }
        }
        
        if (payload.type === 'STOP_MATCHMAKING' && currentUserId) {
          await redis.zrem(REDIS_GEO_KEY, currentUserId);
          activeConnections.delete(currentUserId);
        }
      } catch (err) {
        console.error('Study Match WS Error:', err);
      }
    });

    ws.on('close', async () => {
      if (currentUserId) {
        await redis.zrem(REDIS_GEO_KEY, currentUserId);
        activeConnections.delete(currentUserId);
      }
    });
  });
};
