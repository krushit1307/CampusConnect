import {
  CampusNoteService,
  CourseNote,
  NoteBookmark,
  NoteFilterOptions,
} from "../models/CampusNoteModel";

export class CampusNoteServiceHandler {
  public static fetchNoteListings(filters?: Partial<NoteFilterOptions>): CourseNote[] {
    return CampusNoteService.getNotes(filters);
  }

  public static fetchNoteDetails(id: string): CourseNote | undefined {
    return CampusNoteService.getNoteById(id);
  }

  public static uploadNewCourseNote(
    payload: Omit<CourseNote, "id" | "upvotes" | "downloads" | "postedDate" | "isVerified">
  ): CourseNote {
    return CampusNoteService.uploadNote(payload);
  }

  public static upvoteCourseNote(id: string): number {
    return CampusNoteService.upvoteNote(id);
  }

  public static fetchUserBookmarks(): NoteBookmark[] {
    return CampusNoteService.getBookmarks();
  }

  public static toggleSavedNoteBookmark(noteId: string): boolean {
    return CampusNoteService.toggleBookmark(noteId);
  }
}
