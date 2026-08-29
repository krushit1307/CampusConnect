import { Request, Response } from 'express';
import { DisputeService } from '../services/dispute.service';

export const handleRejectDeliverable = async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;
    const { organizerId } = req.body;

    const contract = await DisputeService.rejectDeliverable(contractId, organizerId);
    return res.status(200).json({ success: true, contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const submitEvidence = async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;
    const { userId, fileUrl, description } = req.body;

    const contract = await DisputeService.uploadEvidence(contractId, userId, fileUrl, description);
    return res.status(200).json({ success: true, contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const resolveDisputeArbitration = async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;
    const { adminId, resolution } = req.body; // 'release' or 'refund'

    const contract = await DisputeService.resolveDispute(contractId, adminId, resolution);
    return res.status(200).json({ success: true, contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
