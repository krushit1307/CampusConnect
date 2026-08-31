/**
 * AWS Rekognition Service
 * 
 * Handles:
 * - Facial embedding creation from profile photos
 * - Video face detection and tracking
 * - Similarity matching between embeddings
 */

import AWS from 'aws-sdk';
import { FacialEmbedding, RekognitionFaceMatch } from '../types/videoFaceBlurring';

export class AwsRekognitionService {
  private rekognition: AWS.Rekognition;
  private s3: AWS.S3;

  constructor() {
    this.rekognition = new AWS.Rekognition({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.s3 = new AWS.S3({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Create facial embedding from user's profile photo
   */
  async extractFacialEmbedding(
    userId: number,
    photoUrl: string
  ): Promise<FacialEmbedding> {
    try {
      // Fetch photo from URL
      const response = await fetch(photoUrl);
      const buffer = await response.arrayBuffer();
      const imageBytes = new Uint8Array(buffer);

      // Call Rekognition to detect faces
      const detectParams = {
        Image: {
          Bytes: imageBytes as any,
        },
        Attributes: ['ALL'],
      };

      const detectResult = await this.rekognition.detectFaces(detectParams).promise();

      if (!detectResult.FaceDetails || detectResult.FaceDetails.length === 0) {
        throw new Error('No face detected in profile photo');
      }

      // Convert face data to embedding representation
      const embedding = this.convertFaceDetailsToEmbedding(detectResult.FaceDetails[0]);

      return {
        userId,
        embedding,
        sourcePhotoUrl: photoUrl,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('Error extracting facial embedding:', error);
      throw error;
    }
  }

  /**
   * Start video face detection job in Rekognition
   * Returns job ID for polling
   */
  async startVideoFaceDetection(
    videoS3Bucket: string,
    videoS3Key: string,
    notificationTopicArn: string
  ): Promise<string> {
    try {
      const params = {
        Video: {
          S3Object: {
            Bucket: videoS3Bucket,
            Name: videoS3Key,
          },
        },
        NotificationChannel: {
          SNSTopicArn: notificationTopicArn,
          RoleArn: process.env.AWS_REKOGNITION_ROLE_ARN!,
        },
        FaceAttributes: ['ALL'],
      };

      const result = await this.rekognition.startFaceDetection(params).promise();
      return result.JobId || '';
    } catch (error) {
      console.error('Error starting Rekognition face detection:', error);
      throw error;
    }
  }

  /**
   * Poll for Rekognition job completion
   */
  async getVideoFaceDetectionResults(jobId: string): Promise<any> {
    try {
      const params = { JobId: jobId };
      const result = await this.rekognition.getFaceDetection(params).promise();

      return {
        status: result.JobStatus,
        statusMessage: result.StatusMessage,
        faceDetections: result.FaceDetections,
        videoMetadata: result.VideoMetadata,
      };
    } catch (error) {
      console.error('Error retrieving face detection results:', error);
      throw error;
    }
  }

  /**
   * Compare user's embedding with detected faces
   */
  compareFaceEmbeddings(
    userEmbedding: Float32Array,
    detectedFace: any,
    threshold: number = 85
  ): RekognitionFaceMatch | null {
    // Calculate cosine similarity between embeddings
    const similarity = this.cosineSimilarity(userEmbedding, detectedFace.Embeddings || []);
    const matchScore = similarity * 100;

    if (matchScore >= threshold) {
      return {
        faceId: detectedFace.FaceId || '',
        matchScore,
        boundingBox: detectedFace.BoundingBox,
      };
    }

    return null;
  }

  /**
   * Convert Rekognition FaceDetails to embedding format
   */
  private convertFaceDetailsToEmbedding(faceDetails: any): Float32Array {
    // Create a normalized embedding from face attributes
    const attributes = [
      faceDetails.AgeRange?.Low || 0,
      faceDetails.AgeRange?.High || 0,
      faceDetails.Smile?.Value ? 1 : 0,
      faceDetails.EyesOpen?.Value ? 1 : 0,
      faceDetails.MouthOpen?.Value ? 1 : 0,
      faceDetails.Gender?.Value === 'Male' ? 1 : 0,
    ];

    return new Float32Array(attributes);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: Float32Array, b: any[]): number {
    if (a.length === 0 || b.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dotProduct += a[i] * (b[i] || 0);
      normA += a[i] * a[i];
      normB += (b[i] || 0) * (b[i] || 0);
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export const awsRekognitionService = new AwsRekognitionService();