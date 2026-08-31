import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export interface WifiJwtPayload {
  sub: string; // user ID
  rsvp_id?: string;
  campus_id: string;
  iat: number;
  exp: number;
  type: 'wifi_session';
}

export interface JwtGenerateResult {
  jwtToken: string;
  expiresAt: string;
  expiresIn: number;
}

export interface JwtVerifyResult {
  isValid: boolean;
  decoded?: WifiJwtPayload;
  error?: string;
}

const JWT_EXPIRY_MINUTES = process.env.VITE_WIFI_JWT_EXPIRY_MINUTES
  ? parseInt(process.env.VITE_WIFI_JWT_EXPIRY_MINUTES)
  : 480; // 8 hours

/**
 * Generate a WiFi JWT token for session management
 */
export async function generateWifiJwt(
  userId: string,
  rsvpId: string | undefined,
  campusId: string
): Promise<JwtGenerateResult> {
  // Get signing key from network config
  const { data: config, error } = await supabase
    .from('ztna_network_config')
    .select('jwt_signing_key')
    .eq('campus_id', campusId)
    .single();

  if (error || !config) {
    throw new Error(`Network config not found for campus: ${campusId}`);
  }

  const signingKey = config.jwt_signing_key;
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = JWT_EXPIRY_MINUTES * 60;
  const expiresAt = now + expiresIn;

  const payload: WifiJwtPayload = {
    sub: userId,
    rsvp_id: rsvpId,
    campus_id: campusId,
    iat: now,
    exp: expiresAt,
    type: 'wifi_session',
  };

  try {
    const token = jwt.sign(payload, signingKey, {
      algorithm: 'HS256',
      issuer: 'campus-wifi',
      subject: userId,
    });

    const expiresAtDate = new Date(expiresAt * 1000);

    return {
      jwtToken: token,
      expiresAt: expiresAtDate.toISOString(),
      expiresIn,
    };
  } catch (err) {
    throw new Error(`Failed to generate JWT: ${err}`);
  }
}

/**
 * Verify a WiFi JWT token
 */
export async function verifyWifiJwt(token: string): Promise<JwtVerifyResult> {
  try {
    // Get all network configs to try verification
    const { data: configs, error } = await supabase
      .from('ztna_network_config')
      .select('jwt_signing_key, campus_id');

    if (error || !configs || configs.length === 0) {
      return { isValid: false, error: 'No network configs found' };
    }

    // Try to verify with each signing key
    for (const config of configs) {
      try {
        const decoded = jwt.verify(token, config.jwt_signing_key, {
          algorithms: ['HS256'],
          issuer: 'campus-wifi',
        }) as WifiJwtPayload;

        // Validate payload structure
        if (decoded.type !== 'wifi_session' || !decoded.sub || !decoded.campus_id) {
          continue;
        }

        return { isValid: true, decoded };
      } catch (err) {
        // Try next config
        continue;
      }
    }

    return { isValid: false, error: 'Token verification failed' };
  } catch (err) {
    return { isValid: false, error: `Verification error: ${err}` };
  }
}

/**
 * Refresh/extend a WiFi JWT token
 */
export async function refreshWifiJwt(token: string): Promise<JwtGenerateResult> {
  const verification = await verifyWifiJwt(token);

  if (!verification.isValid || !verification.decoded) {
    throw new Error('Invalid token - cannot refresh');
  }

  const { sub: userId, rsvp_id: rsvpId, campus_id: campusId } = verification.decoded;

  return generateWifiJwt(userId, rsvpId, campusId);
}

/**
 * Extract user ID from JWT without verification (for honeypot logging)
 */
export function extractUserIdFromJwt(token: string): string | null {
  try {
    const decoded = jwt.decode(token) as WifiJwtPayload | null;
    return decoded?.sub || null;
  } catch {
    return null;
  }
}

/**
 * Check if JWT token is about to expire (within 5 minutes)
 */
export function isTokenExpiringSoon(expiresAt: string, minutesBefore: number = 5): boolean {
  const expirationTime = new Date(expiresAt).getTime();
  const warningTime = new Date().getTime() + minutesBefore * 60 * 1000;

  return warningTime > expirationTime;
}

export default {
  generateWifiJwt,
  verifyWifiJwt,
  refreshWifiJwt,
  extractUserIdFromJwt,
  isTokenExpiringSoon,
};