import Stripe from 'stripe';
import { Contract } from '../models/Contract';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', { apiVersion: '2026-02-25.acacia' });

export class DisputeService {
  static async rejectDeliverable(contractId: string, organizerId: string) {
    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contract not found');

    contract.status = 'disputed';

    // Instantly freeze Stripe Escrow (e.g., placing a hold or updating metadata)
    await stripe.paymentIntents.update(contract.stripeEscrowId, {
      metadata: { status: 'frozen_dispute', organizerId },
    });

    await contract.save();
    return contract;
  }

  static async uploadEvidence(contractId: string, userId: string, fileUrl: string, description: string) {
    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contract not found');

    contract.evidence.push({
      uploadedBy: userId as any,
      fileUrl,
      description,
      createdAt: new Date(),
    });

    await contract.save();
    return contract;
  }

  static async resolveDispute(contractId: string, adminId: string, resolution: 'release' | 'refund') {
    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contract not found');

    if (resolution === 'release') {
      await stripe.paymentIntents.capture(contract.stripeEscrowId);
      contract.status = 'resolved_released';
    } else {
      await stripe.paymentIntents.cancel(contract.stripeEscrowId);
      contract.status = 'resolved_refunded';
    }

    contract.adminId = adminId as any;
    await contract.save();
    return contract;
  }
}
