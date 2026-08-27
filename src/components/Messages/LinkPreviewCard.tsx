import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";

interface LinkPreviewMetadata {
  url: string;
  title?: string;
  description?: string;
  image?: string;
}

export default function LinkPreviewCard({ url }: { url: string }) {
  const supabase = createClient();

  const { data, isLoading, isError } = useQuery<LinkPreviewMetadata | null>({
    queryKey: ["link_preview", url],
    queryFn: async () => {
      try {
        const { data: resData, error } = await supabase.functions.invoke("link-preview", {
          body: { url },
        });

        if (error || !resData) {
          console.error("Link preview error:", error);
          return null;
        }

        return resData as LinkPreviewMetadata;
      } catch (err) {
        console.error("Failed to invoke link-preview function:", err);
        return null;
      }
    },
    staleTime: 1000 * 60 * 30, // cache for 30 minutes
  });

  if (isLoading) {
    return (
      <div className="mt-2 flex h-24 w-full animate-pulse border-2 border-black bg-white p-2 text-black dark:border-cream dark:bg-zinc-900">
        <div className="mr-3 h-full w-20 bg-gray-200 dark:bg-zinc-800" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-gray-200 dark:bg-zinc-800 w-3/4" />
          <div className="h-3 bg-gray-200 dark:bg-zinc-800 w-5/6" />
          <div className="h-3 bg-gray-200 dark:bg-zinc-800 w-1/2" />
        </div>
      </div>
    );
  }

  if (isError || !data || (!data.title && !data.description)) {
    return null;
  }

  // Extract hostname for cleaner display (e.g., "youtube.com")
  let hostname = "";
  try {
    hostname = new URL(data.url).hostname.replace("www.", "");
  } catch {
    hostname = "External Link";
  }

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block border-2 border-black bg-white p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-cream transition-all duration-200 dark:border-cream dark:bg-zinc-900 dark:text-cream dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.15)] dark:hover:bg-zinc-800"
    >
      <div className="flex gap-3">
        {data.image && (
          <div className="relative h-20 w-20 shrink-0 border-2 border-black dark:border-cream bg-gray-100 overflow-hidden">
            <img
              src={data.image}
              alt={data.title || "Preview thumbnail"}
              className="h-full w-full object-cover"
              onError={(e) => {
                // If image fails to load, hide container
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>
        )}
        <div className="flex flex-col min-w-0 justify-center">
          <span className="font-mono text-[9px] uppercase tracking-wider text-gray-500 flex items-center gap-1">
            {hostname}
            <ExternalLink size={8} />
          </span>
          {data.title && (
            <h4 className="font-sans text-xs font-bold leading-tight line-clamp-1 mt-0.5 text-black dark:text-cream">
              {data.title}
            </h4>
          )}
          {data.description && (
            <p className="font-sans text-[11px] text-gray-600 dark:text-gray-400 leading-snug line-clamp-2 mt-1">
              {data.description}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}
