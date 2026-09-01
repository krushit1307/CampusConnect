/**
 * Dynamic Resource Constraint HVAC Pre-Cooling Model Service (#5355)
 * Predictive thermal-management model using RSVP count, venue dimensions,
 * event timing, and weather forecast data to estimate cooling demand and pre-cooling schedule.
 */

export const HUMAN_HEAT_OUTPUT_BTU_PER_HOUR = 400; // Sensible + latent heat per active person
export const LIGHTING_EQUIPMENT_BTU_PER_SQFT = 3.41; // Lighting & tech load per sq ft
export const COOLING_BTU_PER_DEGREE_PER_CUFT = 0.018; // Sensible cooling per °F per cu ft

export type ResourceConstraintLevel = "low" | "moderate" | "high" | "critical";

export type HvacState =
  "OFF" | "PRE_COOLING_RECOMMENDED" | "PRE_COOLING_ACTIVE_SIMULATED" | "RESOURCE_CONSTRAINED";

export interface HvacModelInput {
  attendeeCount: number;
  venueAreaSqFt?: number;
  venueHeightFt?: number;
  eventStartTime: Date | string;
  eventDurationHours?: number;
  outdoorTemperatureF?: number;
  outdoorHumidityPercent?: number;
  currentIndoorTemperatureF?: number;
  targetTemperatureF?: number;
  hvacCapacityBtuPerHour?: number;
}

export interface HvacPredictionResult {
  estimatedHeatLoadBtuPerHour: number;
  estimatedCoolingDemandBtuPerHour: number;
  predictedPeakTemperatureF: number;
  recommendedPreCoolingMinutes: number;
  recommendedPreCoolingDurationHours: number;
  recommendedStartTime: string;
  resourceConstraintLevel: ResourceConstraintLevel;
  confidence: number; // 0.0 - 1.0
  explanation: string;
  warningMessage?: string | null;
  breakdown: {
    humanHeatLoadBtu: number;
    equipmentHeatLoadBtu: number;
    outdoorGainBtu: number;
    pulldownDemandBtu: number;
  };
}

export interface BacnetCommandPayload {
  venueId: string;
  targetTemperatureF: number;
  recommendedPreCoolingMinutes: number;
  recommendedStartTime: string;
  resourceConstraintLevel: ResourceConstraintLevel;
  dispatchedAt: string;
}

export class HvacPreCoolingModelService {
  /**
   * Validates input fields to prevent invalid values, NaNs, or negative inputs.
   */
  public static validateInput(input: HvacModelInput): void {
    if (
      typeof input.attendeeCount !== "number" ||
      !Number.isFinite(input.attendeeCount) ||
      input.attendeeCount < 0
    ) {
      throw new Error("Invalid input: attendeeCount must be a non-negative finite number.");
    }

    if (
      input.venueAreaSqFt !== undefined &&
      (!Number.isFinite(input.venueAreaSqFt) || input.venueAreaSqFt <= 0)
    ) {
      throw new Error("Invalid input: venueAreaSqFt must be a positive finite number.");
    }

    if (
      input.venueHeightFt !== undefined &&
      (!Number.isFinite(input.venueHeightFt) || input.venueHeightFt <= 0)
    ) {
      throw new Error("Invalid input: venueHeightFt must be a positive finite number.");
    }

    if (
      input.outdoorTemperatureF !== undefined &&
      (!Number.isFinite(input.outdoorTemperatureF) ||
        input.outdoorTemperatureF < -50 ||
        input.outdoorTemperatureF > 150)
    ) {
      throw new Error("Invalid input: outdoorTemperatureF out of realistic range.");
    }

    if (
      input.currentIndoorTemperatureF !== undefined &&
      (!Number.isFinite(input.currentIndoorTemperatureF) ||
        input.currentIndoorTemperatureF < 30 ||
        input.currentIndoorTemperatureF > 120)
    ) {
      throw new Error("Invalid input: currentIndoorTemperatureF out of realistic range.");
    }

    if (
      input.targetTemperatureF !== undefined &&
      (!Number.isFinite(input.targetTemperatureF) ||
        input.targetTemperatureF < 50 ||
        input.targetTemperatureF > 90)
    ) {
      throw new Error("Invalid input: targetTemperatureF out of realistic range.");
    }
  }

