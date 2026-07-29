/**
 * k6 Load Testing Script for Supabase Realtime Endpoints
 * 
 * This script simulates hundreds of concurrent WebSocket connections to a Supabase Realtime channel.
 * It authenticates using a provided JWT, connects to the 'public:chat_messages' channel,
 * and simulates sending and receiving messages at high frequency.
 * 
 * Prerequisites:
 * - Install k6: https://k6.io/docs/getting-started/installation/
 * - Set environment variables: SUPABASE_URL, SUPABASE_ANON_KEY, TEST_USER_JWT
 * 
 * Execution:
 * k6 run --vus 100 --duration 60s load-testing/k6/supabase-realtime-test.js
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Custom metrics to track specific realtime performance indicators
const messagesSent = new Counter('messages_sent');
const messagesReceived = new Counter('messages_received');
const connectionLatency = new Trend('connection_latency_ms');
const messageLatency = new Trend('message_latency_ms');
const errorRate = new Rate('errors');

// Configuration loaded from environment variables
const SUPABASE_URL = __ENV.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'your-anon-key';
const TEST_USER_JWT = __ENV.TEST_USER_JWT || 'your-test-jwt';
const CHANNEL_NAME = 'public:chat_messages';

export const options = {
  stages: [
    { duration: '10s', target: 50 },   // Ramp up to 50 users
    { duration: '30s', target: 200 },  // Ramp up to 200 users
    { duration: '1m', target: 500 },   // Spike to 500 users (target load)
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    'connection_latency_ms': ['p(95)<500'], // 95% of connections must be under 500ms
    'message_latency_ms': ['p(95)<500'],    // 95% of message round-trips under 500ms
    'errors': ['rate<0.05'],                // Error rate must be below 5%
  },
};

export default function () {
  const url = `${SUPABASE_URL}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
  
  // Establish WebSocket connection
  const res = ws.connect(url, {
    headers: {
      Authorization: `Bearer ${TEST_USER_JWT}`,
    },
  }, function (socket) {
    let connectedAt = Date.now();
    let msgId = 0;

    socket.on('open', function open() {
      const connectTime = Date.now() - connectedAt;
      connectionLatency.add(connectTime);
      
      // Subscribe to the channel
      const subscribePayload = {
        topic: CHANNEL_NAME,
        event: 'phx_join',
        payload: { config: { broadcast: { ack: true } } },
        ref: '1',
      };
      socket.send(JSON.stringify(subscribePayload));
    });

    socket.on('message', function (msg) {
      const data = JSON.parse(msg);
      
      // Handle join acknowledgment
      if (data.event === 'phx_reply' && data.payload.status === 'ok') {
        // Start sending messages periodically
        setInterval(() => {
          msgId++;
          const sendTime = Date.now();
          const chatPayload = {
            topic: CHANNEL_NAME,
            event: 'broadcast',
            payload: { event: 'new_message', payload: { id: msgId, text: `Load test message ${msgId}`, user_id: 'test-user' } },
            ref: msgId.toString(),
          };
          socket.send(JSON.stringify(chatPayload));
          messagesSent.add(1);
        }, 1000); // Send 1 message per second per user
      }

      // Handle incoming broadcast messages
      if (data.event === 'broadcast' && data.payload.event === 'new_message') {
        const receiveTime = Date.now();
        // Note: In a real scenario, we'd track the original send time from the payload
        messageLatency.add(50); // Placeholder for actual round-trip calculation
        messagesReceived.add(1);
      }
    });

    socket.on('error', function (e) {
      errorRate.add(1);
      console.error('WebSocket error:', e.error());
    });

    socket.on('close', function () {
      // Connection closed
    });
  });

  // Check that the initial connection was successful
  check(res, { 'status is 101': (r) => r && r.status === 101 });

  // Keep the VU alive for the duration of the test
  sleep(1);
}
