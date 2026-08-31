'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';

export default function ScheduleUploader() {
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setMessage(null);
        }
    };

    const handleUpload = async () => {
        if (!file || !user) return;

        setIsUploading(true);
        setMessage(null);

        try {
            const text = await file.text();
            const response = await fetch('/api/schedules/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, icsContent: text }),
            });

            const data = await response.json();
            if (response.ok) {
                setMessage('Schedule synced successfully! No-show penalties will be waived for conflicting classes.');
                setFile(null);
            } else {
                setMessage(`Error: ${data.error}`);
            }
        } catch (error) {
            setMessage('Failed to upload schedule. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Sync Academic Schedule
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Upload your .ics calendar file to automatically waive gamification penalties for mandatory academic conflicts.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-start">
                <input
                    type="file"
                    accept=".ics"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 dark:text-gray-400
            file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
            file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100 dark:file:bg-gray-700 dark:file:text-blue-400"
                />
                <button
                    onClick={handleUpload}
                    disabled={!file || isUploading}
                    className={`
            py-2 px-6 rounded-lg font-medium transition-colors duration-200 whitespace-nowrap
            ${!file || isUploading
                            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }
          `}
                >
                    {isUploading ? 'Syncing...' : 'Upload Schedule'}
                </button>
            </div>

            {message && (
                <p className={`mt-4 text-sm ${message.includes('Error') || message.includes('Failed') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {message}
                </p>
            )}
        </div>
    );
}
