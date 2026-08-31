import { Worker, Job } from "bullmq";
import Redis from "ioredis";
// Note: Adjust the import path for your Supabase client based on the repo's structure
import { supabase } from "../db/supabaseClient";

const connection = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

export const activeThreatWorker = new Worker(
  "location-eval-queue",
  async (job: Job) => {
    const { userId, latitude, longitude } = job.data;

    // 1. Evaluate coordinates against the active threat zones via PostGIS RPC
    // We are passing the user's current long/lat to a Postgres function
    const { data: threatZones, error } = await supabase.rpc("evaluate_geofence", {
      user_lon: longitude,
      user_lat: latitude,
    });

    if (error) {
      console.error(`[Worker Error] Geofence evaluation failed for user ${userId}:`, error);
      return;
    }

    // 2. If the student crossed into the Red Zone, trigger the override payload
    if (threatZones && threatZones.length > 0) {
      console.warn(`🚨 CRITICAL: User ${userId} has entered an active threat zone!`);

      // TODO: Step 3 - High Priority APNS/FCM Push Notification Override
      // await triggerEmergencyPushOverride(userId, threatZones[0].id);
    }
  },
  { connection },
);

activeThreatWorker.on("ready", () => {
  console.log("Active Threat Worker is listening for background location updates...");
});
