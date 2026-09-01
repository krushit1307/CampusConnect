import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'campus_connect_secure_super_secret';

export const TicketController = {
  /**
   * Generates a unique JWT token for an event RSVP and saves it to the database.
   */
  async generateTicket(req: Request, res: Response) {
    try {
      const { eventId, userId } = req.body;

      if (!eventId || !userId) {
        return res.status(400).json({ success: false, message: 'Missing eventId or userId' });
      }

      // Check if RSVP already exists
      const existing = await prisma.rSVP.findUnique({
        where: { eventId_userId: { eventId, userId } }
      });

      if (existing) {
        return res.status(200).json({ success: true, token: existing.jwtToken });
      }

      // Generate Cryptographic JWT
      const token = jwt.sign({ eventId, userId }, JWT_SECRET, { expiresIn: '30d' });

      // Save to database
      await prisma.rSVP.create({
        data: {
          eventId,
          userId,
          jwtToken: token,
          status: 'VALID'
        }
      });

      return res.status(201).json({ success: true, token });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Scans a JWT token, verifies its signature, and burns the ticket for entry.
   */
  async scanTicket(req: Request, res: Response) {
    try {
      const { token, eventId } = req.body;

      if (!token || !eventId) {
        return res.status(400).json({ success: false, message: 'Missing token or eventId' });
      }

      // Verify JWT signature
      let payload;
      try {
        payload = jwt.verify(token, JWT_SECRET) as { eventId: string; userId: string };
      } catch (err) {
        return res.status(403).json({ success: false, message: 'Invalid or forged token signature' });
      }

      // Ensure the ticket is for the correct event
      if (payload.eventId !== eventId) {
        return res.status(403).json({ success: false, message: 'Ticket does not match the current event' });
      }

      // Check database status
      const rsvp = await prisma.rSVP.findFirst({
        where: { eventId: payload.eventId, userId: payload.userId, jwtToken: token }
      });

      if (!rsvp) {
        return res.status(404).json({ success: false, message: 'Ticket record not found' });
      }

      if (rsvp.status === 'USED') {
        return res.status(409).json({ success: false, message: 'Ticket has already been used!' });
      }

      if (rsvp.status === 'CANCELLED') {
        return res.status(409).json({ success: false, message: 'Ticket is cancelled' });
      }

      // Burn the ticket (Mark as USED)
      await prisma.rSVP.update({
        where: { id: rsvp.id },
        data: { status: 'USED', scannedAt: new Date() }
      });

      return res.status(200).json({ success: true, message: 'Ticket verified and checked in successfully!' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
};
