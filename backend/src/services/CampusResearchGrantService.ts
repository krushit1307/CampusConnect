/**
 * Enterprise Campus Research Grant & Lab Equipment Sharing Engine
 * Manages research grant allocations, lab equipment booking schedules,
 * inter-departmental safety protocol certifications, and telemetry resource tracking.
 */

export interface ResearchGrantFund {
  grantId: string;
  projectTitle: string;
  principalInvestigator: string;
  department: string;
  sponsorOrganization: string;
  allocatedAmountUsd: number;
  remainingAmountUsd: number;
  grantStatus: 'ACTIVE' | 'PENDING_APPROVAL' | 'EXHAUSTED' | 'COMPLETED';
  startDate: string;
  endDate: string;
}

export interface SharedLabEquipment {
  equipmentId: string;
  name: string;
  category: 'ELECTRON_MICROSCOPE' | 'GENE_SEQUENCER' | 'HPLC_SPECTROMETER' | 'SUPERCOMPUTER_NODE';
  departmentLocation: string;
  hourlyBookingTokens: number;
  safetyLevelRequired: 'LEVEL_1_BASIC' | 'LEVEL_2_CERTIFIED' | 'LEVEL_3_HAZMAT';
  isAvailable: boolean;
  totalHoursUtilized: number;
  maintenanceSchedule: string;
}

export interface LabEquipmentReservation {
  reservationId: string;
  equipmentId: string;
  equipmentName: string;
  researcherId: string;
  researcherName: string;
  grantId: string;
  reservationDate: string;
  startTime: string;
  durationHours: number;
  status: 'CONFIRMED' | 'IN_USE' | 'COMPLETED' | 'CANCELLED';
  safetyCertificateVerified: boolean;
  createdAt: string;
}

export class CampusResearchGrantService {
  private static grants: ResearchGrantFund[] = [
    {
      grantId: 'GRANT-NSF-801',
      projectTitle: 'Sub-Nanometer Quantum Dot Photonics & Plasmonics',
      principalInvestigator: 'Dr. Evelyn Vance',
      department: 'Department of Electrical Engineering & Applied Physics',
      sponsorOrganization: 'National Science Foundation (NSF)',
      allocatedAmountUsd: 450000,
      remainingAmountUsd: 312000,
      grantStatus: 'ACTIVE',
      startDate: '2026-01-15',
      endDate: '2027-12-31',
    },
    {
      grantId: 'GRANT-NIH-904',
      projectTitle: 'CRISPR-Cas13 mRNA Targeted Viral Therapeutics',
      principalInvestigator: 'Dr. Aris Thorne',
      department: 'Department of Biomedical Engineering & BioHealth',
      sponsorOrganization: 'National Institutes of Health (NIH)',
      allocatedAmountUsd: 600000,
      remainingAmountUsd: 425000,
      grantStatus: 'ACTIVE',
      startDate: '2026-03-01',
      endDate: '2028-02-28',
    },
  ];

  private static equipment: SharedLabEquipment[] = [
    {
      equipmentId: 'EQ-SEM-101',
      name: 'FEI Titan Cryo-Transmission Electron Microscope (Titan Krios G4)',
      category: 'ELECTRON_MICROSCOPE',
      departmentLocation: 'Materials Research Institute - Cleanroom B2',
      hourlyBookingTokens: 50,
      safetyLevelRequired: 'LEVEL_2_CERTIFIED',
      isAvailable: true,
      totalHoursUtilized: 340,
      maintenanceSchedule: '2026-09-15',
    },
    {
      equipmentId: 'EQ-SEQ-202',
      name: 'Illumina NovaSeq X Plus High-Throughput Genomic Sequencer',
      category: 'GENE_SEQUENCER',
      departmentLocation: 'Genomics & Precision Medicine Center - Room 304',
      hourlyBookingTokens: 65,
      safetyLevelRequired: 'LEVEL_2_CERTIFIED',
      isAvailable: true,
      totalHoursUtilized: 512,
      maintenanceSchedule: '2026-10-01',
    },
  ];

  private static reservations: LabEquipmentReservation[] = [
    {
      reservationId: 'RES-LAB-501',
      equipmentId: 'EQ-SEM-101',
      equipmentName: 'FEI Titan Cryo-Transmission Electron Microscope',
      researcherId: 'STU-999',
      researcherName: 'Alex Rivera',
      grantId: 'GRANT-NSF-801',
      reservationDate: '2026-08-25',
      startTime: '10:00',
      durationHours: 3,
      status: 'CONFIRMED',
      safetyCertificateVerified: true,
      createdAt: '2026-08-21 14:00:00',
    },
  ];

  public static getGrants(): ResearchGrantFund[] {
    return this.grants;
  }

  public static getEquipment(): SharedLabEquipment[] {
    return this.equipment;
  }

  public static reserveEquipment(
    equipmentId: string,
    researcherId: string,
    researcherName: string,
    grantId: string,
    reservationDate: string,
    startTime: string,
    durationHours: number
  ): LabEquipmentReservation {
    const item = this.equipment.find((e) => e.equipmentId === equipmentId);
    if (!item) {
      throw new Error(`Equipment ${equipmentId} not found.`);
    }

    if (!item.isAvailable) {
      throw new Error(`Equipment ${item.name} is currently offline for maintenance.`);
    }

    item.totalHoursUtilized += durationHours;

    const reservation: LabEquipmentReservation = {
      reservationId: `RES-LAB-${Date.now()}`,
      equipmentId,
      equipmentName: item.name,
      researcherId,
      researcherName,
      grantId,
      reservationDate,
      startTime,
      durationHours,
      status: 'CONFIRMED',
      safetyCertificateVerified: true,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    this.reservations.unshift(reservation);
    return reservation;
  }

  public static getReservations(researcherId?: string): LabEquipmentReservation[] {
    if (researcherId) {
      return this.reservations.filter((r) => r.researcherId === researcherId);
    }
    return this.reservations;
  }

  public static getResearchMetrics() {
    const totalGrantsFundingUsd = this.grants.reduce((acc, g) => acc + g.allocatedAmountUsd, 0);
    const activeEquipmentCount = this.equipment.filter((e) => e.isAvailable).length;
    const totalHoursDelivered = this.equipment.reduce((acc, e) => acc + e.totalHoursUtilized, 0);
    const activeReservationsCount = this.reservations.length;

    return {
      totalGrantsFundingUsd,
      activeEquipmentCount,
      totalHoursDelivered,
      activeReservationsCount,
    };
  }
}
