export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface EulerOrientation {
  pitch: number;
  yaw: number;
  roll: number;
}

export interface VenueSpatialNode {
  id: string;
  name: string;
  position: Vector3D;
  isExit: boolean;
  exitCapacityRate: number; // people per minute
  currentSmokeDensityPpm: number;
  currentBottleneckScore: number; // 0 to 100
  connectedNodeIds: string[];
}

export interface EvacuationRouteStep {
  stepIndex: number;
  fromNodeId: string;
  toNodeId: string;
  fromPos: Vector3D;
  toPos: Vector3D;
  hologramArrowColor: string; // e.g. '#10b981', '#f59e0b', '#06b6d4'
  distanceMeters: number;
  hazardRiskMultiplier: number;
  instructionText: string;
}

export interface ArSpatialEvacuationPlan {
  eventId: string;
  emergencyType: 'fire' | 'crush_risk' | 'structural_collapse' | 'active_threat' | 'simulated_drill';
  userCurrentLocation: Vector3D;
  userOrientation: EulerOrientation;
  safestExitNodeId: string;
  safestExitName: string;
  totalDistanceMeters: number;
  estimatedEvacTimeSeconds: number;
  routeSteps: EvacuationRouteStep[];
  hologramProjectionConfig: {
    arrowScale: Vector3D;
    pulsingFrequencyHz: number;
    glowingIntensityLumens: number;
    floorAnchorTrackingMethod: 'ARCore_VPS' | 'ARKit_WorldTracking' | 'LiDAR_Mesh';
  };
  generatedAt: string;
}
