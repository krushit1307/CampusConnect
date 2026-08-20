// =============================================================================
// Component: EventPosterUpload
//  Issue: #3548 - Implement 'Automated Event Poster Auto-Cropping & Resizing'
//  Description: Drag-and-drop upload zone for event posters. Handles massive
//  file uploads, displays a live preview, and shows the processing status
//  as the background Edge Function generates WebP variants.
// =============================================================================

import React, { useState, useRef } from 'react';
import { useImageProcessing, ProcessingStatus } from '../../hooks/useImageProcessing';

interface EventPosterUploadProps {
    eventId: string;
    onUploadComplete: () => void;
}

export const EventPosterUpload: React.FC<EventPosterUploadProps> = ({ eventId, onUploadComplete }) => {
    const { imageData, isUploading, error, uploadAndProcess } = useImageProcessing(eventId);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file (JPG, PNG, WebP).');
            return;
        }

        // Warn if file is extremely large (> 20MB)
        if (file.size > 20 * 1024 * 1024) {
            if (!confirm('This image is over 20MB. It will be compressed automatically, but upload may take a moment. Continue?')) {
                return;
            }
        }

        setPreviewUrl(URL.createObjectURL(file));
        const success = await uploadAndProcess(eventId, file);
        if (success) {
            onUploadComplete();
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const getStatusBadge = (status: ProcessingStatus) => {
        switch (status) {
            case 'pending':
                return <span className="px-2 py-1 text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">Queued</span>;
            case 'processing':
                return (
                    <span className="px-2 py-1 text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full flex items-center gap-1">
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating WebP Variants...
                    </span>
                );
            case 'completed':
                return <span className="px-2 py-1 text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">✅ Optimized</span>;
            case 'failed':
                return <span className="px-2 py-1 text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">❌ Failed</span>;
        }
    };

    const isProcessing = isUploading || imageData?.status === 'processing' || imageData?.status === 'pending';

    return (
        <div className="space-y-4">
            <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${dragActive
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-gray-50 dark:bg-gray-900/50'
                    } ${isProcessing ? 'pointer-events-none opacity-80' : ''}`}
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleChange}
                    disabled={isProcessing}
                />

                {previewUrl || imageData?.original_url ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative w-full max-h-64 flex justify-center">
                            <img
                                src={previewUrl || imageData?.original_url}
                                alt="Poster Preview"
                                className="max-h-64 rounded-lg shadow-md object-contain"
                            />
                            {imageData && (
                                <div className="absolute top-2 right-2">
                                    {getStatusBadge(imageData.status)}
                                </div>
                            )}
                        </div>

                        {isUploading && (
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium">
                                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Uploading massive poster...</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="text-gray-600 dark:text-gray-400">
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">Click to upload</span> or drag and drop
                        </div>
                        <p className="text-xs text-gray-500">
                            Massive 4K posters are fine! We'll automatically compress and crop them for WebP.
                        </p>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {imageData?.status === 'failed' && imageData.error_message && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                    Processing failed: {imageData.error_message}
                </div>
            )}
        </div>
    );
};
