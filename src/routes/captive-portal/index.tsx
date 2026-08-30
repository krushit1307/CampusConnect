import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { validateMacSession, createMacSession } from '@/lib/network/macRandomizationSessionManager';
import { verifyWifiJwt } from '@/lib/network/wifiJwtTokenManager';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface DetectResponse {
  redirect_url: string;
  session_id?: string;
  campus_id: string;
}

interface AuthorizeResponse {
  success: boolean;
  message: string;
  redirect_url?: string;
}

export default function CaptivePortalPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'authorizing' | 'done'>('checking');

  // Get parameters from URL
  const mac = searchParams.get('mac');
  const sessionId = searchParams.get('session_id');
  const campusId = searchParams.get('campus_id');
  const jwtToken = searchParams.get('jwt');

  useEffect(() => {
    checkAndProcessSession();
  }, []);

  async function checkAndProcessSession() {
    try {
      setLoading(true);

      // If JWT token is provided, try silent re-authorization
      if (jwtToken && sessionId && mac && campusId) {
        setSessionStatus('authorizing');
        const result = await reauthorizeWithJwt(sessionId, mac, jwtToken);

        if (result.success) {
          setSessionStatus('done');
          // Close portal and return to internet
          if (result.redirect_url) {
            window.location.href = result.redirect_url;
          } else {
            // Close window if possible
            window.close();
          }
          return;
        }
      }

      // If we reach here, redirect to OAuth login
      if (campusId) {
        redirectToOAuthLogin(campusId);
      } else {
        setError('Unable to detect campus network. Please contact IT support.');
      }
    } catch (err) {
      setError(`Error: ${err}`);
      console.error('Captive portal error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function reauthorizeWithJwt(
    sessionId: string,
    macAddress: string,
    token: string
  ): Promise<AuthorizeResponse> {
    try {
      // Verify JWT is still valid
      const verification = await verifyWifiJwt(token);

      if (!verification.isValid) {
        return { success: false, message: 'JWT token invalid' };
      }

      // Validate MAC session
      const sessionValidation = await validateMacSession(sessionId, macAddress, token);

      if (sessionValidation.isValid) {
        // Silent re-authorization successful
        return {
          success: true,
          message: 'Device re-authorized',
          redirect_url: 'http://neverssl.com/', // Test connectivity
        };
      }

      return { success: false, message: 'Session validation failed' };
    } catch (err) {
      console.error('JWT reauthorization failed:', err);
      return { success: false, message: `Reauthorization error: ${err}` };
    }
  }

  function redirectToOAuthLogin(campusId: string) {
    // Redirect to OAuth login page with return URL
    const params = new URLSearchParams({
      redirect_uri: window.location.href,
      campus_id: campusId,
      mac: mac || '',
      response_type: 'code',
    });

    const loginUrl = `${import.meta.env.VITE_CAPTIVE_PORTAL_URL}/oauth/login?${params.toString()}`;
    window.location.href = loginUrl;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        {loading ? (
          <div className="text-center">
            <div className="inline-block">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              {sessionStatus === 'checking'
                ? 'Checking Network Connection'
                : sessionStatus === 'authorizing'
                ? 'Re-authorizing Device'
                : 'Completing Setup'}
            </h2>
            <p className="text-gray-600">
              {sessionStatus === 'checking'
                ? 'Please wait while we verify your device...'
                : sessionStatus === 'authorizing'
                ? 'Updating your MAC address authorization...'
                : 'You should be connected shortly...'}
            </p>
          </div>
        ) : error ? (
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Connection Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-green-500 text-4xl mb-4">✓</div>
            <h2 className="text-xl font-semibold text-gray-800">Connected</h2>
            <p className="text-gray-600 mt-2">You are now connected to the network.</p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Campus Wi-Fi Portal • {campusId}
          </p>
        </div>
      </div>
    </div>
  );
}