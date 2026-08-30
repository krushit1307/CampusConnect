import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SiteShell } from "@/components/site/SiteShell";
import { RevivalRequestForm, RevivalRequestData } from "@/components/clubs/RevivalRequestForm";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useAuthHydration } from "@/hooks/useAuthHydration";

export default function ReviveClubPage() {
  const { slug } = useParams<{ slug: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthHydration();
  const supabase = createClient();

  const handleSubmit = async (data: RevivalRequestData) => {
    if (!user) {
      toast.error("You must be logged in to submit a petition.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Get the club ID from the slug
      const { data: club, error: clubError } = await supabase
        .from("clubs")
        .select("id, name")
        .eq("slug", slug)
        .single();

      if (clubError || !club) {
        throw new Error("Club not found.");
      }

      // 2. Submit the request
      const { error: requestError } = await supabase.from("club_revival_requests").insert({
        club_id: club.id,
        requested_by: user.id,
        motivation: data.motivation,
        leadership_plan: data.leadershipPlan,
      });

      if (requestError) throw requestError;

      toast.success(
        "Your petition has been submitted successfully! The Admin team will review it shortly.",
      );
      navigate(`/clubs/${slug}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Revive Club | CampusConnect</title>
      </Helmet>
      <SiteShell>
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="neu-border bg-white p-8">
            <h1 className="font-display text-3xl font-bold text-blue-900 mb-2">
              Petition to Revive Club
            </h1>
            <p className="font-mono text-gray-700 mb-8">
              This club is currently inactive. Please provide your student details and motivation to
              take over leadership.
            </p>
            <RevivalRequestForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
          </div>
        </div>
      </SiteShell>
    </>
  );
}
