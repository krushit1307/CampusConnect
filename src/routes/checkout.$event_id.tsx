import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { Checkout } from "@/components/checkout/Checkout";
import { EarlyBirdSocialProof } from "@/components/checkout/EarlyBirdSocialProof";
import { createClient } from "@/lib/supabase/client";

export default function EventCheckoutPage() {
  const { event_id: eventId } = useParams<{ event_id: string }>();
  const [viewerId, setViewerId] = useState<string | undefined>();

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setViewerId(data.user?.id);
    });
  }, []);

  if (!eventId) return null;

  return (
    <SiteShell>
      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4">
          <EarlyBirdSocialProof eventId={eventId} viewerId={viewerId} />
          <Checkout />
        </div>
      </section>
    </SiteShell>
  );
}
