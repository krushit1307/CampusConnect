import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { SponsorBountyService } from "@/services/sponsorBountyService";
import type { SponsorBountyWithSponsor } from "@/types/sponsorBounties";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Trophy, Gift, CheckCircle } from "lucide-react";

export interface SponsorBountiesSectionProps {
  eventId: string;
}

export const SponsorBountiesSection: React.FC<SponsorBountiesSectionProps> = ({ eventId }) => {
  const [bounties, setBounties] = useState<SponsorBountyWithSponsor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [claimCodes, setClaimCodes] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadBounties();
  }, [eventId]);

  const loadBounties = async () => {
    try {
      setIsLoading(true);
      const data = await SponsorBountyService.getBountiesByEventId(eventId);
      setBounties(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load sponsor bounties.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimChange = (bountyId: string, value: string) => {
    setClaimCodes((prev) => ({ ...prev, [bountyId]: value }));
  };

  const handleClaimSubmit = async (bountyId: string) => {
    const code = claimCodes[bountyId];
    if (!code || code.trim().length === 0) {
      toast.error("Please enter a valid claim code");
      return;
    }

    try {
      setIsSubmitting((prev) => ({ ...prev, [bountyId]: true }));
      const response = await SponsorBountyService.claimBounty(code.trim());

      if (response && response.success) {
        toast.success(
          <div className="flex items-center gap-2">
            <Trophy className="text-yellow-500" size={20} />
            <span>Success! You earned {response.points_awarded} points!</span>
          </div>,
        );
        handleClaimChange(bountyId, "");
        await loadBounties(); // refresh to update 'current_claims'
      } else {
        toast.error("Failed to claim bounty.");
      }
    } catch (error: any) {
      console.error(error);
      const msg = error?.message || "Invalid claim code or already claimed.";
      toast.error(msg);
    } finally {
      setIsSubmitting((prev) => ({ ...prev, [bountyId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="py-8 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (bounties.length === 0) {
    return null; // Don't show the section if there are no bounties
  }

  return (
    <div className="mt-12 space-y-6">
      <div className="flex items-center gap-2">
        <Gift className="text-primary" size={24} />
        <h2 className="font-display text-2xl font-bold">Sponsor Bounties</h2>
      </div>
      <p className="text-gray-600 font-mono text-sm max-w-2xl">
        Complete micro-tasks at sponsor booths to earn gamification points! Speak with the
        recruiters to get your unique 6-digit claim code.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
        {bounties.map((bounty) => {
          const isFull = bounty.max_claims > 0 && bounty.current_claims >= bounty.max_claims;
          return (
            <Card
              key={bounty.id}
              className="relative overflow-hidden border-2 flex flex-col justify-between"
            >
              {isFull && (
                <div className="absolute top-0 right-0 bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-bl-lg">
                  Fully Claimed
                </div>
              )}
              <CardHeader className="pb-3">
                {bounty.sponsors?.logo_url && (
                  <img
                    src={bounty.sponsors.logo_url}
                    alt={bounty.sponsors.company_name}
                    className="h-10 object-contain mb-2"
                  />
                )}
                <div className="text-sm font-bold text-primary mb-1 uppercase tracking-wider">
                  {bounty.sponsors?.company_name}
                </div>
                <CardTitle className="text-lg leading-tight">{bounty.title}</CardTitle>
                <CardDescription className="text-sm mt-2">{bounty.description}</CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex items-center gap-2 bg-yellow-50 text-yellow-800 px-3 py-2 rounded-md font-mono text-sm mt-2 font-bold w-fit border border-yellow-200">
                  <Trophy size={16} />
                  {bounty.points_reward} Points
                </div>
              </CardContent>
              <CardFooter className="bg-gray-50 border-t p-4 flex gap-2">
                <Input
                  placeholder="6-digit code"
                  value={claimCodes[bounty.id] || ""}
                  onChange={(e) => handleClaimChange(bounty.id, e.target.value)}
                  className="font-mono uppercase h-10 bg-white"
                  maxLength={6}
                  disabled={isFull || isSubmitting[bounty.id]}
                />
                <Button
                  onClick={() => handleClaimSubmit(bounty.id)}
                  disabled={isFull || isSubmitting[bounty.id]}
                  className="h-10"
                >
                  {isSubmitting[bounty.id] ? "Claiming..." : "Claim"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
