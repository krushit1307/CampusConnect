export interface VideoProcessingJob {
  id: number;
  jobId: string;
  userId: number;
  videoId: number;
  eventId: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progressPercentage: number;
  awsJobId?: string;
  awsRekognitionJobId?: string;
  awsMediaConvertJobId?: string;
  sourceVideoS3Key: string;
  outputVideoS3Key?: string;
  framesProcessed?: number;
  totalFrames?: number;
  facesDetected?: number;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacialEmbedding {
  userId: number;
  embedding: Float32Array;
  sourcePhotoUrl: string;
  createdAt: Date;
}

export interface FaceDetectionResult {
  frameNumber: number;
  timestamp: number; // in seconds
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  confidence: number; // 0-100
  matchScore: number; // Similarity to target user embedding
}

export interface VideoProcessingConfig {
  blurRadius: number; // Gaussian blur radius in pixels (default: 25)
  confidenceThreshold: number; // Min confidence for face detection (default: 80)
  matchThreshold: number; // Min similarity score for user match (default: 85)
  frameSampleRate: number; // Process every Nth frame (default: 1 = all frames)
  outputQuality: string; // 'high' | 'medium' | 'low'
  enableAudio: boolean; // Preserve audio during re-encoding
}

export interface VideoMetadata {
  id: number;
  eventId: number;
  videoS3Key: string;
  videoDurationSeconds: number;
  frameRate: number;
  resolution: string;
  uploadDate: Date;
  createdAt: Date;
}

export interface RekognitionFaceMatch {
  faceId: string;
  matchScore: number;
  boundingBox: {
    Width: number;
    Height: number;
    Left: number;
    Top: number;
  };
}