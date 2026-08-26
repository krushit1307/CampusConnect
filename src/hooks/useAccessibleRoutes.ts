import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  AccessibleRoute,
  AccessiblePathway,
  TransitStop,
  VenueEntrance,
  PathwayFacility,
  PathwayObstacle,
  RouteTurn,
  AccessibilityReport,
  AccessibilityStats,
} from "@/types/accessibility";

// ─── Database Row Types ─────────────────────────────────────────────────

interface TransitStopRow {
  stop_id: string;
  stop_name: string;
  stop_type: string;
  stop_lat: number;
  stop_lng: number;
  accessible: boolean;
  has_shelter: boolean;
  distance_m: number;
}

interface RouteRow {
  route_id: string;
  route_name: string;
  route_description: string | null;
  transit_stop_name: string;
  transit_stop_lat: number;
  transit_stop_lng: number;
  venue_entrance_lat: number;
  venue_entrance_lng: number;
  total_distance_m: number;
  estimated_time_min: number;
  difficulty: string;
  wheelchair_friendly: boolean;
  visually_friendly: boolean;
  overall_rating: number;
  total_ratings: number;
  verified: boolean;
  reported_issues: number;
}

interface PathwayRow {
  pathway_id: string;
  pathway_name: string;
  geometry: { type: string; coordinates: [number, number][] };
  surface: string;
  width_meters: number;
  has_ramp: boolean;
  has_tactile_paving: boolean;
  has_handrails: boolean;
  grade_pct: number;
  avg_rating: number;
  total_ratings: number;
  sort_order: number;
}

interface FacilityRow {
  facility_id: string | null;
  facility_type: string | null;
  facility_lat: number | null;
  facility_lng: number | null;
  facility_name: string | null;
  facility_desc: string | null;
  operational: boolean | null;
  obstacle_id: string | null;
  obstacle_type: string | null;
  obstacle_lat: number | null;
  obstacle_lng: number | null;
  obstacle_desc: string | null;
  workaround: string | null;
  severity: string | null;
}

interface TurnRow {
  turn_id: string;
  sort_order: number;
  instruction: string;
  distance_meters: number;
  latitude: number;
  longitude: number;
  landmark: string | null;
  caution: string | null;
}

interface StatsRow {
  total_pathways: number;
  verified_pathways: number;
  total_routes: number;
  total_reports: number;
  pending_reports: number;
  avg_route_rating: number;
  wheelchair_coverage_pct: number;
  last_community_update: string | null;
}

// ─── Mappers ────────────────────────────────────────────────────────────

function mapTransitStop(row: TransitStopRow, distanceM: number): TransitStop {
  return {
    id: row.stop_id,
    name: row.stop_name,
    type: row.stop_type as TransitStop["type"],
    position: { lat: row.stop_lat, lng: row.stop_lng },
    accessible: row.accessible,
    hasShelter: row.has_shelter,
    nearestParkingAccessible: false,
    description: "",
  };
}

function mapPathway(row: PathwayRow): AccessiblePathway {
  return {
    id: row.pathway_id,
    name: row.pathway_name,
    geometry: {
      type: "LineString",
      coordinates: row.geometry.coordinates,
    },
    surface: row.surface as AccessiblePathway["surface"],
    widthMeters: row.width_meters,
    hasRamp: row.has_ramp,
    hasTactilePaving: row.has_tactile_paving,
    hasHandrails: row.has_handrails,
    gradePercentage: row.grade_pct,
    obstacles: [],
    facilities: [],
    verifiedBy: "",
    verifiedAt: new Date(),
    lastInspected: new Date(),
    crowdsourceUpdated: false,
    averageRating: row.avg_rating,
    totalRatings: row.total_ratings,
  };
}

function mapFacility(row: FacilityRow): PathwayFacility | null {
  if (!row.facility_id) return null;
  return {
    id: row.facility_id,
    type: row.facility_type as PathwayFacility["type"],
    position: { lat: row.facility_lat!, lng: row.facility_lng! },
    name: row.facility_name || "",
    description: row.facility_desc || "",
    operational: row.operational ?? true,
    lastChecked: new Date(),
  };
}

