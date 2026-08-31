import { Music2 } from "lucide-react";
import { WidgetShell } from "./WidgetShell";

export interface SpotifyWidgetProps {
  params: Record<string, unknown>;
}

function strParam(params: Record<string, unknown>, key: string): string {
  return typeof params[key] === "string" ? (params[key] as string) : "";
}

const SPOTIFY_ORIGIN = "https://open.spotify.com";

/**
 * Accepts either an embed URL or a normal open.spotify.com link and
 * normalizes it to an embed URL. Returns null for anything outside the
 * Spotify origin so we never render arbitrary third-party content.
 */
export function toSpotifyEmbedUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (parsed.origin !== SPOTIFY_ORIGIN) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  const [kind, id] = segments;
  if (!kind || !id) return null;

  const embed = new URL(`https://open.spotify.com/embed/${kind}/${id}`);
  const theme = parsed.searchParams.get("theme");
  if (theme) embed.searchParams.set("theme", theme);
  return embed.toString();
}

const SPOTIFY_SANDBOX =
  "allow-scripts allow-same-origin allow-popups allow-forms allow-presentation";

/** Spotify embed widget rendered in a sandboxed iframe. */
export function SpotifyWidget({ params }: SpotifyWidgetProps) {
  const embedUrl = toSpotifyEmbedUrl(strParam(params, "url"));

  if (!embedUrl) {
    return (
      <WidgetShell title="Spotify" icon={<Music2 size={16} aria-hidden="true" />}>
        <p className="font-mono text-xs text-gray-500">
          Add a valid open.spotify.com link to show a playlist.
        </p>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell title="Spotify" icon={<Music2 size={16} aria-hidden="true" />}>
      <div className="aspect-video w-full overflow-hidden">
        <iframe
          src={embedUrl}
          title="Spotify Embed"
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowTransparency
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox={SPOTIFY_SANDBOX}
          className="h-full w-full border-0"
        />
      </div>
    </WidgetShell>
  );
}

export default SpotifyWidget;
