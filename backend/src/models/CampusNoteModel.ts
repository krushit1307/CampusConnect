export interface CourseNote {
  id: string;
  title: string;
  courseCode: string;
  courseTitle: string;
  department: string;
  authorName: string;
  authorAvatar: string;
  fileFormat: 'pdf' | 'docx' | 'markdown' | 'goodnotes';
  fileSize: string;
  pageCount: number;
  upvotes: number;
  downloads: number;
  tags: string[];
  description: string;
  postedDate: string;
  isVerified: boolean;
}

export interface NoteBookmark {
  id: string;
  noteId: string;
  noteTitle: string;
  courseCode: string;
  savedDate: string;
}

export interface NoteFilterOptions {
  department: string;
  fileFormat: string;
  verifiedOnly: boolean;
  searchQuery: string;
}

const INITIAL_NOTES: CourseNote[] = [
  {
    id: "note-101",
    title: "Comprehensive Data Structures & Algorithm Complexity Cheat Sheet",
    courseCode: "CS 301",
    courseTitle: "Data Structures & Algorithms",
    department: "Computer Science",
    authorName: "Elena Rostova",
    authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    fileFormat: "pdf",
    fileSize: "4.2 MB",
    pageCount: 18,
    upvotes: 142,
    downloads: 389,
    tags: ["Trees", "Graph Algorithms", "Dynamic Programming", "Big-O"],
    description: "Hand-written and digitised lecture summary covering tree traversals, Dijkstra/A* pathfinding, and dynamic programming memoization templates.",
    postedDate: "3 days ago",
    isVerified: true,
  },
  {
    id: "note-102",
    title: "Multivariable Calculus Vector Fields & Green's Theorem Guide",
    courseCode: "MATH 241",
    courseTitle: "Multivariable Calculus",
    department: "Mathematics",
    authorName: "Marcus Vance",
    authorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    fileFormat: "goodnotes",
    fileSize: "12.5 MB",
    pageCount: 24,
    upvotes: 98,
    downloads: 215,
    tags: ["Calculus III", "Line Integrals", "Divergence Theorem"],
    description: "Detailed iPad GoodNotes notebook export with color-coded diagrams for surface integrals, Stoke's theorem, and gradient vectors.",
    postedDate: "1 week ago",
    isVerified: true,
  },
  {
    id: "note-103",
    title: "Organic Chemistry II Reaction Mechanisms & Synthesis Index",
    courseCode: "CHEM 210",
    courseTitle: "Organic Chemistry II",
    department: "Chemistry",
    authorName: "Sophia Chen",
    authorAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    fileFormat: "pdf",
    fileSize: "8.1 MB",
    pageCount: 32,
    upvotes: 210,
    downloads: 540,
    tags: ["Orgo II", "Spectroscopy", "Reaction Maps", "NMR"],
    description: "Complete reaction map reference guide for aldehyde/ketone additions, carboxylic acid derivatives, and 1H NMR splitting patterns.",
    postedDate: "2 days ago",
    isVerified: true,
  },
];

const INITIAL_BOOKMARKS: NoteBookmark[] = [
  {
    id: "bm-201",
    noteId: "note-101",
    noteTitle: "Comprehensive Data Structures & Algorithm Complexity Cheat Sheet",
    courseCode: "CS 301",
    savedDate: "Yesterday",
  },
];

export class CampusNoteService {
  private static notes: CourseNote[] = [...INITIAL_NOTES];
  private static bookmarks: NoteBookmark[] = [...INITIAL_BOOKMARKS];

  public static getNotes(options?: Partial<NoteFilterOptions>): CourseNote[] {
    let result = [...this.notes];
    if (!options) return result;

    if (options.department && options.department !== "All") {
      result = result.filter((n) => n.department === options.department);
    }

    if (options.fileFormat && options.fileFormat !== "All") {
      result = result.filter((n) => n.fileFormat === options.fileFormat);
    }

    if (options.verifiedOnly) {
      result = result.filter((n) => n.isVerified);
    }

    if (options.searchQuery && options.searchQuery.trim() !== "") {
      const q = options.searchQuery.toLowerCase().trim();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.courseCode.toLowerCase().includes(q) ||
          n.courseTitle.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }

  public static getNoteById(id: string): CourseNote | undefined {
    return this.notes.find((n) => n.id === id);
  }

  public static uploadNote(
    note: Omit<CourseNote, "id" | "upvotes" | "downloads" | "postedDate" | "isVerified">
  ): CourseNote {
    const newNote: CourseNote = {
      ...note,
      id: `note-${Date.now()}`,
      upvotes: 1,
      downloads: 0,
      postedDate: "Just now",
      isVerified: true,
    };
    this.notes.unshift(newNote);
    return newNote;
  }

  public static upvoteNote(id: string): number {
    const note = this.getNoteById(id);
    if (note) {
      note.upvotes += 1;
      return note.upvotes;
    }
    return 0;
  }

  public static getBookmarks(): NoteBookmark[] {
    return [...this.bookmarks];
  }

  public static toggleBookmark(noteId: string): boolean {
    const idx = this.bookmarks.findIndex((b) => b.noteId === noteId);
    if (idx !== -1) {
      this.bookmarks.splice(idx, 1);
      return false;
    } else {
      const note = this.getNoteById(noteId);
      if (note) {
        this.bookmarks.unshift({
          id: `bm-${Date.now()}`,
          noteId,
          noteTitle: note.title,
          courseCode: note.courseCode,
          savedDate: "Just now",
        });
        return true;
      }
    }
    return false;
  }
}
