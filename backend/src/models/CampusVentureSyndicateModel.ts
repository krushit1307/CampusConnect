import mongoose, { Schema, Document } from 'mongoose';

export interface ICampusVentureSyndicate extends Document {
  syndicateName: string;
  leadAngelName: string;
  leadAngelAlumniClass: number;
  campusAffiliation: string;
  investmentFocus: 'PRE_SEED_DEEPTECH' | 'SEED_SAAS' | 'SERIES_A_BIOTECH' | 'WEB3_INFRASTRUCTURE' | 'CLIMATE_TECH';
  targetFundSizeUsd: number;
  capitalCommittedUsd: number;
  capitalDeployedUsd: number;
  portfolioStartupsCount: number;
  syndicateStatus: 'RAISING_CAPITAL' | 'ACTIVE_INVESTING' | 'FULLY_DEPLOYED' | 'PAUSED';
  minimumCheckSizeUsd: number;
  carryingFeePercentage: number;
  syndicateMembersCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CampusVentureSyndicateSchema: Schema = new Schema(
  {
    syndicateName: { type: String, required: true, trim: true },
    leadAngelName: { type: String, required: true, trim: true },
    leadAngelAlumniClass: { type: Number, required: true },
    campusAffiliation: { type: String, required: true, trim: true },
    investmentFocus: {
      type: String,
      enum: ['PRE_SEED_DEEPTECH', 'SEED_SAAS', 'SERIES_A_BIOTECH', 'WEB3_INFRASTRUCTURE', 'CLIMATE_TECH'],
      default: 'PRE_SEED_DEEPTECH',
    },
    targetFundSizeUsd: { type: Number, required: true },
    capitalCommittedUsd: { type: Number, default: 0 },
    capitalDeployedUsd: { type: Number, default: 0 },
    portfolioStartupsCount: { type: Number, default: 0 },
    syndicateStatus: {
      type: String,
      enum: ['RAISING_CAPITAL', 'ACTIVE_INVESTING', 'FULLY_DEPLOYED', 'PAUSED'],
      default: 'RAISING_CAPITAL',
    },
    minimumCheckSizeUsd: { type: Number, default: 5000 },
    carryingFeePercentage: { type: Number, default: 15.0 },
    syndicateMembersCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export default mongoose.models.CampusVentureSyndicate ||
  mongoose.model<ICampusVentureSyndicate>('CampusVentureSyndicate', CampusVentureSyndicateSchema);
