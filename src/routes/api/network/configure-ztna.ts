import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Configure ZTNA network for a campus
 * POST /api/network/configure-ztna
 */
export async function configureZtnaNetwork(req: Request, res: Response) {
  try {
    const {
      campusId,
      iseServerUrl,
      iseApiKey,
      iseApiSecret,
      captivePortalUrl,
      oauthRedirectUri,
      jwtSigningKey,
    } = req.body;

    // Validate required fields
    if (
      !campusId ||
      !iseServerUrl ||
      !iseApiKey ||
      !iseApiSecret ||
      !captivePortalUrl ||
      !oauthRedirectUri ||
      !jwtSigningKey
    ) {
      return res.status(400).json({
        error: 'Missing required configuration fields',
      });
    }

    // Check if config already exists
    const { data: existing } = await supabase
      .from('ztna_network_config')
      .select()
      .eq('campus_id', campusId)
      .single();

    let result;

    if (existing) {
      // Update existing config
      const { data, error } = await supabase
        .from('ztna_network_config')
        .update({
          ise_server_url: iseServerUrl,
          ise_api_key: iseApiKey,
          ise_api_secret: iseApiSecret,
          captive_portal_url: captivePortalUrl,
          oauth_redirect_uri: oauthRedirectUri,
          jwt_signing_key: jwtSigningKey,
          updated_at: new Date().toISOString(),
        })
        .eq('campus_id', campusId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      result = data;
    } else {
      // Create new config
      const { data, error } = await supabase
        .from('ztna_network_config')
        .insert([
          {
            campus_id: campusId,
            ise_server_url: iseServerUrl,
            ise_api_key: iseApiKey,
            ise_api_secret: iseApiSecret,
            captive_portal_url: captivePortalUrl,
            oauth_redirect_uri: oauthRedirectUri,
            jwt_signing_key: jwtSigningKey,
            is_active: true,
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      result = data;
    }

    // Return sanitized response (never expose secrets)
    return res.status(200).json({
      success: true,
      message: 'ZTNA network configured successfully',
      config: {
        id: result.id,
        campusId: result.campus_id,
        iseServerUrl: result.ise_server_url,
        captivePortalUrl: result.captive_portal_url,
        isActive: result.is_active,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      },
    });
  } catch (err) {
    console.error('ZTNA configuration error:', err);
    return res.status(500).json({
      error: 'Failed to configure ZTNA network',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * Get ZTNA network configuration for campus
 * GET /api/network/ztna-config/:campusId
 */
export async function getZtnaConfig(req: Request, res: Response) {
  try {
    const { campusId } = req.params;

    const { data, error } = await supabase
      .from('ztna_network_config')
      .select()
      .eq('campus_id', campusId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return res.status(404).json({
        error: 'ZTNA configuration not found for campus',
      });
    }

    // Return non-sensitive fields only
    return res.status(200).json({
      campusId: data.campus_id,
      iseServerUrl: data.ise_server_url,
      captivePortalUrl: data.captive_portal_url,
    });
  } catch (err) {
    console.error('Failed to get ZTNA config:', err);
    return res.status(500).json({
      error: 'Failed to retrieve ZTNA configuration',
    });
  }
}

export default {
  configureZtnaNetwork,
  getZtnaConfig,
};