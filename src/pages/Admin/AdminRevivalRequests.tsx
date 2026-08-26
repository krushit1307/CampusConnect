import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import format from "date-fns/format";

export default function AdminRevivalRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("club_revival_requests")
        .select(
          `
          id,
          motivation,
          leadership_plan,
          status,
          created_at,
          clubs ( id, name, slug ),
          profiles!requested_by ( id, full_name, email )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err: any) {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string, clubId: string) => {
    try {
      const { error } = await supabase
        .from("club_revival_requests")
        .update({ status: newStatus, reviewed_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      if (newStatus === "approved") {
        // Un-hibernate the club
        const { error: clubError } = await supabase
          .from("clubs")
          .update({
            status: "active",
            financial_hold: false,
            last_activity_at: new Date().toISOString(),
            hibernation_warning_sent_at: null,
            hibernated_at: null,
            archived_at: null,
          })
          .eq("id", clubId);

        if (clubError) throw clubError;
      }

      toast.success(`Request ${newStatus} successfully.`);
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  return (
    <>
      <Helmet>
        <title>Admin - Revival Requests | CampusConnect</title>
      </Helmet>
      <SiteShell>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="font-display text-3xl font-bold text-blue-900 mb-6">
            Club Revival Requests
          </h1>

          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="grid gap-6">
              {requests.map((req) => (
                <div key={req.id} className="neu-border bg-white p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="font-bold text-xl">{req.clubs?.name}</h2>
                      <p className="text-sm text-gray-600 font-mono">
                        Requested by: {req.profiles?.full_name} ({req.profiles?.email})
                      </p>
                      <p className="text-xs text-gray-500 font-mono mt-1">
                        Submitted on: {format(new Date(req.created_at), "PPP")}
                      </p>
                    </div>
                    <Badge
                      variant={
                        req.status === "pending"
                          ? "secondary"
                          : req.status === "approved"
                            ? "default"
                            : "destructive"
                      }
                      className="uppercase font-mono"
                    >
                      {req.status}
                    </Badge>
                  </div>

                  <div className="mb-4">
                    <h3 className="font-bold text-sm uppercase text-gray-500">Motivation</h3>
                    <p className="mt-1 text-gray-800 bg-gray-50 p-3 neu-border font-mono text-sm">
                      {req.motivation}
                    </p>
                  </div>

                  <div className="mb-6">
                    <h3 className="font-bold text-sm uppercase text-gray-500">Leadership Plan</h3>
                    <p className="mt-1 text-gray-800 bg-gray-50 p-3 neu-border font-mono text-sm">
                      {req.leadership_plan}
                    </p>
                  </div>

                  {req.status === "pending" && (
                    <div className="flex gap-4">
                      <Button
                        onClick={() => handleUpdateStatus(req.id, "approved", req.clubs?.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Approve & Revive Club
                      </Button>
                      <Button
                        onClick={() => handleUpdateStatus(req.id, "rejected", req.clubs?.id)}
                        variant="destructive"
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {requests.length === 0 && <p>No revival requests found.</p>}
            </div>
          )}
        </div>
      </SiteShell>
    </>
  );
}
