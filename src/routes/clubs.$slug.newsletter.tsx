import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Mail, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { NewsletterEditor } from "@/components/Editor/NewsletterEditor";
import { NewsletterService } from "@/services/newsletterService";
import type { NewsletterDesign } from "@/types/newsletter";

/**
 * Admin UI for #3896: one click compiles the club's upcoming events (next
 * 14 days) and recent event photos into a ready-to-send newsletter draft.
 */
export default function ClubNewsletterRoute() {
  const { slug = "" } = useParams();
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<{
    title: string;
    subject: string;
    design: NewsletterDesign;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("clubs")
      .select("id, name")
      .eq("slug", slug)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setClubId(data.id);
        setClubName(data.name);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleGenerate = async () => {
    if (!clubId) return;
    setGenerating(true);
    try {
      const result = await NewsletterService.generateWeeklyNewsletter(clubId, clubName);
      setGenerated({ title: result.title, subject: result.subject, design: result.design });
      toast.success("Newsletter generated - review the preview below before sending.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate the newsletter");
    } finally {
      setGenerating(false);
    }
  };

  if (!clubId) {
    return <div className="mx-auto max-w-4xl px-4 py-8 font-mono text-sm">Loading club...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        to={`/clubs/${slug}/manage`}
        className="mb-4 inline-flex items-center gap-1 font-mono text-xs uppercase text-gray-600 hover:text-black"
      >
        <ChevronLeft className="h-4 w-4" /> Back to club management
      </Link>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Mail className="h-6 w-6" /> Weekly Newsletter
        </h1>
        <p className="font-mono text-sm text-gray-600">
          {clubName} — compile upcoming events and recent photos into an email in one click.
        </p>
      </header>

      {!generated ? (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="neu-border flex items-center gap-2 bg-lime px-4 py-3 font-bold uppercase hover:bg-peach disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate Weekly Newsletter
        </button>
      ) : (
        <NewsletterEditor
          clubId={clubId}
          initialTitle={generated.title}
          initialSubject={generated.subject}
          initialDesign={generated.design}
          onSaved={() => setGenerated(null)}
          onCancel={() => setGenerated(null)}
        />
      )}
    </div>
  );
}
