export interface UserPresence {
  id: string;
  name: string;
  avatarUrl?: string;
  color: string;
  cursor?: { x: number; y: number };
  activeSection: 'whiteboard' | 'notes';
  lastActive: string;
}

export interface WhiteboardElement {
  id: string;
  type: 'path' | 'rectangle' | 'circle' | 'text' | 'sticky';
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color: string;
  strokeWidth: number;
  text?: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface NoteDocument {
  id: string;
  title: string;
  content: string;
  version: number;
  updatedAt: string;
  lastEditor: string;
  tags: string[];
}

export interface WorkspaceSession {
  id: string;
  clubId: string;
  title: string;
  description: string;
  document: NoteDocument;
  elements: WhiteboardElement[];
  activeUsers: UserPresence[];
}
