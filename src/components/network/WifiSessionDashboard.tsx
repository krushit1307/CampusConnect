import { useEffect, useState } from 'react';
import { useWifiMacSession } from '@/hooks/useWifiMacSession';
import { getActiveSessions, MacSession } from '@/lib/network/macRandomizationSessionManager';
import { useAuth } from '@/context/AuthContext';

export default function WifiSessionDashboard() {
  const { user } = useAuth();
  const {
    sessionId,
    currentMac,
    isMacValid,
    sessionExpiry,
    remainingTime,
    isExpiringSoon,
    rotationDetected,
    error,
    refreshSession,
  } = useWifiMacSession();

  const [sessions, setSessions] = useState<MacSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Load active sessions
  useEffect(() => {
    if (user?.id) {
      loadSessions();
    }
  }, [user]);

  async function loadSessions() {
    try {
      const activeSessions = await getActiveSessions(user!.id);
      setSessions(activeSessions);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  }

  // Auto-refresh session if expiring soon
  useEffect(() => {
    if (isExpiringSoon) {
      refreshSession();
    }
  }, [isExpiringSoon, refreshSession]);

  // Format remaining time
  const formatRemainingTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Current Session Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">WiFi Connection Status</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MAC Address */}
          <div className="bg-gray-50 rounded p-4">
            <p className="text-sm text-gray-600 mb-1">Current MAC Address</p>
            <p className="text-lg font-mono text-gray-800">
              {currentMac || 'Detecting...'}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {isMacValid ? (
                <span className="text-green-600">✓ Valid</span>
              ) : (
                <span className="text-red-600">✗ Invalid or Not Authorized</span>
              )}
            </p>
          </div>

          {/* Session Expiry */}
          <div className="bg-gray-50 rounded p-4">
            <p className="text-sm text-gray-600 mb-1">Session Expires In</p>
            <p className="text-lg font-semibold text-gray-800">
              {remainingTime > 0 ? formatRemainingTime(remainingTime) : 'Expired'}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {isExpiringSoon ? (
                <span className="text-amber-600">⚠ Expires soon</span>
              ) : (
                <span className="text-green-600">✓ Active</span>
              )}
            </p>
          </div>
        </div>

        {/* MAC Rotation Detection */}
        {rotationDetected && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-4">
            <p className="text-amber-700 text-sm">
              <span className="font-semibold">MAC Rotation Detected:</span> Your device's MAC
              address has changed. Re-authorizing with network...
            </p>
          </div>
        )}

        {/* Refresh Button */}
        <button
          onClick={refreshSession}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-medium"
        >
          Refresh Session
        </button>
      </div>

      {/* Active Sessions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Active Sessions</h2>

        {loading ? (
          <p className="text-gray-600">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="text-gray-600">No active WiFi sessions</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="border border-gray-200 rounded p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-sm text-gray-800">
                      {session.currentMacAddress}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Campus: {session.campusId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600">
                      {new Date(session.jwtExpiresAt) > new Date()
                        ? '✓ Active'
                        : '✗ Expired'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Created:{' '}
                      {new Date(session.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">About MAC Randomization</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>
            • Your device periodically changes its MAC address for privacy protection
          </li>
          <li>
            • CampusConnect automatically re-authorizes your device when MAC changes
          </li>
          <li>
            • No action needed on your part - authentication happens silently
          </li>
          <li>
            • Session remains active for 8 hours or until you disconnect
          </li>
        </ul>
      </div>
    </div>
  );
}