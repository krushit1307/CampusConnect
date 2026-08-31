import { Schema, model, Document } from 'mongoose';

export interface IContract extends Document {
  vendorId: Schema.Types.ObjectId;
  organizerId: Schema.Types.ObjectId;
  adminId?: Schema.Types.ObjectId;
  amount: number;
  stripeEscrowId: string;
  status: 'active' | 'pending_review' | 'disputed' | 'resolved_released' | 'resolved_refunded';
  evidence: {
    uploadedBy: Schema.Types.ObjectId;
    fileUrl: string;
    description: string;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const ContractSchema = new Schema<IContract>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    adminId: { type: Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number, required: true },
    stripeEscrowId: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'pending_review', 'disputed', 'resolved_released', 'resolved_refunded'],
      default: 'active',
    },
    evidence: [
      {
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        fileUrl: { type: String, required: true },
        description: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const Contract = model<IContract>('Contract', ContractSchema);
