import { useEffect, useState } from "react";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import { createClient } from "@/lib/supabase/client";

interface RichLinkCardProps {
  url: string;
}

interface Metadata {
  title: string;
  description: string;
  image: string;
  url: string;
}

export default function RichLinkCard({ url }: RichLinkCardProps) {
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("extract-metadata", {
          body: { url },
        });
        if (error) throw error;
        setMetadata(data);
      } catch (err) {
        console.error("Failed to fetch link metadata:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetadata();
  }, [url, supabase]);

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-200 h-24 w-full max-w-sm mt-2 rounded border-2 border-black" />
    );
  }

  if (!metadata || !metadata.title) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline break-all"
      >
        {url}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block max-w-sm overflow-hidden border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-900 dark:border-cream dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]"
    >
      {metadata.image && (
        <div className="h-32 w-full overflow-hidden border-b-2 border-black dark:border-cream">
          <img src={metadata.image} alt={metadata.title} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="p-3">
        <h4 className="font-display text-sm font-bold leading-tight text-black dark:text-cream line-clamp-1">
          {metadata.title}
        </h4>
        {metadata.description && (
          <p className="mt-1 font-mono text-[10px] text-gray-600 dark:text-gray-400 line-clamp-2">
            {metadata.description}
          </p>
        )}
        <div className="mt-2 flex items-center gap-1 font-mono text-[9px] uppercase text-gray-500">
          <ExternalLink size={10} />
          {new URL(url).hostname}
        </div>
      </div>
    </a>
  );
}
