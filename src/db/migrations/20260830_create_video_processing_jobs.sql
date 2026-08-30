-- Create Video Processing Jobs Table
CREATE TABLE IF NOT EXISTS video_processing_jobs (
  id SERIAL PRIMARY KEY,
  job_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL,
  video_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  
  -- Job Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  progress_percentage INTEGER DEFAULT 0,
  
  -- AWS Processing Details
  aws_job_id VARCHAR(255),
  aws_rekognition_job_id VARCHAR(255),
  aws_mediaconvert_job_id VARCHAR(255),
  
  -- Source & Output
  source_video_s3_key VARCHAR(500) NOT NULL,
  output_video_s3_key VARCHAR(500),
  
  -- Facial Embedding
  user_facial_embedding BYTEA, -- Stored as binary data from profile photo
  
  -- Tracking
  frames_processed INTEGER DEFAULT 0,
  total_frames INTEGER,
  faces_detected INTEGER DEFAULT 0,
  processing_started_at TIMESTAMP,
  processing_completed_at TIMESTAMP,
  
  -- Error Handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX idx_video_jobs_user_id ON video_processing_jobs(user_id);
CREATE INDEX idx_video_jobs_status ON video_processing_jobs(status);
CREATE INDEX idx_video_jobs_event_id ON video_processing_jobs(event_id);
CREATE INDEX idx_video_jobs_aws_job_id ON video_processing_jobs(aws_rekognition_job_id);

-- Create Video Metadata Table (references for VOD details)
CREATE TABLE IF NOT EXISTS video_metadata (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL UNIQUE,
  video_s3_key VARCHAR(500) NOT NULL,
  video_duration_seconds INTEGER,
  frame_rate INTEGER DEFAULT 30,
  resolution VARCHAR(50), -- e.g., "1920x1080"
  upload_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_video_metadata_event_id ON video_metadata(event_id);