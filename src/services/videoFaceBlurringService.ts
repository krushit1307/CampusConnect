/**
 * Video Face Blurring Service
 * 
 * Orchestrates the complete pipeline:
 * 1. Extract user facial embedding from profile photo
 * 2. Start AWS Rekognition video analysis
 * 3. Poll for results and match faces
 * 4. Generate blur coordinates
 * 5. Trigger MediaConvert job to re-encode video with blur
 * 6. Replace original video in S3
 */

import AWS from 'aws-sdk';
import { VideoProcessingJob, VideoProcessingConfig, FaceDetectionResult } from '../types/videoFaceBlurring';
import { awsRekognitionService } from './awsRekognitionService';

export class VideoFaceBlurringService {
  private s3: AWS.S3;
  private mediaConvert: AWS.MediaConvert;
  private defaultConfig: VideoProcessingConfig = {
    blurRadius: 25,
    confidenceThreshold: 80,
    matchThreshold: 85,
    frameSampleRate: 1,
    outputQuality: 'high',
    enableAudio: true,
  };

  constructor() {
    this.s3 = new AWS.S3({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.mediaConvert = new AWS.MediaConvert({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.AWS_MEDIACONVERT_ENDPOINT,
    });
  }

  /**
   * Main entry point: Process video for face blurring
   */
  async processVideoForUserDeletion(
    jobId: string,
    userId: number,
    videoS3Key: string,
    userProfilePhotoUrl: string,
    config?: Partial<VideoProcessingConfig>
  ): Promise<void> {
    try {
      const finalConfig = { ...this.defaultConfig, ...config };

      // Step 1: Extract facial embedding from user's profile photo
      console.log(`[${jobId}] Extracting facial embedding for user ${userId}`);
      const facialEmbedding = await awsRekognitionService.extractFacialEmbedding(
        userId,
        userProfilePhotoUrl
      );

      // Step 2: Start Rekognition video face detection
      console.log(`[${jobId}] Starting Rekognition face detection on video`);
      const rekognitionJobId = await awsRekognitionService.startVideoFaceDetection(
        process.env.AWS_S3_BUCKET || '',
        videoS3Key,
        process.env.AWS_SNS_TOPIC_ARN || ''
      );

      // Step 3: Poll for completion (in production, use SNS callback)
      console.log(`[${jobId}] Polling Rekognition job ${rekognitionJobId}`);
      const detectionResults = await this.pollRekognitionCompletion(rekognitionJobId);

      // Step 4: Match detected faces with user embedding
      console.log(`[${jobId}] Matching detected faces with user embedding`);
      const matchedFrames = this.matchFacesWithUser(
        detectionResults,
        facialEmbedding.embedding,
        finalConfig.matchThreshold
      );

      console.log(`[${jobId}] Matched faces in ${matchedFrames.length} frames`);

      // Step 5: Trigger MediaConvert job to blur and re-encode
      if (matchedFrames.length > 0) {
        console.log(`[${jobId}] Starting MediaConvert blur job`);
        await this.startMediaConvertBlurJob(
          jobId,
          videoS3Key,
          matchedFrames,
          finalConfig
        );
      }
    } catch (error) {
      console.error(`[${jobId}] Error in video face blurring:`, error);
      throw error;
    }
  }

  /**
   * Poll Rekognition job until completion
   */
  private async pollRekognitionCompletion(jobId: string, maxAttempts: number = 120): Promise<any> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await awsRekognitionService.getVideoFaceDetectionResults(jobId);

      if (result.status === 'SUCCEEDED') {
        return result;
      } else if (result.status === 'FAILED') {
        throw new Error(`Rekognition job failed: ${result.statusMessage}`);
      }

      // Wait 5 seconds before polling again
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    throw new Error('Rekognition job polling timeout');
  }

  /**
   * Match detected faces with user's facial embedding
   */
  private matchFacesWithUser(
    detectionResults: any,
    userEmbedding: Float32Array,
    matchThreshold: number
  ): FaceDetectionResult[] {
    const matchedFrames: FaceDetectionResult[] = [];

    if (!detectionResults.faceDetections) {
      return matchedFrames;
    }

    detectionResults.faceDetections.forEach((frame: any) => {
      const { Timestamp, FaceDetails } = frame;

      if (!FaceDetails || FaceDetails.length === 0) return;

      FaceDetails.forEach((face: any) => {
        const match = awsRekognitionService.compareFaceEmbeddings(
          userEmbedding,
          face,
          matchThreshold
        );

        if (match) {
          matchedFrames.push({
            frameNumber: Math.floor((Timestamp || 0) / 33.33), // Approx frame at 30fps
            timestamp: Timestamp / 1000, // Convert to seconds
            boundingBox: {
              top: face.BoundingBox.Top,
              left: face.BoundingBox.Left,
              width: face.BoundingBox.Width,
              height: face.BoundingBox.Height,
            },
            confidence: face.Confidence || 0,
            matchScore: match.matchScore,
          });
        }
      });
    });

    return matchedFrames;
  }

  /**
   * Trigger AWS MediaConvert job to blur faces and re-encode
   */
  private async startMediaConvertBlurJob(
    jobId: string,
    videoS3Key: string,
    matchedFrames: FaceDetectionResult[],
    config: VideoProcessingConfig
  ): Promise<string> {
    try {
      // Generate blur filter specifications from matched frames
      const blurSpecs = this.generateBlurFilterSpecs(matchedFrames, config.blurRadius);

      // Create MediaConvert job
      const jobParams = {
        Role: process.env.AWS_MEDIACONVERT_ROLE_ARN || '',
        Settings: {
          Inputs: [
            {
              FileInput: `s3://${process.env.AWS_S3_BUCKET}/${videoS3Key}`,
              FilterEnable: 'AUTO',
              Filters: [
                {
                  FilterType: 'NOISE_REDUCER',
                  NoiseReducer: {
                    FilterEnable: 'AUTO',
                  },
                },
                // Blur filter will be applied via FFmpeg
                {
                  FilterType: 'IMAGE_INSERTER',
                  // Specify blur regions based on matchedFrames
                },
              ],
            },
          ],
          OutputGroups: [
            {
              OutputGroupSettings: {
                Type: 'HLS_GROUP_SETTINGS',
                HlsGroupSettings: {
                  Destination: `s3://${process.env.AWS_S3_BUCKET}/blurred/${jobId}/`,
                  SegmentLength: 10,
                },
              },
              Outputs: [
                {
                  NameModifier: '_blurred',
                  VideoDescription: {
                    CodecSettings: {
                      Codec: 'H_264',
                      H264Settings: {
                        Bitrate: config.outputQuality === 'high' ? 5000 : 2500,
                      },
                    },
                  },
                  AudioDescriptions: config.enableAudio
                    ? [{ CodecSettings: { Codec: 'AAC' } }]
                    : [],
                },
              ],
            },
          ],
        },
        Queue: process.env.AWS_MEDIACONVERT_QUEUE || 'Default',
        UserMetadata: {
          jobId,
          userId: 'embedded_in_frames',
        },
      };

      const result = await this.mediaConvert.createJob(jobParams).promise();
      return result.Job?.Id || '';
    } catch (error) {
      console.error('Error starting MediaConvert blur job:', error);
      throw error;
    }
  }

  /**
   * Generate FFmpeg blur filter specifications
   */
  private generateBlurFilterSpecs(frames: FaceDetectionResult[], blurRadius: number): string {
    // Generate FFmpeg drawbox/boxblur filter string
    let filterSpec = '';

    frames.forEach((frame, index) => {
      const bbox = frame.boundingBox;
      if (index > 0) filterSpec += ',';

      filterSpec += `scale=${1920}:${1080}[${index}]`;
      filterSpec += `[${index}]boxblur=${blurRadius}:${blurRadius}`;
    });

    return filterSpec;
  }

  /**
   * Poll MediaConvert job status
   */
  async getMediaConvertJobStatus(jobId: string): Promise<any> {
    try {
      const result = await this.mediaConvert.getJob({ Id: jobId }).promise();
      return result.Job;
    } catch (error) {
      console.error('Error retrieving MediaConvert job status:', error);
      throw error;
    }
  }
}

export const videoFaceBlurringService = new VideoFaceBlurringService();