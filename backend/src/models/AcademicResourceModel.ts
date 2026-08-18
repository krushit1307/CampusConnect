export interface AuthorMetadata {
  userId: string;
  fullName: string;
  academicRole: 'Professor' | 'Associate Professor' | 'Graduate Student' | 'Undergraduate Student';
  department: string;
  verificationBadge: boolean;
}

export interface ResourceAnalyticsSummary {
  resourceId: string;
  totalViews: number;
  uniqueDownloads: number;
  averageRating: number;
  citationCount: number;
  lastDownloadedAt: string;
}

export class AcademicResourceDTO {
  public id: string;
  public title: string;
  public courseCode: string;
  public department: string;
  public semester: string;
  public resourceType: string;
  public fileFormat: string;
  public sizeBytes: number;
  public author: AuthorMetadata;
  public analytics: ResourceAnalyticsSummary;
  public createdAt: string;

  constructor(data: Partial<AcademicResourceDTO>) {
    this.id = data.id || `res_${Math.random().toString(36).substr(2, 9)}`;
    this.title = data.title || 'Untitled Resource';
    this.courseCode = data.courseCode || 'GEN100';
    this.department = data.department || 'General Education';
    this.semester = data.semester || 'Fall 2025';
    this.resourceType = data.resourceType || 'Lecture Notes';
    this.fileFormat = data.fileFormat || 'PDF';
    this.sizeBytes = data.sizeBytes || 0;
    this.author = data.author || {
      userId: 'usr_unknown',
      fullName: 'Anonymous Contributor',
      academicRole: 'Undergraduate Student',
      department: this.department,
      verificationBadge: false,
    };
    this.analytics = data.analytics || {
      resourceId: this.id,
      totalViews: 0,
      uniqueDownloads: 0,
      averageRating: 5.0,
      citationCount: 0,
      lastDownloadedAt: new Date().toISOString(),
    };
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      title: this.title,
      courseCode: this.courseCode,
      department: this.department,
      semester: this.semester,
      resourceType: this.resourceType,
      fileFormat: this.fileFormat,
      sizeBytes: this.sizeBytes,
      author: this.author,
      analytics: this.analytics,
      createdAt: this.createdAt,
    };
  }
}