  /**
   * Predicts thermal load, required cooling demand, pre-cooling timing (up to 6 hours),
   * and resource constraint levels.
   */
  public static predictPreCooling(input: HvacModelInput): HvacPredictionResult {
    this.validateInput(input);

    const attendeeCount = Math.max(0, input.attendeeCount);
    const venueAreaSqFt = input.venueAreaSqFt || 5000;
    const venueHeightFt = input.venueHeightFt || 12;
    const outdoorTemp = input.outdoorTemperatureF ?? 85;
    const outdoorHumidity = input.outdoorHumidityPercent ?? 55;
    const currentIndoorTemp = input.currentIndoorTemperatureF ?? 72;
    const targetTemp = input.targetTemperatureF ?? 68;
    const hvacCapacity = input.hvacCapacityBtuPerHour ?? 120000; // 10 Tons AC (120,000 BTU/hr)

    const startTimeDate =
      typeof input.eventStartTime === "string"
        ? new Date(input.eventStartTime)
        : input.eventStartTime;

    const eventStartIso = isNaN(startTimeDate.getTime())
      ? new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
      : startTimeDate.toISOString();

    // 1. Heat Load Components
    const humanHeatLoadBtu = Math.round(attendeeCount * HUMAN_HEAT_OUTPUT_BTU_PER_HOUR);
    const equipmentHeatLoadBtu = Math.round(venueAreaSqFt * LIGHTING_EQUIPMENT_BTU_PER_SQFT);

    // Outdoor heat gain per hour through building envelope
    const tempDiff = Math.max(0, outdoorTemp - currentIndoorTemp);
    const humidityMultiplier = 1.0 + Math.max(0, outdoorHumidity - 50) * 0.005;
    const outdoorGainBtu = Math.round(tempDiff * venueAreaSqFt * 1.5 * humidityMultiplier);

    const estimatedHeatLoadBtuPerHour = humanHeatLoadBtu + equipmentHeatLoadBtu + outdoorGainBtu;

    // 2. Air Volume Pulldown Cooling Requirement
    const venueVolumeCuFt = venueAreaSqFt * venueHeightFt;
    const pullDownDelta = Math.max(0, currentIndoorTemp - targetTemp);
    const pulldownDemandBtu = Math.round(
      venueVolumeCuFt * pullDownDelta * COOLING_BTU_PER_DEGREE_PER_CUFT,
    );

    // Total Cooling Demand per hour during event peak
    const estimatedCoolingDemandBtuPerHour =
      estimatedHeatLoadBtuPerHour + Math.round(pulldownDemandBtu / 2);

    // 3. Resource Constraint Level Assessment
    const capacityRatio = estimatedCoolingDemandBtuPerHour / Math.max(1, hvacCapacity);
    let resourceConstraintLevel: ResourceConstraintLevel = "low";
    let warningMessage: string | null = null;

    if (capacityRatio >= 1.3) {
      resourceConstraintLevel = "critical";
      warningMessage = `HIGH RESOURCE CONSTRAINT: Predicted cooling demand (${estimatedCoolingDemandBtuPerHour.toLocaleString()} BTU/hr) severely exceeds available HVAC capacity (${hvacCapacity.toLocaleString()} BTU/hr). Pre-cooling is strongly recommended to build thermal storage mass prior to attendee arrival.`;
    } else if (capacityRatio >= 1.0) {
      resourceConstraintLevel = "high";
      warningMessage = `HIGH RESOURCE CONSTRAINT: Predicted cooling demand (${estimatedCoolingDemandBtuPerHour.toLocaleString()} BTU/hr) exceeds available HVAC capacity (${hvacCapacity.toLocaleString()} BTU/hr). Consider pre-cooling or adjusting event conditions.`;
    } else if (capacityRatio >= 0.75) {
      resourceConstraintLevel = "moderate";
    }

    // 4. Six-Hour Pre-Cooling Model Duration & Start Time Calculation
    // Base pre-cooling duration (minutes) scales with capacity ratio and outdoor temp delta
    const loadMinutes = capacityRatio * 180;
    const tempDeltaMinutes = Math.max(0, outdoorTemp - targetTemp) * 10;
    const rawMinutes = Math.round(loadMinutes + tempDeltaMinutes);

    // Clamp pre-cooling recommendation to max 360 minutes (6 hours)
    const recommendedPreCoolingMinutes = Math.min(360, Math.max(30, rawMinutes));
    const recommendedPreCoolingDurationHours =
      Math.round((recommendedPreCoolingMinutes / 60) * 10) / 10;

    const eventMs = new Date(eventStartIso).getTime();
    const recommendedStartMs = eventMs - recommendedPreCoolingMinutes * 60 * 1000;
    const recommendedStartTime = new Date(recommendedStartMs).toISOString();

    // 5. Predicted Peak Temperature if no pre-cooling active
    const unmitigatedTempRise = Math.max(
      0,
      (estimatedCoolingDemandBtuPerHour - hvacCapacity) / (venueVolumeCuFt * 0.05),
    );
    const predictedPeakTemperatureF =
      Math.round((currentIndoorTemp + unmitigatedTempRise) * 10) / 10;

    // Confidence score based on input completeness
    const confidence =
      input.outdoorTemperatureF !== undefined && input.venueAreaSqFt !== undefined ? 0.92 : 0.85;

    const explanation = `Expected turnout of ${attendeeCount.toLocaleString()} attendees will generate ~${humanHeatLoadBtu.toLocaleString()} BTU/hr heat load. Recommended pre-cooling for ${recommendedPreCoolingDurationHours} hours starting at ${new Date(recommendedStartTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`;

    return {
      estimatedHeatLoadBtuPerHour,
      estimatedCoolingDemandBtuPerHour,
      predictedPeakTemperatureF,
      recommendedPreCoolingMinutes,
      recommendedPreCoolingDurationHours,
      recommendedStartTime,
      resourceConstraintLevel,
      confidence,
      explanation,
      warningMessage,
      breakdown: {
        humanHeatLoadBtu,
        equipmentHeatLoadBtu,
        outdoorGainBtu,
        pulldownDemandBtu,
      },
    };
  }

  /**
   * Software Control Adapter: Simulates sending BACnet pre-cooling override command.
   */
  public static simulateBacnetCommand(
    venueId: string,
    prediction: HvacPredictionResult,
  ): { success: boolean; payload: BacnetCommandPayload; message: string } {
    const payload: BacnetCommandPayload = {
      venueId,
      targetTemperatureF: 67.0,
      recommendedPreCoolingMinutes: prediction.recommendedPreCoolingMinutes,
      recommendedStartTime: prediction.recommendedStartTime,
      resourceConstraintLevel: prediction.resourceConstraintLevel,
      dispatchedAt: new Date().toISOString(),
    };

    return {
      success: true,
      payload,
      message: `SIMULATED BACnet Control Dispatch: Venue ${venueId} pre-cooling command scheduled for ${new Date(prediction.recommendedStartTime).toLocaleTimeString()}. Target set to 67.0°F.`,
    };
  }
}
