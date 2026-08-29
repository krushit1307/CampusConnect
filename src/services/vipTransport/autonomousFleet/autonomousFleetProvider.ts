/**
 * Autonomous Vehicle Fleet Provider Abstraction (Issue #5138).
 *
 * Requests driverless autonomous vehicle dispatches (e.g. Waymo / Cruise)
 * to airport terminal pickup points with pre-programmed venue destinations.
 */

import { AutonomousVehicleDispatch } from "@/types/vipTransport";

export interface AutonomousFleetProvider {
  dispatchVehicle(
    airport: string,
    terminal: string,
    destinationVenueId: string,
    destinationVenueName: string,
  ): Promise<AutonomousVehicleDispatch>;
}

export class MockAutonomousFleetProvider implements AutonomousFleetProvider {
  /**
   * Dispatches a simulated driverless autonomous vehicle for VIP airport pickup.
   */
  public async dispatchVehicle(
    airport: string,
    terminal: string,
    destinationVenueId: string,
    destinationVenueName: string,
  ): Promise<AutonomousVehicleDispatch> {
    const dispatchId = `waymo_disp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    return {
      dispatchId,
      provider: "waymo_driverless",
      vehicleId: "WAYMO-JAGUAR-I-PACE-402",
      licensePlate: "8WYM771",
      vehicleModel: "Jaguar I-PACE Autonomous EV",
      isDriverless: true,
      pickupPoint: `${airport.toUpperCase()} ${terminal}, Passenger Pickup Door 4`,
      destinationVenueId,
      destinationVenueName,
      estimatedEtaMinutes: 4,
      status: "WAITING_AT_TERMINAL",
      dispatchedAtIso: new Date().toISOString(),
    };
  }
}

export const mockAutonomousFleetProvider = new MockAutonomousFleetProvider();
