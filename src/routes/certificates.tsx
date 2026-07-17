import { CertificateCardSkeleton } from "@/components/CertificateCardSkeleton";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";

export default function Certificates() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["certificates", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("certificates")
        .select(
          `
          id, certificate_url, issued_at,
          events (title, clubs (name))
        `,
        )
        .eq("user_id", user?.id)
        .order("issued_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Minimal aesthetic - removed color array

  return (
    <SiteShell>
      <section className="border-b-2 border-black px-4 py-14 md:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow font-bold">Your certificates · {certs.length} issued</p>
          <h1 className="mt-2 text-4xl font-bold text-[#123a57] md:text-6xl">Proof of work.</h1>
          <p className="mt-4 max-w-2xl font-mono text-sm">
            Every certificate is signed and verifiable at a public URL. Share them anywhere.
          </p>
        </div>
      </section>
      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2">
          {isLoading ? (
            <>
              {Array.from({ length: 4 }).map((_, index) => (
                <CertificateCardSkeleton key={index} />
              ))}
            </>
          ) : certs.length === 0 ? (
            <div className="col-span-full font-mono py-10 text-gray-500">
              You don't have any certificates yet. Attend events to earn them!
            </div>
          ) : (
            certs.map((c, index) => {
              const event = Array.isArray(c.events) ? c.events[0] : c.events;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const club = (event && !Array.isArray(event.clubs) ? event.clubs : null) as any;

              return (
                <article key={c.id} className="neu-border neu-press bg-white p-6">
                  <div className="neu-border mb-4 flex items-center justify-between bg-[#f5c66b] px-4 py-6 text-[#123a57]">
                    <div>
                      <p className="eyebrow font-bold">Certificate</p>
                      <p className="mt-1 font-display text-2xl font-bold">
                        {event?.title || "Unknown Event"}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold">
                      {c.issued_at
                        ? new Date(c.issued_at)
                            .toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            .toUpperCase()
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono text-xs">
                    <div>
                      <p className="font-bold uppercase">Issued by</p>
                      <p>{club?.name || "CampusConnect"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold uppercase">ID</p>
                      <p className="truncate max-w-[100px]">{c.id.split("-")[0]}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={async () => {
                        setOpeningId(c.id);
                        const minDuration = new Promise((resolve) => setTimeout(resolve, 400));
                        window.open(c.certificate_url, "_blank");
                        await minDuration;
                        setOpeningId(null);
                      }}
                      disabled={openingId === c.id}
                      className="neu-border neu-press flex-1 bg-black px-3 py-2 font-mono text-xs font-bold uppercase text-cream disabled:opacity-50"
                    >
                      {openingId === c.id ? "Generating..." : "View PDF"}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(c.certificate_url);
                          toast.success("Link copied to clipboard!");
                        } catch (err) {
                          toast.error("Failed to copy link");
                        }
                      }}
                      className="neu-border neu-press flex-1 bg-white px-3 py-2 font-mono text-xs font-bold uppercase"
                    >
                      Copy link
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </SiteShell>
  );
}
