export interface ChunkUploadOptions {
  file: File;
  chunkSize?: number; // Defaults to 5MB (5 * 1024 * 1024)
  onProgress?: (progress: number) => void;
}

export interface ChunkedUploadState {
  uploadId: string;
  bytesUploaded: number;
  totalBytes: number;
  isComplete: boolean;
  isPaused: boolean;
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const STORAGE_PREFIX = "campusconnect_chunked_upload_";

export class ChunkedUploader {
  private file: File;
  private chunkSize: number;
  private onProgress?: (progress: number) => void;
  private uploadId: string;
  private bytesUploaded: number = 0;
  private isPaused: boolean = false;

  constructor(options: ChunkUploadOptions) {
    this.file = options.file;
    this.chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
    this.onProgress = options.onProgress;
    this.uploadId = `${STORAGE_PREFIX}${this.file.name}_${this.file.size}`;

    // Restore previous upload session if available
    const saved = localStorage.getItem(this.uploadId);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.bytesUploaded = parsed.bytesUploaded || 0;
      } catch {
        this.bytesUploaded = 0;
      }
    }
  }

  public getProgress(): number {
    if (this.file.size === 0) return 100;
    return Math.min(Math.round((this.bytesUploaded / this.file.size) * 100), 100);
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public async start(): Promise<ChunkedUploadState> {
    while (this.bytesUploaded < this.file.size && !this.isPaused) {
      const nextChunkEnd = Math.min(this.bytesUploaded + this.chunkSize, this.file.size);
      const chunk = this.file.slice(this.bytesUploaded, nextChunkEnd);

      // Simulate chunk dispatch
      await this.uploadChunk(chunk);

      this.bytesUploaded = nextChunkEnd;

      // Persist upload progress state
      localStorage.setItem(this.uploadId, JSON.stringify({ bytesUploaded: this.bytesUploaded }));

      if (this.onProgress) {
        this.onProgress(this.getProgress());
      }
    }

    const isComplete = this.bytesUploaded >= this.file.size;
    if (isComplete) {
      localStorage.removeItem(this.uploadId);
    }

    return {
      uploadId: this.uploadId,
      bytesUploaded: this.bytesUploaded,
      totalBytes: this.file.size,
      isComplete,
      isPaused: this.isPaused,
    };
  }

  private async uploadChunk(_chunk: Blob): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 10));
  }
}
