export interface AlumniProfileDTO {
  alumniId: string;
  mentorName: string;
  companyName: string;
  graduationYear: string;
  isVerifiedAlumni: boolean;
}

export class CampusAlumniModel {
  public id: string;
  public profile: AlumniProfileDTO;
  public currentJobTitle: string;
  public domainExpertise: string;
  public weeklySlotsAvailable: number;
  public isMentorshipFree: boolean;
  public bioSummary: string;
  public averageRating: number;
  public createdAt: string;

  constructor(data: Partial<CampusAlumniModel>) {
    this.id = data.id || `mntr_${Math.random().toString(36).substr(2, 9)}`;
    this.profile = data.profile || {
      alumniId: 'usr_alm_1',
      mentorName: 'Campus Graduate Mentor',
      companyName: 'Tech Innovators Inc.',
      graduationYear: 'Class of 2020',
      isVerifiedAlumni: true,
    };
    this.currentJobTitle = data.currentJobTitle || 'Software Engineer';
    this.domainExpertise = data.domainExpertise || 'Software & AI Systems';
    this.weeklySlotsAvailable = data.weeklySlotsAvailable || 3;
    this.isMentorshipFree = data.isMentorshipFree ?? true;
    this.bioSummary = data.bioSummary || 'Passionate about guiding students.';
    this.averageRating = data.averageRating || 4.95;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      profile: this.profile,
      currentJobTitle: this.currentJobTitle,
      domainExpertise: this.domainExpertise,
      weeklySlotsAvailable: this.weeklySlotsAvailable,
      isMentorshipFree: this.isMentorshipFree,
      bioSummary: this.bioSummary,
      averageRating: this.averageRating,
      createdAt: this.createdAt,
    };
  }
}
