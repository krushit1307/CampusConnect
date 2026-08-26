import React, { useEffect, useState } from "react";
import {
  Globe,
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  Radio,
  RefreshCw,
  Loader2,
  Shield,
} from "lucide-react";
import {
  getFederationStats,
  getFederatedServers,
  type FederationStats,
} from "../lib/federatedCalendar";

/**
 * FederationAdminPanel
 *
 * Admin dashboard for managing cross-campus federation.
 * Shows trusted campuses, broadcast stats, and recent activity.
 * Accessible only to system admins and club presidents.
 */
export function FederationAdminPanel({ className = "" }: { className?: string }) {
  const [stats, setStats] = useState<FederationStats | null>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [statsData, serversData] = await Promise.all([
      getFederationStats(),
      getFederatedServers(),
    ]);

    setStats(statsData);
    setServers(serversData);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8" role="status">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="ml-2 text-sm text-gray-500">
          Loading federation data...
        </span>
      </div>
    );
  }

  return (
    <div className={`federation-admin-panel ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Federation Admin
          </h2>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Globe className="w-5 h-5 text-indigo-500" />}
            label="Trusted Campuses"
            value={stats.trusted_campuses}
          />
          <StatCard
            icon={<Radio className="w-5 h-5 text-emerald-500" />}
            label="Federated Events"
            value={stats.federated_events}
          />
          <StatCard
            icon={<Building2 className="w-5 h-5 text-amber-500" />}
            label="Remote Events Received"
            value={stats.remote_events_received}
          />
          <StatCard
            icon={<CheckCircle className="w-5 h-5 text-blue-500" />}
            label="Broadcasts (24h)"
            value={stats.broadcasts_24h}
          />
        </div>
      )}

      {/* Trusted Campuses */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Trusted Campuses
        </h3>
        {servers.length === 0 ? (
          <p className="text-sm text-gray-500">
            No trusted campuses configured. Add a federated server to enable
            cross-campus event sharing.
          </p>
        ) : (
          <div className="space-y-3">
            {servers.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <Globe
                    className={`w-5 h-5 ${
                      server.is_active ? "text-emerald-500" : "text-gray-400"
                    }`}
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {server.institution_name}
                    </p>
                    <p className="text-sm text-gray-500">{server.domain}</p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    server.is_active
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                  }`}
                >
                  {server.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {stats?.recent_activity && stats.recent_activity.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Federation Activity
          </h3>
          <div className="space-y-2">
            {stats.recent_activity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
              >
                {activity.status === "success" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : activity.status === "failed" ? (
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                )}
                <span className="flex-1 text-gray-700 dark:text-gray-300">
                  <strong className="capitalize">{activity.action}</strong>
                  {activity.target_domain && (
                    <> to {activity.target_domain}</>
                  )}
                  {activity.details?.event_title && (
                    <> — {(activity.details.event_title as string).slice(0, 50)}</>
                  )}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(activity.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}
