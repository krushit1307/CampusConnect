import { Router, Request, Response } from 'express';

export interface CampusEventDTO {
  id: string;
  eventTitle: string;
  organizerClub: string;
  eventCategory: string;
  ticketPriceUSD: number;
  availableTickets: number;
  totalCapacity: number;
  isRSVPed: boolean;
}

export class CampusEventService {
  private events: CampusEventDTO[] = [
    {
      id: 'evt-901',
      eventTitle: 'Annual Campus Hackathon & AI Showcase 2026',
      organizerClub: 'ACM Student Chapter',
      eventCategory: 'Tech & Hackathons',
      ticketPriceUSD: 0,
      availableTickets: 85,
      totalCapacity: 300,
      isRSVPed: false,
    },
    {
      id: 'evt-902',
      eventTitle: 'Fall Music Fest & Indie Band Concert',
      organizerClub: 'Performing Arts Guild',
      eventCategory: 'Concerts & Music',
      ticketPriceUSD: 12,
      availableTickets: 42,
      totalCapacity: 500,
      isRSVPed: false,
    },
  ];

  public getEvents(category?: string): CampusEventDTO[] {
    if (!category || category === 'All') return this.events;
    return this.events.filter(e => e.eventCategory === category);
  }

  public rsvpEvent(id: string): { success: boolean; qrCode: string; event: CampusEventDTO } | null {
    const event = this.events.find(e => e.id === id);
    if (!event || event.availableTickets <= 0) return null;
    event.availableTickets -= 1;
    event.isRSVPed = true;
    const qrCode = `QR-PASS-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    return { success: true, qrCode, event };
  }
}

const eventService = new CampusEventService();
const eventRouter = Router();

eventRouter.get('/events/list', (req: Request, res: Response) => {
  const { category } = req.query;
  const items = eventService.getEvents(category as string);
  res.json({ success: true, data: items });
});

eventRouter.post('/events/:id/rsvp', (req: Request, res: Response) => {
  const result = eventService.rsvpEvent(req.params.id);
  if (!result) return res.status(400).json({ success: false, error: 'Event full or invalid' });
  res.json({ success: true, data: result });
});

export default eventRouter;
