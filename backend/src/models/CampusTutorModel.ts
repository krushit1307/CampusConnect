export interface TutorProfile {
  id: string;
  tutorName: string;
  avatarUrl: string;
  courseCode: string;
  courseTitle: string;
  department: string;
  gradeAchieved: string;
  hourlyRate: number;
  rating: number;
  totalSessions: number;
  verifiedStudent: boolean;
  bio: string;
  subjects: string[];
  availability: string[];
}

export interface BookingSession {
  id: string;
  tutorId: string;
  tutorName: string;
  courseCode: string;
  studentName: string;
  scheduledTime: string;
  durationMinutes: number;
  sessionType: 'one-on-one' | 'group' | 'exam-prep';
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
  totalPrice: number;
}

export interface TutorFilterOptions {
  department: string;
  maxHourlyRate: number;
  minRating: number;
  verifiedOnly: boolean;
  searchQuery: string;
}

const INITIAL_TUTORS: TutorProfile[] = [
  {
    id: "tut-101",
    tutorName: "Elena Rostova",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    courseCode: "CS 301",
    courseTitle: "Data Structures & Algorithms",
    department: "Computer Science",
    gradeAchieved: "A+",
    hourlyRate: 25,
    rating: 4.9,
    totalSessions: 84,
    verifiedStudent: true,
    bio: "Teaching Assistant with 2+ years of experience helping students master Trees, Graphs, and Dynamic Programming.",
    subjects: ["Python", "C++", "Algorithms", "Big-O Analysis"],
    availability: ["Mon 4-6 PM", "Wed 2-5 PM", "Sat 10-2 PM"],
  },
  {
    id: "tut-102",
    tutorName: "Marcus Vance",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    courseCode: "MATH 241",
    courseTitle: "Multivariable Calculus & Linear Algebra",
    department: "Mathematics",
    gradeAchieved: "A",
    hourlyRate: 30,
    rating: 4.8,
    totalSessions: 62,
    verifiedStudent: true,
    bio: "Math Honors senior specializing in visual intuition for vector fields, partial derivatives, and matrix decompositions.",
    subjects: ["Calculus III", "Linear Algebra", "Differential Equations"],
    availability: ["Tue 1-4 PM", "Thu 3-6 PM", "Sun 1-5 PM"],
  },
  {
    id: "tut-103",
    tutorName: "Sophia Chen",
    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    courseCode: "CHEM 210",
    courseTitle: "Organic Chemistry II",
    department: "Chemistry",
    gradeAchieved: "A+",
    hourlyRate: 28,
    rating: 5.0,
    totalSessions: 110,
    verifiedStudent: true,
    bio: "Pre-med Senior. Simplifies complex organic reaction mechanisms, synthesis pathways, and spectroscopy analysis.",
    subjects: ["Orgo I & II", "Reaction Mechanisms", "NMR Spectroscopy"],
    availability: ["Mon 6-9 PM", "Fri 2-5 PM"],
  },
  {
    id: "tut-104",
    tutorName: "David Miller",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    courseCode: "PHYS 180",
    courseTitle: "University Physics: Mechanics & Waves",
    department: "Physics",
    gradeAchieved: "A",
    hourlyRate: 22,
    rating: 4.7,
    totalSessions: 45,
    verifiedStudent: true,
    bio: "Physics Peer Mentor focused on step-by-step problem-solving frameworks for midterm and final exam prep.",
    subjects: ["Classical Mechanics", "Harmonic Motion", "Wave Physics"],
    availability: ["Wed 5-8 PM", "Thu 4-7 PM"],
  },
];

const INITIAL_BOOKINGS: BookingSession[] = [
  {
    id: "book-201",
    tutorId: "tut-101",
    tutorName: "Elena Rostova",
    courseCode: "CS 301",
    studentName: "Alex Mercer",
    scheduledTime: "Tomorrow, 4:00 PM - 5:00 PM",
    durationMinutes: 60,
    sessionType: "one-on-one",
    status: "confirmed",
    totalPrice: 25,
  },
  {
    id: "book-202",
    tutorId: "tut-103",
    tutorName: "Sophia Chen",
    courseCode: "CHEM 210",
    studentName: "Alex Mercer",
    scheduledTime: "Friday, 2:00 PM - 4:00 PM",
    durationMinutes: 120,
    sessionType: "exam-prep",
    status: "pending",
    totalPrice: 56,
  },
];

export class CampusTutorService {
  private static tutors: TutorProfile[] = [...INITIAL_TUTORS];
  private static bookings: BookingSession[] = [...INITIAL_BOOKINGS];

  public static getTutors(options?: Partial<TutorFilterOptions>): TutorProfile[] {
    let result = [...this.tutors];

    if (!options) return result;

    if (options.department && options.department !== "All") {
      result = result.filter((t) => t.department === options.department);
    }

    if (options.maxHourlyRate && options.maxHourlyRate > 0) {
      result = result.filter((t) => t.hourlyRate <= options.maxHourlyRate);
    }

    if (options.minRating && options.minRating > 0) {
      result = result.filter((t) => t.rating >= options.minRating);
    }

    if (options.verifiedOnly) {
      result = result.filter((t) => t.verifiedStudent);
    }

    if (options.searchQuery && options.searchQuery.trim() !== "") {
      const q = options.searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.tutorName.toLowerCase().includes(q) ||
          t.courseCode.toLowerCase().includes(q) ||
          t.courseTitle.toLowerCase().includes(q) ||
          t.bio.toLowerCase().includes(q) ||
          t.subjects.some((s) => s.toLowerCase().includes(q))
      );
    }

    return result;
  }

  public static getTutorById(id: string): TutorProfile | undefined {
    return this.tutors.find((t) => t.id === id);
  }

  public static createTutorProfile(profile: Omit<TutorProfile, "id" | "totalSessions" | "rating">): TutorProfile {
    const newProfile: TutorProfile = {
      ...profile,
      id: `tut-${Date.now()}`,
      totalSessions: 0,
      rating: 5.0,
    };
    this.tutors.unshift(newProfile);
    return newProfile;
  }

  public static getBookings(): BookingSession[] {
    return [...this.bookings];
  }

  public static bookSession(
    tutorId: string,
    studentName: string,
    scheduledTime: string,
    durationMinutes: number,
    sessionType: 'one-on-one' | 'group' | 'exam-prep'
  ): BookingSession {
    const tutor = this.getTutorById(tutorId);
    if (!tutor) throw new Error("Tutor profile not found.");

    const priceMultiplier = sessionType === 'exam-prep' ? 1.25 : sessionType === 'group' ? 0.8 : 1.0;
    const totalPrice = Math.round((tutor.hourlyRate * (durationMinutes / 60)) * priceMultiplier);

    const newBooking: BookingSession = {
      id: `book-${Date.now()}`,
      tutorId,
      tutorName: tutor.tutorName,
      courseCode: tutor.courseCode,
      studentName,
      scheduledTime,
      durationMinutes,
      sessionType,
      status: "confirmed",
      totalPrice,
    };

    tutor.totalSessions += 1;
    this.bookings.unshift(newBooking);
    return newBooking;
  }

  public static cancelBooking(bookingId: string): boolean {
    const idx = this.bookings.findIndex((b) => b.id === bookingId);
    if (idx !== -1) {
      this.bookings[idx].status = "cancelled";
      return true;
    }
    return false;
  }
}
