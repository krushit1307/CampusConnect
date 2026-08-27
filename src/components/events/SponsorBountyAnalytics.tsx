import React, { useState, useEffect } from "react";
import { Loader2, Users, Trophy } from "lucide-react";
import { SponsorBountyService } from "@/services/sponsorBountyService";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";

interface SponsorBountyAnalyticsProps {
  eventId: string;
}

export const SponsorBountyAnalytics: React.FC<SponsorBountyAnalyticsProps> = ({ eventId }) => {
  const [claims, setClaims] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [eventId]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // We need to fetch the sponsor's sponsor record for this event.
      // Usually auth.uid() corresponds to created_by of the sponsor.
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      if (!userId) return;

      const { data: mySponsors, error: sponsorErr } = await supabase
        .from("sponsors")
        .select("*")
        .eq("event_id", eventId)
        .eq("created_by", userId);

      if (sponsorErr) throw sponsorErr;

      setSponsors(mySponsors || []);

      if (mySponsors && mySponsors.length > 0) {
        // Collect all claims for all sponsors owned by the user attached to this event
        const allClaims = [];
        for (const s of mySponsors) {
          const sClaims = await SponsorBountyService.getSponsorAnalytics(s.id);
          if (sClaims) {
            allClaims.push(...sClaims);
          }
        }
        setClaims(allClaims);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (sponsors.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 border rounded-lg bg-gray-50">
        You have no sponsor profiles registered for this event.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bounties Claimed</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{claims.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Engaged Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(claims.map((c) => c.profiles?.id)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white dark:bg-slate-900 border rounded-lg shadow-sm">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Detailed Claims Log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Student Name</th>
                <th className="px-6 py-4 font-semibold">College/Major</th>
                <th className="px-6 py-4 font-semibold">Bounty Claimed</th>
                <th className="px-6 py-4 font-semibold text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {claims.length > 0 ? (
                claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4 font-medium">
                      <div className="flex items-center gap-3">
                        {claim.profiles?.avatar_url && (
                          <img
                            src={claim.profiles.avatar_url}
                            className="w-8 h-8 rounded-full bg-gray-200"
                            alt="avatar"
                          />
                        )}
                        <div>
                          {claim.profiles?.first_name} {claim.profiles?.last_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{claim.profiles?.college || "N/A"}</td>
                    <td className="px-6 py-4">
                      {claim.sponsor_bounties?.title || "Unknown Bounty"}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {new Date(claim.claimed_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No bounties have been claimed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
