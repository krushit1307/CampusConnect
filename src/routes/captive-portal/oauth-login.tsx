import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { createMacSession } from '@/lib/network/macRandomizationSessionManager';

export default function OAuthLoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, signInWithSSO } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = searchParams.get('redirect_uri') || '';
  const campusId = searchParams.get('campus_id') || '';
  const mac = searchParams.get('mac') || '';

  useEffect(() => {
    // If already logged in, proceed with MAC session creation
    if (user) {
      handleOAuthCallback();
    }
  }, [user]);

  async function handleOAuthCallback() {
    try {
      setLoading(true);

      if (!user?.id || !campusId) {
        setError('Missing required parameters');
        return;
      }

      // Create MAC session with JWT token
      const { session, jwtToken } = await createMacSession({
        userId: user.id,
        macAddress: mac,
        campusId,
      });

      // Set JWT in secure HTTP-only cookie
      // This is done server-side to ensure HTTP-only flag
      const cookieParams = new URLSearchParams({
        jwt_token: jwtToken,
        session_id: session.sessionId,
        max_age: '28800', // 8 hours
      });

      // Redirect back to captive portal with JWT
      const returnUrl = new URL(redirectUri);
      returnUrl.searchParams.set('jwt', jwtToken);
      returnUrl.searchParams.set('session_id', session.sessionId);
      returnUrl.searchParams.set('mac', mac);
      returnUrl.searchParams.set('campus_id', campusId);
      returnUrl.searchParams.set('status', 'authenticated');

      window.location.href = returnUrl.toString();
    } catch (err) {
      setError(`Failed to create WiFi session: ${err}`);
      console.error('OAuth callback error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSSO() {
    try {
      setLoading(true);
      setError(null);

      // Initiate University SSO flow
      await signInWithSSO({
        provider: 'university_sso',
        redirectUrl: window.location.href,
      });
    } catch (err) {
      setError(`SSO login failed: ${err}`);
      console.error('SSO error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.111 16.251a.999.999 0 001.414 0l7.07-7.07M12 20c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm0-14a1 1 0 100 2 1 1 0 000-2z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Campus WiFi</h1>
          <p className="text-gray-600">Sign in to connect to the network</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleSSO}
          disabled={loading}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <svg