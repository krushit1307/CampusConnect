import { Router, Request, Response } from 'express';

export interface MentorDTO {
  id: string;
  name: string;
  title: string;
  department: string;
  expertise: string[];
  rating: number;
  sessionsCompleted: number;
  availabilityStatus: string;
}

export interface MentorshipSessionBookingDTO {
  sessionId: string;
  mentorId: string;
  studentId: string;
  sessionType: string;
  note: string;
  scheduledTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
}

export class PeerMentorshipService {
  private mentors: MentorDTO[] = [
    {
      id: 'mnt-201',
      name: 'Dr. Sophia Lin',
      title: 'Senior AI Research Scientist & Alumna',
      department: 'Computer Science',
      expertise: ['Machine Learning', 'PhD Applications', 'Natural Language Processing'],
      rating: 4.95,
      sessionsCompleted: 142,
      availabilityStatus: 'Available Today',
    },
    {
      id: 'mnt-202',
      name: 'Julian Thorne',
      title: 'Quant Systems Developer @ Citadel',
      department: 'Mathematics & CS',
      expertise: ['Quantitative Finance', 'Low-Latency C++', 'Technical Interviews'],
      rating: 4.88,
      sessionsCompleted: 89,
      availabilityStatus: 'Available This Weekend',
    },
  ];

  private bookings: MentorshipSessionBookingDTO[] = [];

  public getMentors(department?: string): MentorDTO[] {
    if (!department || department === 'All') return this.mentors;
    return this.mentors.filter(m => m.department === department);
  }

  public bookSession(payload: Omit<MentorshipSessionBookingDTO, 'sessionId' | 'status'>): MentorshipSessionBookingDTO {
    const booking: MentorshipSessionBookingDTO = {
      ...payload,
      sessionId: `ses_${Date.now()}`,
      status: 'PENDING',
    };
    this.bookings.push(booking);
    return booking;
  }
}

const mentorshipService = new PeerMentorshipService();
const mentorshipRouter = Router();

mentorshipRouter.get('/mentors', (req: Request, res: Response) => {
  const { department } = req.query;
  const items = mentorshipService.getMentors(department as string);
  res.json({ success: true, data: items });
});

mentorshipRouter.post('/mentors/book', (req: Request, res: Response) => {
  const booking = mentorshipService.bookSession(req.body);
  res.json({ success: true, data: booking });
});

export default mentorshipRouter;
