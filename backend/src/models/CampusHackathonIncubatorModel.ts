import mongoose, { Schema, Document } from 'mongoose';

export interface ICampusHackathonIncubator extends Document {
  projectName: string;
  campusName: string;
  leadStudentName: string;
  teamSize: number;
  projectDomain: 'FINTECH' | 'HEALTH_TECH' | 'ED_TECH' | 'WEB3' | 'AI_ML';
  prizeFundingUsd: number;
  incubatorGrantUsd: number;
  prototypeStatus: 'PROTOTYPE' | 'MINIMUM_VIABLE_PRODUCT' | 'INCUBATED_STARTUP';
  createdAt: Date;
  updatedAt: Date;
}

const CampusHackathonIncubatorSchema: Schema = new Schema(
  {
    projectName: { type: String, required: true, trim: true },
    campusName: { type: String, required: true, trim: true },
    leadStudentName: { type: String, required: true, trim: true },
    teamSize: { type: Number, default: 1 },
    projectDomain: {
      type: String,
      enum: ['FINTECH', 'HEALTH_TECH', 'ED_TECH', 'WEB3', 'AI_ML'],
      default: 'AI_ML',
    },
    prizeFundingUsd: { type: Number, default: 0 },
    incubatorGrantUsd: { type: Number, default: 0 },
    prototypeStatus: {
      type: String,
      enum: ['PROTOTYPE', 'MINIMUM_VIABLE_PRODUCT', 'INCUBATED_STARTUP'],
      default: 'PROTOTYPE',
    },
  },
  { timestamps: true }
);

export default mongoose.models.CampusHackathonIncubator ||
  mongoose.model<ICampusHackathonIncubator>('CampusHackathonIncubator', CampusHackathonIncubatorSchema);
