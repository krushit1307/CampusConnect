import { Schema, model, Document } from 'mongoose';

export interface IDonation extends Document {
  userId: Schema.Types.ObjectId;
  clubId: Schema.Types.ObjectId;
  amount: number;
  employerName?: string;
  matchingEligible: boolean;
  matchingStatus: 'pending_filing' | 'filed' | 'not_eligible';
  createdAt: Date;
}

const DonationSchema = new Schema<IDonation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true },
    amount: { type: Number, required: true },
    employerName: { type: String },
    matchingEligible: { type: Boolean, default: false },
    matchingStatus: {
      type: String,
      enum: ['pending_filing', 'filed', 'not_eligible'],
      default: 'not_eligible',
    },
  },
  { timestamps: true }
);

export const Donation = model<IDonation>('Donation', DonationSchema);
