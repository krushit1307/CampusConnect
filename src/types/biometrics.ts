/**
 * Biometric Face Recognition Types
 */

export interface BiometricConsentProfile {
    user_id: string;
    has_consented: boolean;
    reference_face_s3_key?: string;
    aws_rekognition_face_id?: string;
    consent_signature?: string;
    consented_at?: string;
    revoked_at?: string;
    created_at: string;
    updated_at: string;
}

export interface EventPhoto {
    id: string;
    event_id: string;
    club_id: string;
    storage_url: string;
    blurhash?: string;
    is_processed_by_ai: boolean;
    created_at: string;
}

export interface BoundingBox {
    Width: number;
    Height: number;
    Left: number;
    Top: number;
}

export type FaceTagStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export interface PhotoTag {
    id: string;
    photo_id: string;
    user_id: string;
    bounding_box_json: BoundingBox;
    confidence_score: number;
    status: FaceTagStatus;
    created_at: string;
}

export interface EnrichedPhotoTag extends PhotoTag {
    event_photo: EventPhoto; // Joined relation
}
