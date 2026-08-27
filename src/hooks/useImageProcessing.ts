// =============================================================================
// Hook: useImageProcessing
// Issue: #3548 - Implement 'Automated Event Poster Auto-Cropping & Resizing'
// Description: Manages the upload of massive poster images to Supabase Storage,
    // creates the event_images record, and triggers the background Edge Function
// to generate WebP variants.Polls for completion status.
    // =============================================================================

    import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { AccessibilityViolation } from '../lib/accessibilityLinter';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface EventImageData {
    id: string;
    event_id: string;
    original_url: string;
    thumb_sq_url: string | null;
    banner_url: string | null;
    full_url: string | null;
    alt_text: string | null;
    status: ProcessingStatus;
    error_message: string | null;
}
interface UseImageProcessingReturn {
    imageData: EventImageData | null;
    isUploading: boolean;
    error: string | null;
    uploadAndProcess: (eventId: string, file: File, altText: string) => Promise<boolean>;
    fetchImage: (eventId: string) => Promise<void>;
    logAccessibilityBypass: (eventId: string, violations: AccessibilityViolation[]) => Promise<void>;
}
export function useImageProcessing(eventId: string | null): UseImageProcessingReturn {
    const [imageData, setImageData] = useState<EventImageData | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const pollRef = useRef<NodeJS.Timeout | null>(null);

    const fetchImage = useCallback(async () => {
        if (!eventId) return;

        try {
            const { data, error: fetchError } = await supabase
                .from('event_images')
                .select('*')
                .eq('event_id', eventId)
                .maybeSingle();

            if (fetchError) throw fetchError;
            setImageData(data as EventImageData | null);
        } catch (err: any) {
            console.error('[useImageProcessing] Fetch failed:', err);
        }
    }, [eventId]);

    // Poll for status updates if processing
    useEffect(() => {
        if (imageData?.status === 'processing' || imageData?.status === 'pending') {
            pollRef.current = setInterval(() => {
                fetchImage();
            }, 2000); // Poll every 2 seconds
        } else {
            if (pollRef.current) clearInterval(pollRef.current);
        }

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [imageData?.status, fetchImage]);

    useEffect(() => {
        fetchImage();
    }, [fetchImage]);

    const uploadAndProcess = async (eventId: string, file: File, altText: string): Promise<boolean> => {        setIsUploading(true);
        setError(null);

        try {
            // 1. Upload original image to Storage
            const fileExt = file.name.split('.').pop() || 'jpg';
            const fileName = `${eventId}/original_${Date.now()}.${fileExt}`;
            const filePath = `event-posters/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('event-media')
                .upload(filePath, file, { cacheControl: '3600', upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('event-media')
                .getPublicUrl(filePath);

            // 2. Insert record into event_images table
            const { data: imageRecord, error: insertError } = await supabase
                .from('event_images')
                .upsert({
                    event_id: eventId,
                    original_url: publicUrl,
                    alt_text: altText,
                    status: 'pending'
                }, { onConflict: 'event_id' })                .select()
                .single();

            if (insertError || !imageRecord) throw insertError;

            // 3. Trigger Edge Function for background processing
            const { error: fnError } = await supabase.functions.invoke('process-poster', {
                body: { image_id: imageRecord.id, original_url: publicUrl }
            });

            if (fnError) throw fnError;

            setImageData(imageRecord as EventImageData);
            setIsUploading(false);
            return true;
        } catch (err: any) {
            console.error('[useImageProcessing] Upload failed:', err);
            setError(err.message || 'Failed to upload and process image.');
            setIsUploading(false);
            return false;
        }
    };

    const logAccessibilityBypass = useCallback(
        async (eventId: string, violations: AccessibilityViolation[]) => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const rows = violations.map((violation) => ({
                    event_id: eventId,
                    user_id: user?.id ?? null,
                    violation_type: violation.type,
                    details: violation.message,
                    bypassed: true,
                }));
                const { error: logError } = await supabase
                    .from('accessibility_violations')
                    .insert(rows);
                if (logError) throw logError;
            } catch (err: any) {
                console.error('[useImageProcessing] Failed to log accessibility bypass:', err);
            }
        },
        [],
    );

    return { imageData, isUploading, error, uploadAndProcess, fetchImage, logAccessibilityBypass };
}