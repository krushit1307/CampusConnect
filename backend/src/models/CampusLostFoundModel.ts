export interface ReporterStudentDTO {
  reporterId: string;
  fullName: string;
  campusEmail: string;
  isStudentVerified: boolean;
}

export class CampusLostFoundModel {
  public id: string;
  public itemTitle: string;
  public category: 'Electronics' | 'Personal Belongings' | 'Academic Supplies' | 'Keys & IDs';
  public reportType: 'LOST' | 'FOUND';
  public locationDescription: string;
  public rewardUSD: number;
  public reporter: ReporterStudentDTO;
  public isReunited: boolean;
  public createdAt: string;

  constructor(data: Partial<CampusLostFoundModel>) {
    this.id = data.id || `item_${Math.random().toString(36).substr(2, 9)}`;
    this.itemTitle = data.itemTitle || 'Lost Item';
    this.category = data.category || 'Personal Belongings';
    this.reportType = data.reportType || 'LOST';
    this.locationDescription = data.locationDescription || 'Main Quad Plaza';
    this.rewardUSD = data.rewardUSD || 0;
    this.reporter = data.reporter || {
      reporterId: 'usr_rep_1',
      fullName: 'Student Reporter',
      campusEmail: 'student@campus.edu',
      isStudentVerified: true,
    };
    this.isReunited = data.isReunited ?? false;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      itemTitle: this.itemTitle,
      category: this.category,
      reportType: this.reportType,
      locationDescription: this.locationDescription,
      rewardUSD: this.rewardUSD,
      reporter: this.reporter,
      isReunited: this.isReunited,
      createdAt: this.createdAt,
    };
  }
}
