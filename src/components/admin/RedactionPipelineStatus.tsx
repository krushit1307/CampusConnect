'use client';

import { useState } from 'react';
import { ErasureRequest, RedactionResult } from '@/types/privacy';

interface RedactionPipelineStatusProps {
    request: ErasureRequest;
    videoPath: string;
    outputPath: string;
}

export default function RedactionPipelineStatus({ request, videoPath, outputPath }: RedactionPipelineStatusProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<RedactionResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleTriggerPipeline = async () => {
        setIsProcessing(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/api/media/redact-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: request.userId,
                    eventId: request.eventId,
                    videoPath,
                    outputPath,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Pipeline failed');
            }

            setResult(data.result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                GDPR Erasure Request Pipeline
            </h3>

            <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">User:</span>
                    <span className="font-medium text-gray-900 dark:text-white">ID: {request.userId}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <span className={`font-medium ${request.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                            request.status === 'processing' ? 'text-yellow-600 dark:text-yellow-400' :
                                'text-gray-900 dark:text-white'
                        }`}>
                        {request.status.toUpperCase()}
                    </span>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                    {error}
                </div>
            )}

            {result && (
                <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                        {result.message}
                    </p>
                    <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
                        <p>Segments Redacted: {result.redactedSegments}</p>
                        <p>Processing Time: {(result.processingTimeMs / 1000).toFixed(2)}s</p>
                        <p>Output: {result.outputPath}</p>
                    </div>
                </div>
            )}

            <button
                onClick={handleTriggerPipeline}
                disabled={isProcessing || request.status === 'completed'}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-semibold rounded-lg shadow-md transition-colors disabled:cursor-not-allowed"
            >
                {isProcessing ? 'Processing Video...' : request.status === 'completed' ? 'Redaction Complete' : 'Run Synchronized Redaction'}
            </button>
        </div>
    );
}
