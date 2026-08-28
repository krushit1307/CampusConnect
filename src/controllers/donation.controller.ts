import { Request, Response } from 'express';
import { Donation } from '../models/Donation';
import { CorporateMatchingService } from '../services/corporateMatching.service';

export const createDonation = async (req: Request, res: Response) => {
  try {
    const { userId, clubId, amount, employerName } = req.body;

    let matchingEligible = false;
    let matchingStatus: 'pending_filing' | 'not_eligible' = 'not_eligible';

    if (employerName) {
      const verification = await CorporateMatchingService.verifyEmployer(employerName);
      if (verification.eligible) {
        matchingEligible = true;
        matchingStatus = 'pending_filing';
      }
    }

    const donation = new Donation({
      userId,
      clubId,
      amount,
      employerName,
      matchingEligible,
      matchingStatus,
    });

    await donation.save();

    return res.status(201).json({
      success: true,
      donation,
      matchingPrompt: matchingEligible
        ? `Great news! ${employerName} offers corporate matching. You can auto-file your matching request.`
        : null,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const fileMatchingRequest = async (req: Request, res: Response) => {
  try {
    const { donationId } = req.params;
    const donation = await Donation.findById(donationId);
    if (!donation || !donation.employerName) {
      return res.status(404).json({ success: false, error: 'Donation or employer info not found' });
    }

    const result = await CorporateMatchingService.autoFileMatchingRequest(
      donation._id.toString(),
      donation.employerName,
      '12-3456789', // Club Tax EIN reference from #4667
      donation.amount
    );

    donation.matchingStatus = 'filed';
    await donation.save();

    return res.status(200).json({ success: true, result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
