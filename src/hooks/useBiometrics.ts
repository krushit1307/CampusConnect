import { useState, useCallback, useEffect } from 'react';
import { BiometricConsentProfile, EnrichedPhotoTag, PhotoTag } from '../types/biometrics';

export const useBiometrics = (userId: string) => {
    const [profile, setProfile] = useState<BiometricConsentProfile | null>(null);
    const [tags, setTags] = useState<EnrichedPhotoTag[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchProfile = useCallback(async () => {
        setLoading(true);
        // Simulate Supabase fetch
        await new Promise(r => setTimeout(r, 400));
        setProfile({
            user_id: userId,
            has_consented: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        setLoading(false);
    }, [userId]);

    const fetchMyPhotos = useCallback(async () => {
        setLoading(true);
        // Simulate Supabase fetch of photo_tags joined with event_photos
        await new Promise(r => setTimeout(r, 600));
        setTags([
            {
                id: 'tag-1',
                photo_id: 'photo-1',
                user_id: userId,
                bounding_box_json: { Top: 0.1, Left: 0.2, Width: 0.1, Height: 0.1 },
                confidence_score: 98.4,
                status: 'CONFIRMED',
                created_at: new Date().toISOString(),
                event_photo: {
                    id: 'photo-1',
                    event_id: 'evt-1',
                    club_id: 'club-1',
                    storage_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
                    is_processed_by_ai: true,
                    created_at: new Date().toISOString()
                }
            }
        ]);
        setLoading(false);
    }, [userId]);

    const submitConsent = async (signature: string, selfieImageFile: File) => {
        setLoading(true);
        try {
            // 1. Upload selfie to secure private S3 bucket
            // 2. Call AWS Rekognition IndexFaces to get FaceId
            // 3. Update biometric_consent_profiles table
            await new Promise(r => setTimeout(r, 1500));

            setProfile(prev => prev ? {
                ...prev,
                has_consented: true,
                consent_signature: signature,
                consented_at: new Date().toISOString()
            } : null);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const revokeConsent = async () => {
        setLoading(true);
        try {
            // Update table, system will trigger AWS Rekognition DeleteFaces behind scenes
            await new Promise(r => setTimeout(r, 800));
            setProfile(prev => prev ? {
                ...prev,
                has_consented: false,
                revoked_at: new Date().toISOString()
            } : null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return {
        profile,
        tags,
        loading,
        error,
        fetchProfile,
        fetchMyPhotos,
        submitConsent,
        revokeConsent
    };
};
