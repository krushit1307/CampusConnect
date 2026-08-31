import { Schema, model, Document } from 'mongoose';

export interface IResource extends Document {
  name: string;
  category: string;
  status: 'available' | 'booked' | 'needs_maintenance' | 'offline';
  maintenanceInterval: number; // e.g., 50 bookings
  usageCount: number;
  usageDurationHours: number;
  createdAt: Date;
  updatedAt: Date;
}

const ResourceSchema = new Schema<IResource>(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    status: {
      type: String,
      enum: ['available', 'booked', 'needs_maintenance', 'offline'],
      default: 'available',
    },
    maintenanceInterval: { type: Number, required: true, default: 50 },
    usageCount: { type: Number, default: 0 },
    usageDurationHours: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Resource = model<IResource>('Resource', ResourceSchema);
