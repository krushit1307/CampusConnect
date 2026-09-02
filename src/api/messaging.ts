import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

export const ClubMessagingController = {
  /**
   * Receives an encrypted payload from the frontend and blindly stores it.
   * The backend does NOT possess the keys to decrypt `ciphertext`.
   */
  async sendMessage(req: Request, res: Response) {
    try {
      const { clubId, senderId, ciphertext, iv } = req.body;

      if (!clubId || !senderId || !ciphertext || !iv) {
        return res.status(400).json({ success: false, message: 'Missing E2EE payload fields' });
      }

      const message = await prisma.clubMessage.create({
        data: {
          clubId,
          senderId,
          ciphertext,
          iv
        }
      });

      return res.status(201).json({ success: true, message });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Retrieves the raw E2EE ciphertexts for a specific club.
   * The frontend is responsible for decrypting these upon receipt.
   */
  async getHistory(req: Request, res: Response) {
    try {
      const { clubId } = req.params;

      if (!clubId) {
        return res.status(400).json({ success: false, message: 'Missing clubId' });
      }

      const messages = await prisma.clubMessage.findMany({
        where: { clubId },
        orderBy: { createdAt: 'asc' },
        take: 100 // Fetch last 100 messages
      });

      return res.status(200).json({ success: true, messages });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
};
