import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Car,
  MapPin,
  Navigation,
  Zap,
  Clock,
  Users,
  CheckCircle2,
  LocateFixed,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ShuttlePrePosition {
  id: string;
  event_id: string;
  dorm_location: string;
  dispatch_time: string;
  predicted_demand: number;
  shuttles_dispatched: number;
  status: string;
  events: { title: string; date: string };
}

export const PredictiveShuttleRadar: React.FC = () => {
  const [clusters, setClusters] = useState<ShuttlePrePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentMode, setStudentMode] = useState(false);
  const supabase = createClient();

  const fetchClusters = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("shuttle_pre_positions")
        .select(
          `
          *,
          events(title, date)
        `,
        )
        .order("dispatch_time", { ascending: true })
        .limit(10);

      if (!error && data) {
        setClusters(data as any);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClusters();
  }, []);

  const triggerAlgorithm = async () => {
    setLoading(true);
    try {
      await supabase.functions.invoke("predictive-shuttle-dispatch");
      await fetchClusters();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <LocateFixed className="h-8 w-8 text-indigo-500" />
            Autonomous Shuttle Predictive Dispatch
          </h1>
          <p className="text-slate-400 mt-2 font-mono text-sm max-w-3xl leading-relaxed">
            Eliminates cold waits by cross-referencing RSVP lists with Dorm profiles. Shuttles are
            pre-positioned in parking lots 30 minutes before events natively based on data
            clustering.
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={() => setStudentMode(!studentMode)}
            variant={studentMode ? "default" : "outline"}
            className={studentMode ? "bg-indigo-600" : "border-slate-700 bg-slate-900"}
          >
            {studentMode ? "Student View Active" : "Admin View Active"}
          </Button>
          {!studentMode && (
            <Button
              onClick={triggerAlgorithm}
              className="bg-emerald-600 hover:bg-emerald-700 font-bold"
            >
              <Zap className="mr-2 h-4 w-4" /> Run 6:00 PM Cron
            </Button>
          )}
        </div>
      </div>

      {studentMode ? (
        // STUDENT VIEW
        <div className="max-w-md mx-auto">
          <Card className="bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-indigo-500"></div>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto bg-emerald-500/20 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4">
                <Car className="h-10 w-10 text-emerald-400" />
              </div>
              <CardTitle className="text-2xl text-white font-black">0 Minutes</CardTitle>
              <CardDescription className="text-emerald-400 font-mono font-bold text-sm">
                Your shuttle is waiting outside.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                <div className="flex items-start gap-3 mb-4">
                  <MapPin className="h-5 w-5 text-indigo-400 mt-0.5" />
                  <div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                      Pickup
                    </p>
                    <p className="text-white font-medium">North Dorm Parking Lot</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Navigation className="h-5 w-5 text-emerald-400 mt-0.5" />
                  <div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                      Dropoff
                    </p>
                    <p className="text-white font-medium">Main Campus Event Center</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-400 font-mono bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20">
                <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0" />
                <p>
                  Because you RSVP'd, we predicted your ride and dispatched a shuttle 30 minutes
                  ago.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg font-bold">
                Board Shuttle
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : (
        // ADMIN / FLEET RADAR VIEW
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-12 flex justify-center text-slate-500 font-mono">
              Loading telemetry...
            </div>
          ) : clusters.length === 0 ? (
            <div className="col-span-full py-12 flex justify-center text-slate-500 font-mono border-2 border-dashed border-slate-800 rounded-xl">
              No predictive clusters generated yet. Run the 6:00 PM Cron.
            </div>
          ) : (
            clusters.map((cluster) => (
              <Card key={cluster.id} className="bg-slate-900 border-slate-800 shadow-xl">
                <CardHeader className="pb-3 border-b border-slate-800">
                  <div className="flex justify-between items-start">
                    <Badge
                      variant="outline"
                      className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                    >
                      {cluster.dorm_location}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-amber-500/10 text-amber-400 border-amber-500/30"
                    >
                      {cluster.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg text-white mt-3 truncate">
                    {cluster.events?.title || "Unknown Event"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex justify-between items-center text-sm font-mono">
                    <div className="text-slate-500">Predicted Demand</div>
                    <div className="text-white font-bold flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-400" /> {cluster.predicted_demand} RSVPs
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm font-mono">
                    <div className="text-slate-500">Pre-Position Time</div>
                    <div className="text-white font-bold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-emerald-400" />
                      {new Date(cluster.dispatch_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                      Fleet Allocation
                    </span>
                    <span className="text-2xl font-black text-emerald-400">
                      {cluster.shuttles_dispatched} Vans
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default PredictiveShuttleRadar;
