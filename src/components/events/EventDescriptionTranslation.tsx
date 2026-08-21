import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DOMPurify from "dompurify";
import Languages from "lucide-react/dist/esm/icons/languages";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface EventDescriptionTranslationProps {
  eventId: string;
  description: string;
}

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

function languageName(language: string) {
  try {
    return languageNames.of(language) ?? language.toUpperCase();
  } catch {
    return language.toUpperCase();
  }
}

/**
 * On-demand event-description translation. The Edge Function owns source text
 * and caching, so callers cannot translate arbitrary large payloads at will.
 */
export function EventDescriptionTranslation({
  eventId,
  description,
}: EventDescriptionTranslationProps) {
  const { i18n } = useTranslation();
  const supabase = createClient();
  const targetLanguage = (i18n.resolvedLanguage ?? i18n.language ?? "en").split("-")[0];
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    setTranslatedText(null);
  }, [description, eventId, targetLanguage]);

  const translate = async () => {
    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ translated_text: string }>(
        "translate-event-description",
        { body: { event_id: eventId, target_language: targetLanguage } },
      );

      if (error) throw error;
      if (!data?.translated_text) throw new Error("The translation service returned no text.");
      setTranslatedText(data.translated_text);
    } catch (error) {
      console.error("Unable to translate event description:", error);
      toast.error("Could not translate this description. Please try again shortly.");
    } finally {
      setIsTranslating(false);
    }
  };

  const showingTranslation = translatedText !== null;
  const displayedText = translatedText ?? description;
  const containsHtml = /<\/?[a-z][^>]*>/i.test(displayedText);

  return (
    <section aria-live="polite">
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {targetLanguage !== "en" && !showingTranslation && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={translate}
            disabled={isTranslating}
            className="font-mono font-bold"
          >
            <Languages className="mr-2 h-4 w-4" aria-hidden="true" />
            {isTranslating ? "Translating..." : `Translate to ${languageName(targetLanguage)}`}
          </Button>
        )}
        {showingTranslation && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTranslatedText(null)}
            className="font-mono font-bold"
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Show original English
          </Button>
        )}
        {showingTranslation && (
          <span className="font-mono text-xs text-black/60">
            Translated to {languageName(targetLanguage)}
          </span>
        )}
      </div>

      <div
        id="event-description-container"
        className="prose prose-lg mt-4 max-w-none animate-in fade-in duration-200 dark:prose-invert prose-headings:scroll-mt-24"
        key={`${eventId}-${targetLanguage}-${showingTranslation ? "translated" : "original"}`}
      >
        {containsHtml ? (
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(displayedText) }} />
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayedText}</ReactMarkdown>
        )}
      </div>
    </section>
  );
}
