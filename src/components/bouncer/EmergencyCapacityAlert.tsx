'use client';

export default function EmergencyCapacityAlert({ onReset }: { onReset: () => void }) {
    return (
        <div className="fixed inset-0 z-50 bg-red-900/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
            <div className="max-w-3xl w-full">
                <svg className="w-32 h-32 text-white mx-auto mb-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h1 className="text-6xl font-black text-white mb-6 tracking-tight uppercase">
                    Venue At Maximum Capacity
                </h1>
                <p className="text-2xl text-red-200 mb-8 font-medium">
                    By order of the Fire Marshal, no further entries are permitted.
                    All un-scanned tickets have been automatically invalidated and refunded.
                </p>
                <div className="bg-black/30 p-6 rounded-xl border border-red-700 mb-8">
                    <p className="text-xl text-white font-bold">DO NOT ADMIT ANY MORE ATTENDEES</p>
                    <p className="text-red-300 mt-2">Direct late arrivals to the refund information desk.</p>
                </div>
                <button
                    onClick={onReset}
                    className="px-8 py-4 bg-white text-red-900 font-bold text-xl rounded-xl hover:bg-gray-200 transition-colors shadow-2xl"
                >
                    Acknowledge & Refresh Status
                </button>
            </div>
        </div>
    );
}
