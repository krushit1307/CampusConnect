import {
  CampusTutorService,
  TutorProfile,
  BookingSession,
  TutorFilterOptions,
} from "../models/CampusTutorModel";

export class CampusTutorServiceHandler {
  public static fetchTutorList(filters?: Partial<TutorFilterOptions>): TutorProfile[] {
    return CampusTutorService.getTutors(filters);
  }

  public static fetchTutorDetails(tutorId: string): TutorProfile | undefined {
    return CampusTutorService.getTutorById(tutorId);
  }

  public static registerAsTutor(
    payload: Omit<TutorProfile, "id" | "totalSessions" | "rating">
  ): TutorProfile {
    return CampusTutorService.createTutorProfile(payload);
  }

  public static fetchStudentBookings(): BookingSession[] {
    return CampusTutorService.getBookings();
  }

  public static scheduleTutorSession(
    tutorId: string,
    studentName: string,
    scheduledTime: string,
    durationMinutes: number,
    sessionType: 'one-on-one' | 'group' | 'exam-prep'
  ): BookingSession {
    return CampusTutorService.bookSession(
      tutorId,
      studentName,
      scheduledTime,
      durationMinutes,
      sessionType
    );
  }

  public static cancelScheduledSession(bookingId: string): boolean {
    return CampusTutorService.cancelBooking(bookingId);
  }
}
