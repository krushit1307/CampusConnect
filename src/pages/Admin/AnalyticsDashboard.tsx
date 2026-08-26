import React, { useState, useEffect } from "react";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import type { RawEventData } from "@/workers/analytics.worker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";

/**
 * AnalyticsDashboard Page
 * Displays heavy analytics data. Previously locked the main thread for 1.5s.
 * Now offloads all calculation to a Web Worker for a perfectly smooth UI.
 */
export const AnalyticsDashboard: React.FC = () => {
  const [rawData, setRawData] = useState<RawEventData[] | null>(null);

  // Simulate fetching 5MB of raw JSON data
  useEffect(() => {
    const fetchData = async () => {
      // In production: const response = await fetch('/api/analytics/raw');
      // Mocking 10,000 records for demonstration
      const mockData: RawEventData[] = Array.from({ length: 10000 }, (_, i) => ({
        id: `evt-${i}`,
        category: i % 3 === 0 ? "Tech" : i % 3 === 1 ? "Arts" : "Sports",
        revenue: Math.random() * 5000,
        attendees: Math.floor(Math.random() * 500),
        durationMinutes: Math.floor(Math.random() * 240),
        date: new Date().toISOString(),
      }));
      setRawData(mockData);
    };
    fetchData();
  }, []);

  // Location 2: Use the hook to process data off the main thread
  const { stats, isLoading, error, retry } = useAnalyticsData(rawData);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-gray-600 dark:text-gray-300">
          Crunching massive datasets in the background...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4 text-red-500">
        <AlertCircle className="w-8 h-8" />
        <p>{error}</p>
        <Button onClick={retry} variant="outline">
          Retry Calculation
        </Button>
      </div>
    );
  }

  if (!stats) {
    return <div className="p-6 text-center text-gray-500">No data available</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Events</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {stats.totalEvents.toLocaleString()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-green-600">
            ${stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Avg. Attendees</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {Math.round(stats.averageAttendees)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Max Duration</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{stats.maxDuration} min</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {Object.entries(stats.categoryBreakdown).map(([category, data]) => (
              <li
                key={category}
                className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded"
              >
                <span className="font-medium capitalize">{category}</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {data.count} events | $
                  {data.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