function mapObstacle(row: FacilityRow): PathwayObstacle | null {
  if (!row.obstacle_id) return null;
  return {
    id: row.obstacle_id,
    type: row.obstacle_type as PathwayObstacle["type"],
    position: { lat: row.obstacle_lat!, lng: row.obstacle_lng! },
    description: row.obstacle_desc || "",
    workaround: row.workaround || undefined,
    severity: (row.severity as PathwayObstacle["severity"]) || "moderate",
    reportedBy: "",
    reportedAt: new Date(),
  };
}

function mapTurn(row: TurnRow): RouteTurn {
  return {
    instruction: row.instruction,
    distanceMeters: row.distance_meters,
    pathwayId: "",
    waypoint: { lat: row.latitude, lng: row.longitude },
    landmark: row.landmark || undefined,
    caution: row.caution || undefined,
  };
}

function mapRoute(
  row: RouteRow,
  pathways: AccessiblePathway[],
  turns: RouteTurn[],
  facilities: PathwayFacility[],
  obstacles: PathwayObstacle[],
): AccessibleRoute {
  const transitStop: TransitStop = {
    id: "",
    name: row.transit_stop_name,
    type: "bus-stop",
    position: { lat: row.transit_stop_lat, lng: row.transit_stop_lng },
    accessible: true,
    hasShelter: false,
    nearestParkingAccessible: false,
    description: "",
  };
  const venueEntrance: VenueEntrance = {
    id: "",
    venueId: "",
    venueName: "",
    entranceName: "",
    position: { lat: row.venue_entrance_lat, lng: row.venue_entrance_lng },
    hasAutomaticDoor: false,
    hasRamp: true,
    doorWidthCm: 100,
    description: "",
  };
  return {
    id: row.route_id,
    name: row.route_name,
    description: row.route_description || "",
    transitStopId: "",
    transitStop,
    venueEntranceId: "",
    venueEntrance,
    pathwayIds: pathways.map((p) => p.id),
    pathways,
    totalDistanceMeters: row.total_distance_m,
    estimatedTimeMinutes: row.estimated_time_min,
    difficulty: row.difficulty as AccessibleRoute["difficulty"],
    wheelchairFriendly: row.wheelchair_friendly,
    visuallyFriendly: row.visually_friendly,
    mobilityAidCompatible: row.wheelchair_friendly,
    turns,
    overallRating: row.overall_rating,
    totalRatings: row.total_ratings,
    verified: row.verified,
    lastUpdated: new Date(),
    reportedIssues: row.reported_issues,
  };
}

// ─── Hook: Nearest Transit Stops ────────────────────────────────────────

export function useNearestTransitStops(
  latitude: number | null,
  longitude: number | null,
  limit = 5,
) {
  return useQuery({
    queryKey: ["nearest-transit-stops", latitude, longitude, limit],
    enabled: latitude != null && longitude != null,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("find_nearest_transit_stops", {
        p_latitude: latitude,
        p_longitude: longitude,
        p_limit: limit,
      });
      if (error) throw error;
      return (data as TransitStopRow[]).map((row) =>
        mapTransitStop(row, row.distance_m),
      );
    },
  });
}

// ─── Hook: Routes for a Venue Entrance ──────────────────────────────────

export function useAccessibleRoutes(venueEntranceId: string | null) {
  return useQuery({
    queryKey: ["accessible-routes", venueEntranceId],
    enabled: Boolean(venueEntranceId),
    queryFn: async () => {
      const supabase = createClient();
      const { data: routeRows, error: routeErr } = await supabase.rpc(
        "get_accessible_routes_for_entrance",
        { p_venue_entrance_id: venueEntranceId },
      );
      if (routeErr) throw routeErr;

      const routes: AccessibleRoute[] = [];

      for (const row of routeRows as RouteRow[]) {
        // Fetch pathways for each route
        const { data: pathwayRows } = await supabase.rpc("get_route_pathways", {
          p_route_id: row.route_id,
        });
        const pathways = (pathwayRows as PathwayRow[]).map(mapPathway);

        // Fetch turns
        const { data: turnRows } = await supabase.rpc("get_route_turns", {
          p_route_id: row.route_id,
        });
        const turns = (turnRows as TurnRow[]).map(mapTurn);

        // Fetch facility/obstacle details for each pathway
        const allFacilities: PathwayFacility[] = [];
        const allObstacles: PathwayObstacle[] = [];
        for (const pw of pathways) {
          const { data: detailRows } = await supabase.rpc("get_pathway_details", {
            p_pathway_id: pw.id,
          });
          for (const d of detailRows as FacilityRow[]) {
            const f = mapFacility(d);
            if (f) allFacilities.push(f);
            const o = mapObstacle(d);
            if (o) allObstacles.push(o);
          }
          pw.facilities = allFacilities.filter(() => true);
          pw.obstacles = allObstacles.filter(() => true);
        }

        routes.push(mapRoute(row, pathways, turns, allFacilities, allObstacles));
      }

      return routes;
    },
  });
}

