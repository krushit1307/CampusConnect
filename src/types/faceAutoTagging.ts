// src/types/faceAutoTagging.ts

export interface UserFaceOptIn {
  userId: string;
  optedIn: boolean;
  facePhotos: string[];
  faceIndexedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoTag {
  id: string;
  photoId: string;
  userId: string;
  confidence: number; // e.g. 0.9650 (> 0.95 requirement)
  createdAt: string;
}

export interface FaceIndexingResponse {
  success: boolean;
  message: string;
  indexedAt?: string;
}

export interface ProcessPhotosResponse {
  success: boolean;
  message: string;
  processedPhotos: number;
  newTagsCount: number;
  notifiedUsersCount: number;
}
