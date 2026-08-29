import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Search from "lucide-react/dist/esm/icons/search";
import Download from "lucide-react/dist/esm/icons/download";
import FileText from "lucide-react/dist/esm/icons/file-text";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { supabase } from "../lib/supabase/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { SponsorBountyAnalytics } from "../components/events/SponsorBountyAnalytics";

interface Attendee {
  id: string;
  first_name: string;
  last_name: string;
  major?: string;
  graduation_year?: string;
  resume_path: string;
}

export default function SponsorEventPortal() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [majorFilter, setMajorFilter] = useState("");
  const [gradYearFilter, setGradYearFilter] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!eventId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          setError("You must be logged in as a sponsor.");
          setLoading(false);
          return;
        }

        // Check event access
        const { data: event, error: eventError } = await supabase
          .from("events")
          .select("title, created_by")
          .eq("id", eventId)
          .single();

        if (eventError || !event) throw new Error("Event not found");
        setEventTitle(event.title);

        // Fetch attendees with resumes
        const { data: rsvps, error: rsvpsError } = await supabase
          .from("event_rsvps")
          .select(
            `
            resume_path,
            profiles (
              id,
              first_name,
              last_name,
              major,
              graduation_year
            )
          `,
          )
          .eq("event_id", eventId)
          .eq("status", "attending")
          .not("resume_path", "is", null);

        if (rsvpsError) throw rsvpsError;

        const formattedAttendees = (rsvps || []).map((rsvp: any) => ({
          id: rsvp.profiles?.id || Math.random().toString(),
          first_name: rsvp.profiles?.first_name || "Unknown",
          last_name: rsvp.profiles?.last_name || "User",
          major: rsvp.profiles?.major || "",
          graduation_year: rsvp.profiles?.graduation_year?.toString() || "",
          resume_path: rsvp.resume_path,
        }));

        setAttendees(formattedAttendees);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load sponsor portal data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId]);

  const handleDownloadAll = async () => {
    if (!eventId) return;
    setDownloadingZip(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "http://localhost:54321"}/functions/v1/bulk-download-resumes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({ eventId }),
        },
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to download resumes");
      }

      // Convert to blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;

      // Get filename from header or fallback
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "resumes.zip";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setDownloadingZip(false);
    }
  };

  const previewResume = async (path: string) => {
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const { data, error } = await supabase.storage.from("resumes").createSignedUrl(path, 300);

      if (error) throw error;
      setPreviewUrl(data.signedUrl);
    } catch (err: any) {
      console.error(err);
      alert("Failed to preview resume");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Extract unique majors and grad years for filtering
  const majors = Array.from(new Set(attendees.map((a) => a.major).filter(Boolean)));
  const gradYears = Array.from(
    new Set(attendees.map((a) => a.graduation_year).filter(Boolean)),
  ).sort();

  const filteredAttendees = attendees.filter((a) => {
    const matchesSearch = `${a.first_name} ${a.last_name}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesMajor = majorFilter ? a.major === majorFilter : true;
    const matchesGradYear = gradYearFilter ? a.graduation_year === gradYearFilter : true;
    return matchesSearch && matchesMajor && matchesGradYear;
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800 border border-red-200">
          <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
          <p>{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sponsor Portal</h1>
          <p className="text-slate-500 text-lg">{eventTitle}</p>
        </div>
        <Button
          onClick={handleDownloadAll}
          disabled={downloadingZip}
          size="lg"
          className="gap-2 shrink-0"
        >
          {downloadingZip ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Download All Resumes
        </Button>
      </div>

      <Tabs defaultValue="attendees" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="attendees">Attendees & Resumes</TabsTrigger>
          <TabsTrigger value="analytics">Bounty Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="attendees">
          <div className="bg-white dark:bg-slate-900 border rounded-lg shadow-sm mb-8">
            <div className="p-4 border-b flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search attendees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-4">
                <select
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={majorFilter}
                  onChange={(e) => setMajorFilter(e.target.value)}
                >
                  <option value="">All Majors</option>
                  {majors.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={gradYearFilter}
                  onChange={(e) => setGradYearFilter(e.target.value)}
                >
                  <option value="">All Years</option>
                  {gradYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Student Name</th>
                    <th className="px-6 py-4 font-semibold">Major</th>
                    <th className="px-6 py-4 font-semibold">Grad Year</th>
                    <th className="px-6 py-4 font-semibold text-right">Resume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredAttendees.length > 0 ? (
                    filteredAttendees.map((attendee) => (
                      <tr
                        key={attendee.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="px-6 py-4 font-medium">
                          {attendee.first_name} {attendee.last_name}
                        </td>
                        <td className="px-6 py-4">{attendee.major || "—"}</td>
                        <td className="px-6 py-4">{attendee.graduation_year || "—"}</td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => previewResume(attendee.resume_path)}
                            className="gap-2"
                          >
                            <FileText className="w-4 h-4" />
                            Preview
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                        No attendees found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <SponsorBountyAnalytics eventId={eventId || ""} />
        </TabsContent>
      </Tabs>

      {previewLoading && (
        <div className="flex items-center justify-center p-12 border rounded-lg border-dashed">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {previewUrl && !previewLoading && (
        <div className="mt-8 border rounded-lg overflow-hidden h-[800px] shadow-sm flex flex-col">
          <div className="bg-slate-100 dark:bg-slate-800 p-2 border-b flex justify-between items-center">
            <span className="font-semibold text-sm px-2">Resume Preview</span>
            <Button variant="ghost" size="sm" onClick={() => setPreviewUrl(null)}>
              Close Preview
            </Button>
          </div>
          <iframe src={previewUrl} className="w-full flex-1" title="Resume Preview" />
        </div>
      )}
    </div>
  );
}
