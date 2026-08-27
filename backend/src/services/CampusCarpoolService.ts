import { Router, Request, Response } from 'express';

export interface CarpoolRideDTO {
  id: string;
  originLocation: string;
  destinationLocation: string;
  departureTime: string;
  driverName: string;
  seatsAvailable: number;
  totalSeats: number;
  pricePerSeatUSD: number;
  carModel: string;
  isBooked: boolean;
}

export class CampusCarpoolService {
  private rides: CarpoolRideDTO[] = [
    {
      id: 'ride-701',
      originLocation: 'North Campus Student Housing',
      destinationLocation: 'Metropolitan International Airport (JFK/LGA)',
      departureTime: 'Friday, Oct 24 @ 3:30 PM',
      driverName: 'Marcus Vance',
      seatsAvailable: 3,
      totalSeats: 4,
      pricePerSeatUSD: 18,
      carModel: '2023 Tesla Model 3',
      isBooked: false,
    },
    {
      id: 'ride-702',
      originLocation: 'Downtown University Heights',
      destinationLocation: 'Engineering Quad / Science Library',
      departureTime: 'Mon - Thu @ 8:15 AM Daily',
      driverName: 'Elena Rostova',
      seatsAvailable: 2,
      totalSeats: 4,
      pricePerSeatUSD: 5,
      carModel: '2022 Honda Civic EX',
      isBooked: false,
    },
  ];

  public getRides(destination?: string): CarpoolRideDTO[] {
    if (!destination) return this.rides;
    return this.rides.filter(r => r.destinationLocation.toLowerCase().includes(destination.toLowerCase()));
  }

  public bookSeat(rideId: string): CarpoolRideDTO | null {
    const ride = this.rides.find(r => r.id === rideId);
    if (!ride || ride.seatsAvailable <= 0) return null;
    ride.seatsAvailable -= 1;
    ride.isBooked = true;
    return ride;
  }
}

const carpoolService = new CampusCarpoolService();
const carpoolRouter = Router();

carpoolRouter.get('/carpool/rides', (req: Request, res: Response) => {
  const { destination } = req.query;
  const items = carpoolService.getRides(destination as string);
  res.json({ success: true, data: items });
});

carpoolRouter.post('/carpool/rides/:id/book', (req: Request, res: Response) => {
  const updated = carpoolService.bookSeat(req.params.id);
  if (!updated) return res.status(400).json({ success: false, error: 'No available seats' });
  res.json({ success: true, data: updated });
});

export default carpoolRouter;
