import { Schema, model, Document } from 'mongoose';

export interface ITask extends Document {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'completed';
  assignedTo?: string;
  resourceId?: Schema.Types.ObjectId;
  createdAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'high' },
    status: { type: String, enum: ['open', 'in_progress', 'completed'], default: 'open' },
    resourceId: { type: Schema.Types.ObjectId, ref: 'Resource' },
  },
  { timestamps: true }
);

export const Task = model<ITask>('Task', TaskSchema);
