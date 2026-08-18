import { useState } from "react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveAs } from "file-saver";

interface EventPollsExportSectionProps {
  eventId: string;
}

export function EventPollsExportSection({ eventId }: EventPollsExportSectionProps) {
  const supabase = createClient();
  const [exportingPollId, setExportingPollId] = useState<string | null>(null);

  const { data: polls, isLoading } = useQuery({
    queryKey: ["event_polls", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("polls")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!eventId,
  });

  const exportPollResults = async (pollId: string, format: "pdf" | "csv", question: string) => {
    try {
      setExportingPollId(`${pollId}-${format}`);
      const { data, error } = await supabase.functions.invoke("export_poll_results", {
        body: { pollId, format },
      });

      if (error) throw new Error(error.message);

      // The response is a blob because of our Edge Function.
      // Wait, `supabase.functions.invoke` parses JSON by default if the response is JSON.
      // We should use fetch directly or specify responseType.
      // Let's use `supabase.auth.getSession` and standard `fetch`.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export_poll_results`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ pollId, format }),
        },
      );

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Failed to export: ${res.statusText} - ${errBody}`);
      }

      const blob = await res.blob();
      const safeName = question.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      saveAs(blob, `poll-results-${safeName}.${format}`);
      toast.success(`Successfully exported poll as ${format.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export poll results");
    } finally {
      setExportingPollId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!polls || polls.length === 0) {
    return (
      <div className="rounded-lg border-2 border-black bg-white p-8 text-center shadow-[4px_4px_0_0_#000]">
        <p className="font-mono text-sm text-gray-600">
          No polls have been created for this event yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-display text-2xl font-bold tracking-tight">Polls & Results</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {polls.map((poll) => (
          <div
            key={poll.id}
            className="flex flex-col justify-between rounded-lg border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000]"
          >
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${poll.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                >
                  {poll.is_active ? "Active" : "Closed"}
                </span>
                {poll.is_anonymous && (
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
                    Anonymous
                  </span>
                )}
              </div>
              <h4 className="mb-1 font-bold line-clamp-2">{poll.question}</h4>
              <p className="font-mono text-xs text-gray-500">
                Created: {new Date(poll.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-2 border-black bg-white hover:bg-gray-100"
                onClick={() => exportPollResults(poll.id, "pdf", poll.question)}
                disabled={exportingPollId === `${poll.id}-pdf`}
              >
                {exportingPollId === `${poll.id}-pdf` ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                PDF Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-2 border-black bg-white hover:bg-gray-100"
                onClick={() => exportPollResults(poll.id, "csv", poll.question)}
                disabled={exportingPollId === `${poll.id}-csv`}
              >
                {exportingPollId === `${poll.id}-csv` ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Raw CSV
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
