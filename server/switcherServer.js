// server/switcherServer.js

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const mediasoup = require('mediasoup');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

let worker;
let router;
let producers = new Map(); // socketId -> producer
let activeCameraId = null;

async function startMediasoup() {
    worker = await mediasoup.createWorker({
        rtcMinPort: 10000,
        rtcMaxPort: 10100,
    });
    
    router = await worker.createRouter({
        mediaCodecs: [
            {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2,
            },
            {
                kind: 'video',
                mimeType: 'video/VP8',
                clockRate: 90000,
                parameters: { 'packetization-mode': 1 },
            },
        ],
    });
    console.log(`MediaSoup Router created: ${router.id}`);
}

startMediasoup();

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.emit('router-rtp-capabilities', router.rtpCapabilities);

    socket.on('register-camera', () => {
        socket.join('cameras');
        console.log(`Camera node registered: ${socket.id}`);
    });

    socket.on('set-active-camera', (cameraId) => {
        activeCameraId = cameraId;
        console.log(`Active camera switched to: ${cameraId}`);
        // Broadcast tally state to all connected camera nodes
        io.to('cameras').emit('tally-update', { activeCameraId });
        io.emit('director-feed-switched', { activeCameraId });
    });

    socket.on('disconnect', () => {
        producers.delete(socket.id);
        if (activeCameraId === socket.id) {
            activeCameraId = null;
            io.emit('tally-update', { activeCameraId: null });
        }
        console.log(`Client disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Virtual Switcher backend running on port ${PORT}`);
});

module.exports = { app, server };
