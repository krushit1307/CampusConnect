/**
 * WiFi MAC Randomization Types
 */

export interface MacSession {
  id: string;
  sessionId: string;
  userId: string;
  rsvpId?: string;
  currentMacAddress: string;
  previousMacAddresses: string[];
  jwtToken: string;
  jwtExpiresAt: string;
  captivePortalDismissedAt?: string;
  iseDeviceId?: string;
  campusId: string;
  createdAt: string;
  lastRotationAt: string;
  updatedAt: string;
}

export interface ZtnaNetworkConfig {
  id: string;
  campusId: string;
  iseServerUrl: string;
  captivePortalUrl: string;
  oauthRedirectUri: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WifiJwtPayload {
  sub: string; // user ID
  rsvp_id?: string;
  campus_id: string;
  iat: number;
  exp: number;
  type: 'wifi_session';
}

export interface CaptivePortalSession {
  sessionId: string;
  macAddress: string;
  campusId: string;
  isAuthenticated: boolean;
  jwtToken?: string;
  expiresAt?: string;
}

export interface IseAuthorizationRequest {
  mac: string;
  userId: string;
  sessionId: string;
  groupTag: string;
  description?: string;
  deviceType?: string;
}

export interface IseAuthorizationResponse {
  id: string;
  status: 'authorized' | 'pending' | 'denied';
  message?: string;
}

export interface IseDeviceStatus {
  id: string;
  mac: string;
  status: string;
  groupTag: string;
  createdAt: string;
  updatedAt: string;
}

export interface MacRotationEvent {
  timestamp: string;
  sessionId: string;
  previousMac: string;
  newMac: string;
  userId: string;
  campusId: string;
}

export interface WifiConnectionStatus {
  isConnected: boolean;
  macAddress: string | null;
  sessionActive: boolean;
  sessionExpiry: string | null;
  remainingTime: number;
  authorizationStatus: 'valid' | 'expired' | 'invalid';
}