// ─── Hook: Single Route Full Detail ─────────────────────────────────────

export function useAccessibleRouteDetail(routeId: string | null) {
  return useQuery({
    queryKey: ["accessible-route-detail", routeId],
    enabled: Boolean(routeId),
    queryFn: async () => {
      const supabase = createClient();

      const { data: routeRow, error } = await supabase
        .from("accessible_routes")
        .select("*")
        .eq("id", routeId)
        .single();
      if (error) throw error;

      const { data: pathwayRows } = await supabase.rpc("get_route_pathways", {
        p_route_id: routeId,
      });
      const pathways = (pathwayRows as PathwayRow[]).map(mapPathway);

      const { data: turnRows } = await supabase.rpc("get_route_turns", {
        p_route_id: routeId,
      });
      const turns = (turnRows as TurnRow[]).map(mapTurn);

      const allFacilities: PathwayFacility[] = [];
      const allObstacles: PathwayObstacle[] = [];
      for (const pw of pathways) {
        const { data: detailRows } = await supabase.rpc("get_pathway_details", {
          p_pathway_id: pw.id,
        });
        for (const d of detailRows as FacilityRow[]) {
          const f = mapFacility(d);
          if (f) allFacilities.push(f);
          const o = mapObstacle(d);
          if (o) allObstacles.push(o);
        }
      }

      return {
        route: routeRow,
        pathways,
        turns,
        facilities: allFacilities,
        obstacles: allObstacles,
      };
    },
  });
}

// ─── Hook: All Transit Stops ────────────────────────────────────────────

export function useTransitStops() {
  return useQuery({
    queryKey: ["transit-stops"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transit_stops")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []).map(
        (row: {
          id: string;
          name: string;
          type: string;
          latitude: number;
          longitude: number;
          accessible: boolean;
          has_shelter: boolean;
          nearest_parking_accessible: boolean;
          description: string;
        }): TransitStop => ({
          id: row.id,
          name: row.name,
          type: row.type as TransitStop["type"],
          position: { lat: row.latitude, lng: row.longitude },
          accessible: row.accessible,
          hasShelter: row.has_shelter,
          nearestParkingAccessible: row.nearest_parking_accessible,
          description: row.description || "",
        }),
      );
    },
  });
}

// ─── Hook: All Venue Entrances ──────────────────────────────────────────

export function useVenueEntrances(venueId?: string) {
  return useQuery({
    queryKey: ["venue-entrances", venueId],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase.from("venue_entrances").select("*").order("venue_name");
      if (venueId) query = query.eq("venue_id", venueId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(
        (row: {
          id: string;
          venue_id: string;
          venue_name: string;
          entrance_name: string;
          latitude: number;
          longitude: number;
          has_automatic_door: boolean;
          has_ramp: boolean;
          door_width_cm: number;
          description: string;
        }): VenueEntrance => ({
          id: row.id,
          venueId: row.venue_id,
          venueName: row.venue_name,
          entranceName: row.entrance_name,
          position: { lat: row.latitude, lng: row.longitude },
          hasAutomaticDoor: row.has_automatic_door,
          hasRamp: row.has_ramp,
          doorWidthCm: row.door_width_cm,
          description: row.description || "",
        }),
      );
    },
  });
}

// ─── Hook: All Pathways ─────────────────────────────────────────────────

