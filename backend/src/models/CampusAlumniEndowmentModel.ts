import mongoose, { Schema, Document } from 'mongoose';

export interface ICampusAlumniEndowment extends Document {
  fundName: string;
  campusName: string;
  donorAlumniName: string;
  donorGraduationYear: number;
  fundCategory: 'RESEARCH_GRANT' | 'STUDENT_EMERGENCY' | 'SCHOLARSHIP' | 'STARTUP_SEED';
  targetAmountUsd: number;
  raisedAmountUsd: number;
  disbursedAmountUsd: number;
  donorMatchingRatio: number;
  disbursalStatus: 'ACTIVE' | 'FULLY_FUNDED' | 'PAUSED';
  createdAt: Date;
  updatedAt: Date;
}

const CampusAlumniEndowmentSchema: Schema = new Schema(
  {
    fundName: { type: String, required: true, trim: true },
    campusName: { type: String, required: true, trim: true },
    donorAlumniName: { type: String, required: true, trim: true },
    donorGraduationYear: { type: Number, required: true },
    fundCategory: {
      type: String,
      enum: ['RESEARCH_GRANT', 'STUDENT_EMERGENCY', 'SCHOLARSHIP', 'STARTUP_SEED'],
      default: 'SCHOLARSHIP',
    },
    targetAmountUsd: { type: Number, required: true },
    raisedAmountUsd: { type: Number, default: 0 },
    disbursedAmountUsd: { type: Number, default: 0 },
    donorMatchingRatio: { type: Number, default: 1.0 },
    disbursalStatus: {
      type: String,
      enum: ['ACTIVE', 'FULLY_FUNDED', 'PAUSED'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

export default mongoose.models.CampusAlumniEndowment ||
  mongoose.model<ICampusAlumniEndowment>('CampusAlumniEndowment', CampusAlumniEndowmentSchema);
