'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { EventCapacity } from '@/types/bouncer';
import { getEventCapacity, triggerEmergencyHalt } from '@/lib/bouncer/capacityControl';
import EmergencyCapacityAlert from '@/components/bouncer/EmergencyCapacityAlert';
import { useAuth } from '@/lib/auth';

export default function BouncerCheckInPage() {
    const params = useParams();
    const eventId = params.eventId as string;
    const { user } = useAuth();

    const [capacity, setCapacity] = useState<EventCapacity | null>(null);
    const [scanInput, setScanInput] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Poll capacity every 3 seconds
    useEffect(() => {
        async function fetchCapacity() {
            try {
                const data = await getEventCapacity(eventId);
                setCapacity(data);
            } catch (error) {
                console.error('Failed to fetch capacity:', error);
            }
        }
        fetchCapacity();
        const interval = setInterval(fetchCapacity, 3000);
        return () => clearInterval(interval);
    }, [eventId]);

    // Auto-focus input for continuous scanning
    useEffect(() => {
        inputRef.current?.focus();
    }, [message]);

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scanInput.trim() || !user || isProcessing) return;

        setIsProcessing(true);
        setMessage(null);

        try {
            const response = await fetch(`/api/events/${eventId}/check-in`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId,
                    ticketId: scanInput.trim(),
                    userId: 'unknown', // In real app, resolve ticket to user
                    bouncerId: user.id,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                // Play success sound in real implementation
            } else {
                setMessage({ type: 'error', text: data.message });
                // Play error sound in real implementation

                if (data.refundTriggered) {
                    // Brief delay to let bouncer read the refund message
                    setTimeout(() => setMessage(null), 5000);
                }
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Scan failed. Please try again.' });
        } finally {
            setScanInput('');
            setIsProcessing(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleEmergencyHalt = async () => {
        if (!user) return;
        if (confirm('ARE YOU SURE? This will invalidate ALL remaining tickets and deny entry to everyone else.')) {
            try {
                await triggerEmergencyHalt(eventId, user.id, 'Manual trigger by Bouncer');
                setMessage({ type: 'error', text: 'EMERGENCY HALT ACTIVATED. All remaining tickets invalidated.' });
                const data = await getEventCapacity(eventId);
                setCapacity(data);
            } catch (error) {
                setMessage({ type: 'error', text: 'Failed to activate emergency halt.' });
            }
        }
    };

    if (!capacity) {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading Bouncer App...</div>;
    }

    const isAtCapacity = capacity.checked_in_count >= capacity.venue_physical_capacity;

    return (
        <div className={`min-h-screen flex flex-col ${isAtCapacity || capacity.emergency_halt_active ? 'bg-red-950' : 'bg-gray-900'}`}>
            {capacity.emergency_halt_active && (
                <EmergencyCapacityAlert onReset={() => window.location.reload()} />
            )}

            <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
                <div className="w-full bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700 mb-6">
                    <h1 className="text-3xl font-bold text-white mb-2 text-center">Bouncer Check-In</h1>
                    <p className="text-gray-400 text-center mb-8">Scan QR code or enter Ticket ID</p>

                    <div className="mb-8">
                        <div className="flex justify-between text-sm text-gray-400 mb-2">
                            <span>Checked In</span>
                            <span>Capacity</span>
                        </div>
                        <div className="flex items-end space-x-2 mb-2">
                            <span className={`text-5xl font-bold ${isAtCapacity ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
                                {capacity.checked_in_count}
                            </span>
                            <span className="text-2xl text-gray-500 mb-2">/</span>
                            <span className="text-2xl text-gray-400 mb-2">{capacity.venue_physical_capacity}</span>
                        </div>
                        <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${isAtCapacity ? 'bg-red-600' : 'bg-green-500'}`}
                                style={{ width: `${Math.min((capacity.checked_in_count / capacity.venue_physical_capacity) * 100, 100)}%` }}
                            />
                        </div>
                    </div>

                    <form onSubmit={handleScan} className="space-y-4">
                        <input
                            ref={inputRef}
                            type="text"
                            value={scanInput}
                            onChange={(e) => setScanInput(e.target.value)}
                            placeholder="Scan or type Ticket ID..."
                            disabled={isProcessing || capacity.emergency_halt_active}
                            className="w-full p-4 text-xl text-center bg-gray-900 border-2 border-gray-600 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                            autoComplete="off"
                        />
                        <button
                            type="submit"
                            disabled={isProcessing || !scanInput.trim() || capacity.emergency_halt_active}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold text-xl rounded-xl transition-colors"
                        >
                            {isProcessing ? 'Processing...' : 'CONFIRM ENTRY'}
                        </button>
                    </form>

                    {message && (
                        <div className={`mt-6 p-4 rounded-xl text-center font-bold text-lg ${message.type === 'success'
                                ? 'bg-green-900/50 text-green-300 border border-green-700'
                                : 'bg-red-900/50 text-red-300 border border-red-700 animate-pulse'
                            }`}>
                            {message.text}
                        </div>
                    )}
                </div>

                {!capacity.emergency_halt_active && (
                    <button
                        onClick={handleEmergencyHalt}
                        className="w-full py-6 bg-red-600 hover:bg-red-700 text-white font-black text-2xl rounded-xl shadow-lg border-4 border-red-800 animate-pulse transition-transform hover:scale-105"
                    >
                        🚨 EMERGENCY CAPACITY REACHED - HALT ENTRY 🚨
                    </button>
                )}
            </div>
        </div>
    );
}
