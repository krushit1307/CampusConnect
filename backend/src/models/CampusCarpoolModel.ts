export interface DriverMetadataDTO {
  driverId: string;
  driverName: string;
  studentEmail: string;
  vehicleLicensePlate: string;
  isIdentityVerified: boolean;
}

export class CampusCarpoolModel {
  public id: string;
  public pickupAddress: string;
  public dropoffAddress: string;
  public scheduledDeparture: string;
  public driver: DriverMetadataDTO;
  public availableSeatCount: number;
  public totalCapacitySeats: number;
  public seatCostUSD: number;
  public vehicleDescription: string;
  public isCompleted: boolean;
  public createdAt: string;

  constructor(data: Partial<CampusCarpoolModel>) {
    this.id = data.id || `ride_${Math.random().toString(36).substr(2, 9)}`;
    this.pickupAddress = data.pickupAddress || 'Campus Center';
    this.dropoffAddress = data.dropoffAddress || 'Downtown Station';
    this.scheduledDeparture = data.scheduledDeparture || new Date().toISOString();
    this.driver = data.driver || {
      driverId: 'usr_drv_1',
      driverName: 'Student Driver',
      studentEmail: 'driver@campus.edu',
      vehicleLicensePlate: 'CP-9901',
      isIdentityVerified: true,
    };
    this.availableSeatCount = data.availableSeatCount || 3;
    this.totalCapacitySeats = data.totalCapacitySeats || 4;
    this.seatCostUSD = data.seatCostUSD || 5;
    this.vehicleDescription = data.vehicleDescription || 'Sedan';
    this.isCompleted = data.isCompleted ?? false;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      pickupAddress: this.pickupAddress,
      dropoffAddress: this.dropoffAddress,
      scheduledDeparture: this.scheduledDeparture,
      driver: this.driver,
      availableSeatCount: this.availableSeatCount,
      totalCapacitySeats: this.totalCapacitySeats,
      seatCostUSD: this.seatCostUSD,
      vehicleDescription: this.vehicleDescription,
      isCompleted: this.isCompleted,
      createdAt: this.createdAt,
    };
  }
}
