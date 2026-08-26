export interface MentorFeedbackReview {
  reviewId: string;
  studentId: string;
  ratingScore: number;
  comments: string;
  submittedAt: string;
}

export class MentorProfileModel {
  public id: string;
  public fullName: string;
  public professionalTitle: string;
  public department: string;
  public bioSummary: string;
  public expertiseTags: string[];
  public overallRating: number;
  public reviews: MentorFeedbackReview[];
  public isVerified: boolean;
  public createdAt: string;

  constructor(data: Partial<MentorProfileModel>) {
    this.id = data.id || `mnt_${Math.random().toString(36).substr(2, 9)}`;
    this.fullName = data.fullName || 'Anonymous Mentor';
    this.professionalTitle = data.professionalTitle || 'Academic Advisor';
    this.department = data.department || 'General Studies';
    this.bioSummary = data.bioSummary || '';
    this.expertiseTags = data.expertiseTags || [];
    this.overallRating = data.overallRating || 5.0;
    this.reviews = data.reviews || [];
    this.isVerified = data.isVerified ?? true;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      fullName: this.fullName,
      professionalTitle: this.professionalTitle,
      department: this.department,
      bioSummary: this.bioSummary,
      expertiseTags: this.expertiseTags,
      overallRating: this.overallRating,
      reviews: this.reviews,
      isVerified: this.isVerified,
      createdAt: this.createdAt,
    };
  }
}
