import { Request, Response } from 'express';

/**
 * Detect device MAC address from request
 * GET /api/network/detect-mac
 */
export async function detectMacAddress(req: Request, res: Response) {
  try {
    // Extract MAC from various headers set by captive portal
    let mac = req.get('X-Device-MAC');

    if (!mac) {
      mac = req.get('X-Client-MAC');
    }

    if (!mac) {
      mac = req.get('X-Forwarded-For')?.split(',')[0];
    }

    // Also try to get from custom header set by device
    if (!mac) {
      mac = req.get('Authorization-MAC');
    }

    if (!mac) {
      return res.status(400).json({
        error: 'Unable to detect device MAC address',
        message:
          'Ensure you are connecting through the captive portal',
      });
    }

    // Normalize MAC format (XX:XX:XX:XX:XX:XX)
    const normalizedMac = normalizeMacAddress(mac);

    if (!isValidMacAddress(normalizedMac)) {
      return res.status(400).json({
        error: 'Invalid MAC address format',
        received: mac,
      });
    }

    return res.status(200).json({
      mac: normalizedMac,
      timestamp: new Date().toISOString(),
      headers: {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      },
    });
  } catch (err) {
    console.error('MAC detection error:', err);
    return res.status(500).json({
      error: 'Failed to detect MAC address',
    });
  }
}

/**
 * Normalize MAC address to XX:XX:XX:XX:XX:XX format
 */
function normalizeMacAddress(mac: string): string {
  // Remove all separators
  let cleaned = mac.replace(/[:-]/g, '').toUpperCase();

  // If not 12 characters, invalid
  if (cleaned.length !== 12) {
    return mac;
  }

  // Format as XX:XX:XX:XX:XX:XX
  return cleaned.match(/.{1,2}/g)?.join(':') || mac;
}

/**
 * Validate MAC address format
 */
function isValidMacAddress(mac: string): boolean {
  // Pattern: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  return macRegex.test(mac);
}

export default {
  detectMacAddress,
  normalizeMacAddress,
  isValidMacAddress,
};