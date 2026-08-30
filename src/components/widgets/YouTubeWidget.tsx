import { PlaySquare } from "lucide-react";
import { WidgetShell } from "./WidgetShell";

export interface YouTubeWidgetProps {
  params: Record<string, unknown>;
}

function strParam(params: Record<string, unknown>, key: string): string {
  return typeof params[key] === "string" ? (params[key] as string) : "";
}

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Validates the 11-character YouTube video id and builds a
 * youtube-nocookie embed URL (privacy-enhanced mode).
 */
export function toYouTubeEmbedUrl(rawVideoId: string): string | null {
  const videoId = rawVideoId.trim();
  if (!YOUTUBE_ID_RE.test(videoId)) return null;
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

const YOUTUBE_SANDBOX = "allow-scripts allow-same-origin allow-presentation";

/** YouTube embed widget rendered in a sandboxed iframe. */
export function YouTubeWidget({ params }: YouTubeWidgetProps) {
  const embedUrl = toYouTubeEmbedUrl(strParam(params, "videoId"));

  if (!embedUrl) {
    return (
      <WidgetShell title="YouTube" icon={<PlaySquare size={16} aria-hidden="true" />}>
        <p className="font-mono text-xs text-gray-500">
          Add an 11-character video ID to embed a video.
        </p>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell title="YouTube" icon={<PlaySquare size={16} aria-hidden="true" />}>
      <div className="aspect-video w-full overflow-hidden">
        <iframe
          src={embedUrl}
          title="YouTube Video"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox={YOUTUBE_SANDBOX}
          className="h-full w-full border-0"
        />
      </div>
    </WidgetShell>
  );
}

export default YouTubeWidget;
