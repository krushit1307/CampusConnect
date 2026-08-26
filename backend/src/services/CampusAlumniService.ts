import { Router, Request, Response } from 'express';

export interface AlumniMentorDTO {
  id: string;
  mentorName: string;
  jobTitle: string;
  companyName: string;
  alumniGradYear: string;
  expertiseDomain: string;
  availableSlotsPerWeek: number;
  isBooked: boolean;
}

export class CampusAlumniService {
  private mentors: AlumniMentorDTO[] = [
    {
      id: 'mntr-101',
      mentorName: 'Sophia Lin',
      jobTitle: 'Senior Staff Software Engineer',
      companyName: 'Google',
      alumniGradYear: 'Class of 2019',
      expertiseDomain: 'Software & AI Systems',
      availableSlotsPerWeek: 3,
      isBooked: false,
    },
    {
      id: 'mntr-102',
      mentorName: 'Marcus Vance',
      jobTitle: 'Investment Banking Associate',
      companyName: 'Goldman Sachs',
      alumniGradYear: 'Class of 2021',
      expertiseDomain: 'Finance & Consulting',
      availableSlotsPerWeek: 2,
      isBooked: false,
    },
  ];

  public getMentors(domain?: string): AlumniMentorDTO[] {
    if (!domain || domain === 'All') return this.mentors;
    return this.mentors.filter(m => m.expertiseDomain === domain);
  }

  public bookSession(id: string): AlumniMentorDTO | null {
    const mentor = this.mentors.find(m => m.id === id);
    if (!mentor || mentor.availableSlotsPerWeek <= 0) return null;
    mentor.availableSlotsPerWeek -= 1;
    mentor.isBooked = true;
    return mentor;
  }
}

const alumniService = new CampusAlumniService();
const alumniRouter = Router();

alumniRouter.get('/alumni/mentors', (req: Request, res: Response) => {
  const { domain } = req.query;
  const items = alumniService.getMentors(domain as string);
  res.json({ success: true, data: items });
});

alumniRouter.post('/alumni/mentors/:id/book', (req: Request, res: Response) => {
  const updated = alumniService.bookSession(req.params.id);
  if (!updated) return res.status(400).json({ success: false, error: 'No available slots' });
  res.json({ success: true, data: updated });
});

export default alumniRouter;
