// client/src/components/DirectorDashboard.tsx

import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface CameraFeed {
    id: string;
    name: string;
    stream?: MediaStream;
}

export const DirectorDashboard: React.FC = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [cameras, setCameras] = useState<CameraFeed[]>([
        { id: 'cam-1', name: 'Runway Entrance' },
        { id: 'cam-2', name: 'Backstage Makeup' },
        { id: 'cam-3', name: 'Stage Left Wide' },
    ]);
    const [activeCamId, setActiveCamId] = useState<string | null>(null);

    useEffect(() => {
        const newSocket = io('http://localhost:4000');
        setSocket(newSocket);

        newSocket.on('tally-update', ({ activeCameraId }) => {
            setActiveCamId(activeCameraId);
        });

        return () => {
            newSocket.close();
        };
    }, []);

    const handleSwitch = (id: string) => {
        setActiveCamId(id);
        socket?.emit('set-active-camera', id);
    };

    return (
        <div className="p-6 bg-slate-900 min-h-screen text-white">
            <header className="mb-6 flex justify-between items-center border-b border-slate-800 pb-4">
                <h1 className="text-2xl font-bold">Virtual Event Switcher - Director Dashboard</h1>
                <div className="px-4 py-2 bg-slate-800 rounded-lg text-sm font-medium">
                    Live Program Output: <span className="text-red-500 font-bold">{activeCamId || 'None'}</span>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {cameras.map((cam) => {
                    const isActive = activeCamId === cam.id;
                    return (
                        <div 
                            key={cam.id} 
                            className={`relative bg-slate-800 rounded-xl overflow-hidden border-4 transition-all duration-300 ${
                                isActive ? 'border-red-600 shadow-lg shadow-red-600/30' : 'border-slate-700'
                            }`}
                        >
                            <div className="absolute top-3 left-3 z-10 flex items-center space-x-2">
                                <span className={`px-2 py-1 text-xs font-bold rounded uppercase ${isActive ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-700 text-slate-300'}`}>
                                    {isActive ? 'LIVE (PGM)' : 'STANDBY'}
                                </span>
                                <span className="bg-black/60 px-2 py-1 text-xs rounded">{cam.name}</span>
                            </div>

                            <div className="aspect-video bg-black flex items-center justify-center text-slate-500">
                                {/* Video element placeholder for WebRTC remote stream */}
                                <video id={`video-${cam.id}`} autoPlay playsInline muted className="w-full h-full object-cover" />
                            </div>

                            <div className="p-4 bg-slate-800/80 flex justify-between items-center">
                                <span className="text-sm font-medium text-slate-300">{cam.id}</span>
                                <button
                                    onClick={() => handleSwitch(cam.id)}
                                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                        isActive ? 'bg-red-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'
                                    }`}
                                >
                                    {isActive ? 'On Air' : 'Take Live'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
