// =============================================================================
// Component: PitchVideoUpload
// Issue: #3681 - Build an 'Interactive "Club Pitch" Video Carousel'
// Description: Admin upload flow with instant client-side pre-validation
// (duration + aspect via video metadata) before pushing to storage and the
// FFmpeg validation Edge Function.
// =============================================================================

import React, { useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface PitchVideoUploadProps {
    clubId: string;
    onUploaded: () => void;
}

export const PitchVideoUpload: React.FC<PitchVideoUploadProps> = ({ clubId, onUploaded }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Client-side pre-check using the browser's own media decoder
    const preValidate = (file: File): Promise<{ duration: number; aspect: number }> =>
        new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                const duration = video.duration;
                const aspect = video.videoWidth / Math.max(1, video.videoHeight);
                URL.revokeObjectURL(url);
                resolve({ duration, aspect });
            };
            video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not a readable video file.')); };
            video.src = url;
        });

    const handleFile = async (file: File) => {
        setError(null);
        setIsUploading(true);
        try {
            // 1. Fast client-side gate (server re-validates with FFmpeg)
            const { duration, aspect } = await preValidate(file);
            if (duration > 15.5) throw new Error(`Video is ${duration.toFixed(1)}s — max is 15s.`);
            if (Math.abs(aspect - 9 / 16) > 0.08) throw new Error('Video must be vertical 9:16.');

            // 2. Upload to storage
            const path = `pitch-videos/${clubId}/${Date.now()}_${file.name}`;
            const { error: upErr } = await supabase.storage.from('club-media').upload(path, file, {
                contentType: file.type, upsert: true,
            });
            if (upErr) throw upErr;

            const { data: { publicUrl } } = supabase.storage.from('club-media').getPublicUrl(path);

            // 3. Trigger FFmpeg validation pipeline
            const { error: fnErr } = await supabase.functions.invoke('validate-pitch-video', {
                body: { club_id: clubId, object_path: path, public_url: publicUrl },
            });
            if (fnErr) throw fnErr;

            onUploaded();
        } catch (err: any) {
            setError(err.message || 'Upload failed.');
        } finally {
            setIsUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-3">
            <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <button
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors disabled:opacity-50"
            >
                {isUploading ? 'Uploading & validating…' : ' Upload 15s Vertical Pitch Video (9:16)'}
            </button>
            {error && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
                    {error}
                </p>
            )}
        </div>
    );
};
