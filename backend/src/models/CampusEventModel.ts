export interface TicketPassDTO {
  passId: string;
  qrHash: string;
  attendeeEmail: string;
  issuedAt: string;
}

export class CampusEventModel {
  public id: string;
  public eventTitle: string;
  public hostOrganization: string;
  public category: string;
  public eventScheduleISO: string;
  public venueName: string;
  public priceUSD: number;
  public remainingTickets: number;
  public totalCapacity: number;
  public issuedPasses: TicketPassDTO[];
  public isCancelled: boolean;
  public createdAt: string;

  constructor(data: Partial<CampusEventModel>) {
    this.id = data.id || `evt_${Math.random().toString(36).substr(2, 9)}`;
    this.eventTitle = data.eventTitle || 'Campus Student Gathering';
    this.hostOrganization = data.hostOrganization || 'Student Council';
    this.category = data.category || 'Social & Greek Life';
    this.eventScheduleISO = data.eventScheduleISO || new Date().toISOString();
    this.venueName = data.venueName || 'Campus Amphitheater';
    this.priceUSD = data.priceUSD || 0;
    this.remainingTickets = data.remainingTickets || 100;
    this.totalCapacity = data.totalCapacity || 100;
    this.issuedPasses = data.issuedPasses || [];
    this.isCancelled = data.isCancelled ?? false;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      eventTitle: this.eventTitle,
      hostOrganization: this.hostOrganization,
      category: this.category,
      eventScheduleISO: this.eventScheduleISO,
      venueName: this.venueName,
      priceUSD: this.priceUSD,
      remainingTickets: this.remainingTickets,
      totalCapacity: this.totalCapacity,
      issuedPasses: this.issuedPasses,
      isCancelled: this.isCancelled,
      createdAt: this.createdAt,
    };
  }
}
