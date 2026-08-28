export interface TranscriptWord {
  word: string;
  start: number; // in seconds
  end: number;
  confidence: number;
}

export interface TranscriptSegment {
  id: string;
  speaker: string; // e.g. "Prof. Reynolds", "Student Q&A"
  startTime: number;
  endTime: number;
  text: string;
  words: TranscriptWord[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  sourceTimestamp: number;
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
  dueDate: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface LectureSession {
  id: string;
  title: string;
  courseCode: string;
  instructor: string;
  recordedAt: string;
  audioUrl?: string;
  durationSeconds: number;
  segments: TranscriptSegment[];
  keyTakeaways: string[];
  glossary: { term: string; definition: string }[];
  flashcards: Flashcard[];
}