export function useAllPathways() {
  return useQuery({
    queryKey: ["all-pathways"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("accessible_pathways")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []).map(
        (row: {
          id: string;
          name: string;
          geometry: { type: string; coordinates: [number, number][] };
          surface: string;
          width_meters: number;
          has_ramp: boolean;
          has_tactile_paving: boolean;
          has_handrails: boolean;
          grade_percentage: number;
          average_rating: number;
          total_ratings: number;
        }): AccessiblePathway => ({
          id: row.id,
          name: row.name,
          geometry: {
            type: "LineString",
            coordinates: row.geometry.coordinates,
          },
          surface: row.surface as AccessiblePathway["surface"],
          widthMeters: row.width_meters,
          hasRamp: row.has_ramp,
          hasTactilePaving: row.has_tactile_paving,
          hasHandrails: row.has_handrails,
          gradePercentage: row.grade_percentage,
          obstacles: [],
          facilities: [],
          verifiedBy: "",
          verifiedAt: new Date(),
          lastInspected: new Date(),
          crowdsourceUpdated: false,
          averageRating: row.average_rating,
          totalRatings: row.total_ratings,
        }),
      );
    },
  });
}

// ─── Hook: Accessibility Stats ──────────────────────────────────────────

export function useAccessibilityStats() {
  return useQuery({
    queryKey: ["accessibility-stats"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_accessibility_stats");
      if (error) throw error;
      const row = (data as StatsRow[])[0];
      if (!row) return null;
      return {
        totalPathways: row.total_pathways,
        verifiedPathways: row.verified_pathways,
        totalRoutes: row.total_routes,
        totalReports: row.total_reports,
        pendingReports: row.pending_reports,
        averageRouteRating: row.avg_route_rating,
        wheelchairCoveragePercent: row.wheelchair_coverage_pct,
        lastCommunityUpdate: row.last_community_update
          ? new Date(row.last_community_update)
          : new Date(),
      } as AccessibilityStats;
    },
  });
}

// ─── Mutation: Submit Crowdsource Report ────────────────────────────────

interface SubmitReportParams {
  reporterName: string;
  reporterRole: string;
  pathwayId?: string;
  routeId?: string;
  type: AccessibilityReport["type"];
  title: string;
  description: string;
  latitude?: number;
  longitude?: number;
  images?: string[];
  severity: "minor" | "moderate" | "severe" | "blocking";
}

export function useSubmitAccessibilityReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SubmitReportParams) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("submit_accessibility_report", {
        p_reporter_name: params.reporterName,
        p_reporter_role: params.reporterRole,
        p_pathway_id: params.pathwayId || null,
        p_route_id: params.routeId || null,
        p_type: params.type,
        p_title: params.title,
        p_description: params.description,
        p_latitude: params.latitude || null,
        p_longitude: params.longitude || null,
        p_images: params.images || [],
        p_severity: params.severity,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accessibility-stats"] });
    },
  });
}

// ─── Mutation: Rate a Route ─────────────────────────────────────────────

export function useRateRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      routeId,
      rating,
      comment,
    }: {
      routeId: string;
      rating: number;
      comment?: string;
    }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("rate_accessible_route", {
        p_route_id: routeId,
        p_rating: rating,
        p_comment: comment || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accessible-routes"] });
      queryClient.invalidateQueries({ queryKey: ["accessible-route-detail"] });
    },
  });
}

// ─── Mutation: Submit New Pathway ───────────────────────────────────────

interface SubmitPathwayParams {
  name: string;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  surface: string;
  widthMeters: number;
  hasRamp: boolean;
  hasTactilePaving: boolean;
  hasHandrails: boolean;
  gradePercentage: number;
}

export function useSubmitPathway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SubmitPathwayParams) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("submit_accessible_pathway", {
        p_name: params.name,
        p_geometry: params.geometry,
        p_surface: params.surface,
        p_width_meters: params.widthMeters,
        p_has_ramp: params.hasRamp,
        p_has_tactile_paving: params.hasTactilePaving,
        p_has_handrails: params.hasHandrails,
        p_grade_percentage: params.gradePercentage,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-pathways"] });
      queryClient.invalidateQueries({ queryKey: ["accessibility-stats"] });
    },
  });
}
