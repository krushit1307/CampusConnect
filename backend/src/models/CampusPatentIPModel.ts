import mongoose, { Schema, Document } from 'mongoose';

export interface ICampusPatentIP extends Document {
  inventionTitle: string;
  inventorNames: string[];
  department: string;
  campusName: string;
  patentType: 'UTILITY_PATENT' | 'DESIGN_PATENT' | 'SOFTWARE_COPYRIGHT' | 'BIOTECH_GENOME' | 'HARDWARE_CIRCUIT';
  filingNumber: string;
  jurisdiction: string;
  commercialLicensingFeeUsd: number;
  royaltySharePercentage: number;
  patentStatus: 'DISCLOSURE_REVIEW' | 'PROVISIONAL_FILED' | 'PATENT_GRANTED' | 'LICENSED_ENTERPRISE';
  commercialEntityLicensee?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CampusPatentIPSchema: Schema = new Schema(
  {
    inventionTitle: { type: String, required: true, trim: true },
    inventorNames: [{ type: String, required: true }],
    department: { type: String, required: true, trim: true },
    campusName: { type: String, required: true, trim: true },
    patentType: {
      type: String,
      enum: ['UTILITY_PATENT', 'DESIGN_PATENT', 'SOFTWARE_COPYRIGHT', 'BIOTECH_GENOME', 'HARDWARE_CIRCUIT'],
      default: 'UTILITY_PATENT',
    },
    filingNumber: { type: String, required: true, unique: true },
    jurisdiction: { type: String, default: 'USPTO' },
    commercialLicensingFeeUsd: { type: Number, default: 0 },
    royaltySharePercentage: { type: Number, default: 50.0 },
    patentStatus: {
      type: String,
      enum: ['DISCLOSURE_REVIEW', 'PROVISIONAL_FILED', 'PATENT_GRANTED', 'LICENSED_ENTERPRISE'],
      default: 'DISCLOSURE_REVIEW',
    },
    commercialEntityLicensee: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.models.CampusPatentIP ||
  mongoose.model<ICampusPatentIP>('CampusPatentIP', CampusPatentIPSchema);
