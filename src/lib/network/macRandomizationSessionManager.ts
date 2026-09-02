import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { generateWifiJwt, verifyWifiJwt } from './wifiJwtTokenManager';
import { authorizeDeviceMac, revokeDeviceMac } from './ciscoIseIntegration';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export interface MacSession {
  id: string;
  sessionId: string;
  userId: string;
  currentMacAddress: string;
  previousMacAddresses: string[];
  jwtToken: string;
  jwtExpiresAt: string;
  iseDeviceId: string | null;
  campusId: string;
  createdAt: string;
  lastRotationAt: string;
}

export interface MacSessionCreate {
  userId: string;
  rsvpId?: string;
  macAddress: string;
  campusId: string;
}

/**
 * Create a new MAC session with JWT token
 */
export async function createMacSession(
  data: MacSessionCreate
): Promise<{ session: MacSession; jwtToken: string }> {
  const sessionId = uuidv4();
  
  const { jwtToken, expiresAt } = await generateWifiJwt(
    data.userId,
    data.rsvpId,
    data.campusId
  );

  const { data: session, error } = await supabase
    .from('mac_session_mapping')
    .insert([
      {
        session_id: sessionId,
        user_id: data.userId,
        rsvp_id: data.rsvpId || null,
        current_mac_address: data.macAddress,
        jwt_token: jwtToken,
        jwt_expires_at: expiresAt,
        campus_id: data.campusId,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create MAC session: ${error.message}`);
  }

  // Authorize MAC with Cisco ISE
  try {
    const iseResult = await authorizeDeviceMac(
      data.macAddress,
      data.userId,
      sessionId
    );
    
    if (iseResult.deviceId) {
      await updateSessionIseDeviceId(sessionId, iseResult.deviceId);
    }
  } catch (err) {
    console.error('ISE authorization failed:', err);
    // Continue even if ISE fails - MAC is still cached locally
  }

  return {
    session: {
      id: session.id,
      sessionId: session.session_id,
      userId: session.user_id,
      currentMacAddress: session.current_mac_address,
      previousMacAddresses: session.previous_mac_addresses || [],
      jwtToken: session.jwt_token,
      jwtExpiresAt: session.jwt_expires_at,
      iseDeviceId: session.ise_device_id,
      campusId: session.campus_id,
      createdAt: session.created_at,
      lastRotationAt: session.last_rotation_at,
    },
    jwtToken,
  };
}

/**
 * Rotate MAC address for existing session
 */
export async function rotateMacAddress(
  sessionId: string,
  newMacAddress: string
): Promise<MacSession> {
  // Get current session
  const { data: currentSession, error: fetchError } = await supabase
    .from('mac_session_mapping')
    .select()
    .eq('session_id', sessionId)
    .single();

  if (fetchError) {
    throw new Error(`Session not found: ${fetchError.message}`);
  }

  const previousMacs = [
    ...(currentSession.previous_mac_addresses || []),
    currentSession.current_mac_address,
  ];

  // Update session with new MAC
  const { data: updatedSession, error: updateError } = await supabase
    .from('mac_session_mapping')
    .update({
      current_mac_address: newMacAddress,
      previous_mac_addresses: previousMacs,
      last_rotation_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to rotate MAC: ${updateError.message}`);
  }

  // Authorize new MAC with ISE
  try {
    const iseResult = await authorizeDeviceMac(
      newMacAddress,
      updatedSession.user_id,
      sessionId
    );

    if (iseResult.deviceId) {
      await updateSessionIseDeviceId(sessionId, iseResult.deviceId);
    }

    // Revoke old MAC
    if (updatedSession.ise_device_id) {
      await revokeDeviceMac(currentSession.current_mac_address, updatedSession.ise_device_id);
    }
  } catch (err) {
    console.error('ISE MAC rotation failed:', err);
  }

  return {
    id: updatedSession.id,
    sessionId: updatedSession.session_id,
    userId: updatedSession.user_id,
    currentMacAddress: updatedSession.current_mac_address,
    previousMacAddresses: updatedSession.previous_mac_addresses || [],
    jwtToken: updatedSession.jwt_token,
    jwtExpiresAt: updatedSession.jwt_expires_at,
    iseDeviceId: updatedSession.ise_device_id,
    campusId: updatedSession.campus_id,
    createdAt: updatedSession.created_at,
    lastRotationAt: updatedSession.last_rotation_at,
  };
}

/**
 * Validate MAC session with JWT token
 */
export async function validateMacSession(
  sessionId: string,
  macAddress: string,
  jwtToken: string
): Promise<{ isValid: boolean; userId?: string; reason?: string }> {
  try {
    // Verify JWT token
    const decoded = await verifyWifiJwt(jwtToken);
    if (!decoded.isValid) {
      return { isValid: false, reason: 'Invalid JWT token' };
    }

    // Get session from database
    const { data: session, error } = await supabase
      .from('mac_session_mapping')
      .select()
      .eq('session_id', sessionId)
      .single();

    if (error || !session) {
      return { isValid: false, reason: 'Session not found' };
    }

    // Check if JWT has expired
    if (new Date(session.jwt_expires_at) < new Date()) {
      return { isValid: false, reason: 'JWT token expired' };
    }

    // Check if MAC is in current or previous list
    const macValid =
      session.current_mac_address === macAddress ||
      session.previous_mac_addresses?.includes(macAddress);

    if (!macValid) {
      return { isValid: false, reason: 'MAC address not recognized' };
    }

    return { isValid: true, userId: session.user_id };
  } catch (err) {
    return { isValid: false, reason: `Validation error: ${err}` };
  }
}

/**
 * Extend session expiry time
 */
export async function extendSessionExpiry(
  sessionId: string,
  durationMinutes: number = 480
): Promise<MacSession> {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

  const { data: updatedSession, error } = await supabase
    .from('mac_session_mapping')
    .update({
      jwt_expires_at: expiresAt.toISOString(),
    })
    .eq('session_id', sessionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to extend session: ${error.message}`);
  }

  return {
    id: updatedSession.id,
    sessionId: updatedSession.session_id,
    userId: updatedSession.user_id,
    currentMacAddress: updatedSession.current_mac_address,
    previousMacAddresses: updatedSession.previous_mac_addresses || [],
    jwtToken: updatedSession.jwt_token,
    jwtExpiresAt: updatedSession.jwt_expires_at,
    iseDeviceId: updatedSession.ise_device_id,
    campusId: updatedSession.campus_id,
    createdAt: updatedSession.created_at,
    lastRotationAt: updatedSession.last_rotation_at,
  };
}

/**
 * Get all active sessions for a user
 */
export async function getActiveSessions(userId: string): Promise<MacSession[]> {
  const { data: sessions, error } = await supabase
    .from('mac_session_mapping')
    .select()
    .eq('user_id', userId)
    .gt('jwt_expires_at', new Date().toISOString());

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  return (sessions || []).map((s) => ({
    id: s.id,
    sessionId: s.session_id,
    userId: s.user_id,
    currentMacAddress: s.current_mac_address,
    previousMacAddresses: s.previous_mac_addresses || [],
    jwtToken: s.jwt_token,
    jwtExpiresAt: s.jwt_expires_at,
    iseDeviceId: s.ise_device_id,
    campusId: s.campus_id,
    createdAt: s.created_at,
    lastRotationAt: s.last_rotation_at,
  }));
}

/**
 * Dismiss captive portal for session
 */
export async function dismissCaptivePortal(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('mac_session_mapping')
    .update({
      captive_portal_dismissed_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId);

  if (error) {
    throw new Error(`Failed to dismiss captive portal: ${error.message}`);
  }
}

/**
 * Update ISE device ID for session
 */
async function updateSessionIseDeviceId(sessionId: string, iseDeviceId: string): Promise<void> {
  const { error } = await supabase
    .from('mac_session_mapping')
    .update({
      ise_device_id: iseDeviceId,
    })
    .eq('session_id', sessionId);

  if (error) {
    throw new Error(`Failed to update ISE device ID: ${error.message}`);
  }
}

/**
 * Revoke session and MAC
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const { data: session, error: fetchError } = await supabase
    .from('mac_session_mapping')
    .select()
    .eq('session_id', sessionId)
    .single();

  if (fetchError) {
    throw new Error(`Session not found: ${fetchError.message}`);
  }

  // Revoke from ISE if device ID exists
  if (session.ise_device_id) {
    try {
      await revokeDeviceMac(session.current_mac_address, session.ise_device_id);
    } catch (err) {
      console.error('Failed to revoke from ISE:', err);
    }
  }

  // Delete session from database
  const { error: deleteError } = await supabase
    .from('mac_session_mapping')
    .delete()
    .eq('session_id', sessionId);

  if (deleteError) {
    throw new Error(`Failed to revoke session: ${deleteError.message}`);
  }
}

export default {
  createMacSession,
  rotateMacAddress,
  validateMacSession,
  extendSessionExpiry,
  getActiveSessions,
  dismissCaptivePortal,
  revokeSession,
};