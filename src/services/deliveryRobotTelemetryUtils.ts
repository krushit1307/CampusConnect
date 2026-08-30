/**
 * Campus Autonomous Delivery Robot Fleet Telemetry Utilities
 */

export interface DeliveryRobotTelemetry {
  robotId: string;
  assignedOrderNumber: string;
  batteryPercent: number;
  deliveryStatus: 'IDLE_CHARGING' | 'TRANSIT_TO_DESTINATION' | 'ARRIVED_AWAITING_PIN';
}

/**
 * Calculates delivery robot transit telemetry.
 */
export function calculateDeliveryRobotStatus(
  robotId: string,
  batteryPercent: number,
  isArrived: boolean
): DeliveryRobotTelemetry {
  let status: DeliveryRobotTelemetry['deliveryStatus'] = 'TRANSIT_TO_DESTINATION';
  if (isArrived) status = 'ARRIVED_AWAITING_PIN';
  else if (batteryPercent < 20) status = 'IDLE_CHARGING';

  return {
    robotId,
    assignedOrderNumber: `ORD-${Date.now().toString().slice(-6)}`,
    batteryPercent,
    deliveryStatus: status,
  };
}
