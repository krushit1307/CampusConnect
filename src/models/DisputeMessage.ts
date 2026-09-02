import { Schema, model, Document } from 'mongoose';

export interface IDisputeMessage extends Document {
  contractId: Schema.Types.ObjectId;
  senderId: Schema.Types.ObjectId;
  message: string;
  createdAt: Date;
}

const DisputeMessageSchema = new Schema<IDisputeMessage>(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

export const DisputeMessage = model<IDisputeMessage>('DisputeMessage', DisputeMessageSchema);
