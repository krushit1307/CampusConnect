import { CertificateCardSkeleton } from "@/components/CertificateCardSkeleton";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { Award, ArrowRight, Copy, Download, Loader2, QrCode, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatDateOnly } from "@/lib/utils";
import { downloadCertificatePdf } from "@/lib/certificateUtils";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface CertificateClub {
  name: string;
}

interface CertificateEvent {
  title: string;
  clubs: CertificateClub | CertificateClub[] | null;
}

interface Certificate {
  id: string;
  certificate_url: string;
  issued_at: string | null;
  events: CertificateEvent | CertificateEvent[] | null;
}

export default function Certificates() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [ticketCert, setTicketCert] = useState<Certificate | null>(null);
  const [isTicketOpen, setIsTicketOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const {
    data: certs = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["certificates", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificates")
        .select(
          `
          id, certificate_url, issued_at,
          events (title, clubs (name))
        `,
        )
        .eq("user_id", user?.id)
        .order("issued_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }
      return data || [];
    },
    enabled: !!user?.id,
  });

  const colors = ["bg-lime", "bg-sky", "bg-lavender", "bg-peach"];
  const displayedCerts = certs;

  return (
    <SiteShell>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          opacity: 0;
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <section className="bg-amber-300 px-4 py-12 md:px-6">
        <div className="mx-auto max-w-7xl">
          {isLoading ? (
            <>
              {Array.from({ length: 4 }).map((_, index) => (
                <CertificateCardSkeleton key={index} />
              ))}
            </>
          ) : certs.length === 0 ? (
            <div className="col-span-full font-mono py-10 text-neutral-600">
              You don't have any certificates yet. Attend events to earn them!
            </div>
          ) : displayedCerts.length === 0 ? (
            <div className="col-span-full">
              <div className="neu-border neu-shadow bg-white p-8 md:p-12 text-center flex flex-col items-center">
                <div className="neu-border bg-peach p-5 mb-6 inline-flex justify-center items-center">
                  <Award className="h-12 w-12 text-black" />
                </div>

                <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
                  No Proof of Work Yet
                </h2>

                <p className="font-mono text-sm max-w-xl text-gray-600 mb-8 leading-relaxed">
                  Verifiable certificates are awarded for attending events, workshops, and
                  hackathons. Once you participate, your credentials will appear here automatically.
                </p>

                <Link
                  to="/events"
                  className="neu-border neu-press bg-black text-cream hover:bg-lime hover:text-black font-mono text-xs font-bold uppercase py-4 px-8 inline-flex items-center gap-2 transition-colors cursor-pointer mb-8"
                >
                  Browse Events <ArrowRight className="h-4 w-4" />
                </Link>

                <div className="w-full border-t-2 border-black border-dashed my-8" />

                <div className="grid w-full gap-6 md:grid-cols-3 text-left">
                  <div className="neu-border bg-cream p-6 flex flex-col justify-between">
                    <div>
                      <span className="font-mono text-[10px] font-bold bg-lime px-2 py-1 neu-border inline-block mb-4">
                        STEP 01
                      </span>
                      <h3 className="font-display text-xl font-bold mb-2">Explore Events</h3>
                      <p className="font-mono text-xs text-gray-600 leading-relaxed">
                        Browse active student clubs, technology communities, and upcoming workshops
                        on campus.
                      </p>
                    </div>
                  </div>

                  <div className="neu-border bg-cream p-6 flex flex-col justify-between">
                    <div>
                      <span className="font-mono text-[10px] font-bold bg-sky px-2 py-1 neu-border inline-block mb-4">
                        STEP 02
                      </span>
                      <h3 className="font-display text-xl font-bold mb-2">Attend & Check In</h3>
                      <p className="font-mono text-xs text-gray-600 leading-relaxed">
                        Join the activities, get your attendance marked by organizers, and complete
                        any required milestones.
                      </p>
                    </div>
                  </div>

                  <div className="neu-border bg-cream p-6 flex flex-col justify-between">
                    <div>
                      <span className="font-mono text-[10px] font-bold bg-lavender px-2 py-1 neu-border inline-block mb-4">
                        STEP 03
                      </span>
                      <h3 className="font-display text-xl font-bold mb-2">Claim Certificate</h3>
                      <p className="font-mono text-xs text-gray-600 leading-relaxed">
                        Receive your cryptographically signed certificate, public verification link,
                        and PDF.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {displayedCerts.map((c, index) => {
                const event = Array.isArray(c.events) ? c.events[0] : c.events;
                const club = event
                  ? Array.isArray(event.clubs)
                    ? event.clubs[0]
                    : event.clubs
                  : null;

                return (
                  <article
                    key={c.id}
                    className="neu-border neu-press bg-white p-6 flex flex-col justify-between h-full animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(index, 8) * 100}ms` }}
                  >
                    <div>
                      <div
                        className={`neu-border ${colors[index % colors.length]} mb-4 p-4 text-left`}
                      >
                        <p className="eyebrow font-bold text-xs mb-1">Certificate</p>
                        <h3 className="font-display text-xl font-bold line-clamp-2 leading-tight min-h-[3.5rem]">
                          {event?.title || "Unknown Event"}
                        </h3>
                      </div>
                      <div className="space-y-2 font-mono text-xs text-gray-700">
                        <div className="flex justify-between border-b border-black/10 pb-1">
                          <span className="font-bold uppercase text-black">Club</span>
                          <span>{club?.name || "CampusConnect"}</span>
                        </div>
                        <div className="flex justify-between border-b border-black/10 pb-1">
                          <span className="font-bold uppercase text-black">Issued</span>
                          <span>{c.issued_at ? formatDateOnly(c.issued_at, "short") : "N/A"}</span>
                        </div>
                        <div className="flex justify-between pb-1">
                          <span className="font-bold uppercase text-black">Verify ID</span>
                          <span className="truncate max-w-[120px] font-bold text-gray-500 font-mono">
                            {c.id.split("-")[0].toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedCert(c);
                            setIsDialogOpen(true);
                          }}
                          className="neu-border neu-press flex-1 bg-black text-cream hover:bg-lime hover:text-black py-2.5 font-mono text-xs font-bold uppercase transition-colors cursor-pointer"
                        >
                          View Certificate
                        </button>
                        <button
                          onClick={() => {
                            setTicketCert(c);
                            setIsTicketOpen(true);
                          }}
                          className="neu-border neu-press bg-white hover:bg-sky py-2.5 px-3 font-mono text-xs font-bold uppercase transition-colors cursor-pointer"
                          aria-label="View Ticket"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* QR Ticket Dialog */}
      <Dialog open={isTicketOpen} onOpenChange={setIsTicketOpen}>
        <DialogContent className="max-w-sm w-[95vw] bg-cream border-2 border-black rounded-none shadow-[8px_8px_0_0_rgba(0,0,0,1)] p-0 font-mono [&>button]:hidden">
          {ticketCert &&
            (() => {
              const event = Array.isArray(ticketCert.events)
                ? ticketCert.events[0]
                : ticketCert.events;
              const club = event
                ? Array.isArray(event.clubs)
                  ? event.clubs[0]
                  : event.clubs
                : null;
              const ticketUrl = ticketCert.certificate_url || window.location.href;
              return (
                <div className="flex flex-col">
                  {/* Top Bar */}
                  <div className="bg-black text-cream px-4 py-3 flex justify-between items-center border-b-2 border-black">
                    <DialogTitle className="font-mono font-bold text-xs uppercase tracking-wider text-cream">
                      Event Ticket
                    </DialogTitle>
                    <button
                      onClick={() => setIsTicketOpen(false)}
                      className="text-cream hover:text-lime transition-colors cursor-pointer"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Ticket Card */}
                  <div className="p-5 group">
                    <div className="neu-border bg-white p-5 flex flex-col gap-4 shadow-[4px_4px_0_0_var(--color-ink)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[6px_6px_0_0_var(--color-ink)]">
                      {/* Header stripe */}
                      <div className="bg-lime neu-border px-3 py-2 text-center">
                        <p className="font-mono text-[10px] font-black uppercase tracking-widest">
                          CampusConnect · Official Ticket
                        </p>
                      </div>

                      {/* QR Code */}
                      <div className="flex justify-center">
                        <div className="neu-border bg-white p-3 shadow-[3px_3px_0_0_var(--color-ink)]">
                          <QRCodeSVG
                            value={ticketUrl}
                            size={140}
                            bgColor="#ffffff"
                            fgColor="#000000"
                            level="M"
                          />
                        </div>
                      </div>

                      {/* Event details */}
                      <div className="space-y-2 text-xs border-t-2 border-dashed border-black pt-3">
                        <div className="flex justify-between">
                          <span className="font-bold uppercase text-gray-500">Event</span>
                          <span className="font-bold text-black text-right max-w-[160px] truncate">
                            {event?.title || "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold uppercase text-gray-500">Attendee</span>
                          <span className="font-bold text-black">
                            {user?.email?.split("@")[0] || "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold uppercase text-gray-500">Club</span>
                          <span className="font-bold text-black">{club?.name || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold uppercase text-gray-500">Issued</span>
                          <span className="font-bold text-black">
                            {ticketCert.issued_at
                              ? formatDateOnly(ticketCert.issued_at, "short")
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold uppercase text-gray-500">Ticket ID</span>
                          <span className="font-bold text-gray-500 font-mono">
                            {ticketCert.id.split("-")[0].toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Download Button */}
                  <div className="px-5 pb-5">
                    <button
                      onClick={() => window.open(ticketUrl, "_blank")}
                      className="neu-border neu-press w-full bg-black text-cream hover:bg-lime hover:text-black py-3 font-mono text-xs font-bold uppercase transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Download className="h-4 w-4" /> Download Ticket
                    </button>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[92vh] bg-cream border-2 border-black rounded-none shadow-[8px_8px_0_0_rgba(0,0,0,1)] p-0 font-mono flex flex-col overflow-hidden [&>button]:hidden">
          {selectedCert &&
            (() => {
              const event = Array.isArray(selectedCert.events)
                ? selectedCert.events[0]
                : selectedCert.events;
              const club = event
                ? Array.isArray(event.clubs)
                  ? event.clubs[0]
                  : event.clubs
                : null;
              return (
                <div className="flex flex-col max-h-[92vh]">
                  {/* Top Bar */}
                  <div className="bg-black text-cream p-4 flex justify-between items-center border-b-2 border-black flex-shrink-0">
                    <DialogTitle className="font-display font-bold text-sm tracking-wider uppercase text-cream">
                      Certificate Viewer
                    </DialogTitle>
                    <button
                      onClick={() => setIsDialogOpen(false)}
                      className="text-cream hover:text-lime transition-colors cursor-pointer p-1"
                      aria-label="Close dialog"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Certificate Body Container */}
                  <div className="p-6 md:p-8 overflow-y-auto flex-1">
                    <div className="neu-border bg-white p-6 md:p-8 relative overflow-hidden flex flex-col justify-between min-h-[350px] shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                      {/* Background badge decorations */}
                      <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-32 h-32 bg-lime opacity-10 rounded-full border border-dashed border-black"></div>
                      <div className="absolute left-0 bottom-0 -translate-x-8 translate-y-8 w-32 h-32 bg-peach opacity-10 rounded-full border border-dashed border-black"></div>

                      {/* Certificate Header */}
                      <div className="text-center mb-6">
                        <span className="eyebrow font-bold text-xs tracking-widest text-gray-500 bg-gray-100 px-3 py-1 border border-black inline-block">
                          CAMPUSCONNECT VERIFIED PROOF
                        </span>
                        <h1 className="font-display text-2xl md:text-3xl font-extrabold mt-4 text-black uppercase tracking-tight">
                          Certificate of Attendance
                        </h1>
                        <div className="w-12 h-1 bg-black mx-auto mt-2"></div>
                      </div>

                      {/* Recipient Details */}
                      <div className="text-center my-4">
                        <p className="font-mono text-xs uppercase text-gray-500">
                          This is proudly presented to
                        </p>
                        <p className="font-display text-xl md:text-2xl font-bold text-black border-b-2 border-black inline-block px-4 py-1 mt-1 font-serif italic">
                          {user?.email?.split("@")[0] || "Distinguished Student"}
                        </p>
                        <p className="font-mono text-xs text-gray-500 mt-2">
                          for successfully participating in and completing
                        </p>
                        <p className="font-display text-lg md:text-xl font-bold text-black bg-lime/20 px-3 py-1.5 border border-black inline-block mt-2 font-mono">
                          {event?.title || "Unknown Event"}
                        </p>
                      </div>

                      {/* Footer Details */}
                      <div className="grid grid-cols-2 gap-4 mt-8 pt-4 border-t border-dashed border-black/30 text-xs">
                        <div>
                          <p className="font-bold uppercase text-gray-500">Issued By</p>
                          <p className="font-bold text-black">{club?.name || "CampusConnect"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold uppercase text-gray-500">Date of Issue</p>
                          <p className="font-bold text-black">
                            {selectedCert.issued_at
                              ? formatDateOnly(selectedCert.issued_at, "long")
                              : "N/A"}
                          </p>
                        </div>
                      </div>

                      {/* Bottom Verification Seal */}
                      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between text-[10px] text-gray-500 font-mono pt-4 border-t border-black/10 gap-2">
                        <div>
                          <span className="font-bold uppercase">Certificate ID: </span>
                          <span className="select-all">{selectedCert.id}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-black text-cream px-2 py-0.5 border border-black font-bold uppercase text-[9px]">
                          <span>Verifiable Link Active</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="bg-cream border-t-2 border-black p-4 flex gap-4 w-full flex-shrink-0">
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(selectedCert.certificate_url);
                          toast.success("Verifiable link copied to clipboard!");
                        } catch (err) {
                          console.error("Clipboard copy failed:", err);
                        }
                      }}
                      className="neu-border neu-press flex-1 bg-white hover:bg-lime hover:text-black py-3 font-mono text-xs font-bold uppercase transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Copy className="h-4 w-4" /> Copy Verification URL
                    </button>
                    <button
                      onClick={async () => {
                        setOpeningId(selectedCert.id);
                        const minDuration = new Promise((resolve) => setTimeout(resolve, 500));
                        try {
                          await downloadCertificatePdf({
                            certificateUrl: selectedCert.certificate_url,
                            eventTitle: event?.title,
                            studentName: user?.email?.split("@")[0] || "Student",
                            issuedAt: selectedCert.issued_at,
                            certId: selectedCert.id,
                          });
                          toast.success("Certificate downloaded successfully!");
                        } catch (err) {
                          console.error("PDF download failed:", err);
                          toast.error("Failed to download certificate.");
                        } finally {
                          await minDuration;
                          setOpeningId(null);
                        }
                      }}
                      disabled={openingId === selectedCert.id}
                      className="neu-border neu-press flex-1 bg-black text-cream hover:bg-lime hover:text-black py-3 font-mono text-xs font-bold uppercase transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {openingId === selectedCert.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Downloading PDF...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" /> Download PDF
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </SiteShell>
  );
}
