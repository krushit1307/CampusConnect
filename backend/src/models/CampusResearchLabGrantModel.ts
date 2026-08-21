import mongoose, { Schema, Document } from 'mongoose';

export interface ICampusResearchLabGrant extends Document {
  labTitle: string;
  department: string;
  principalInvestigator: string;
  campusName: string;
  grantCategory: 'ARTIFICIAL_INTELLIGENCE' | 'QUANTUM_COMPUTING' | 'BIOMEDICAL' | 'RENEWABLE_ENERGY';
  fundingTargetUsd: number;
  fundingSecuredUsd: number;
  openRAPositionsCount: number;
  grantStatus: 'PROPOSAL_OPEN' | 'GRANT_AWARDED' | 'LAB_ACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const CampusResearchLabGrantSchema: Schema = new Schema(
  {
    labTitle: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    principalInvestigator: { type: String, required: true, trim: true },
    campusName: { type: String, required: true, trim: true },
    grantCategory: {
      type: String,
      enum: ['ARTIFICIAL_INTELLIGENCE', 'QUANTUM_COMPUTING', 'BIOMEDICAL', 'RENEWABLE_ENERGY'],
      default: 'ARTIFICIAL_INTELLIGENCE',
    },
    fundingTargetUsd: { type: Number, required: true },
    fundingSecuredUsd: { type: Number, default: 0 },
    openRAPositionsCount: { type: Number, default: 1 },
    grantStatus: {
      type: String,
      enum: ['PROPOSAL_OPEN', 'GRANT_AWARDED', 'LAB_ACTIVE'],
      default: 'PROPOSAL_OPEN',
    },
  },
  { timestamps: true }
);

export default mongoose.models.CampusResearchLabGrant ||
  mongoose.model<ICampusResearchLabGrant>('CampusResearchLabGrant', CampusResearchLabGrantSchema);
