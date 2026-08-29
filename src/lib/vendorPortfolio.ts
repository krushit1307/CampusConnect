export type VendorAudioProvider = "spotify" | "soundcloud";

export type VendorAudioEmbed = {
  provider: VendorAudioProvider;
  url: string;
  embedUrl: string;
  title?: string;
};

export type VendorGalleryImage = {
  url: string;
  alt: string;
  caption?: string;
};

export type VendorPortfolio = {
  tagline: string;
  specialties: string[];
  audio_embeds: VendorAudioEmbed[];
  gallery: VendorGalleryImage[];
};

export const MAX_VENDOR_AUDIO_EMBEDS = 3;
export const MAX_VENDOR_GALLERY_IMAGES = 10;

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function toVendorAudioEmbedUrl(
  value: string,
): { provider: VendorAudioProvider; embedUrl: string } | null {
  const url = safeUrl(value.trim());
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "open.spotify.com") {
    const match = url.pathname.match(/^\/(track|album|playlist|episode|show)\/([A-Za-z0-9]+)$/);
    if (!match) return null;
    return {
      provider: "spotify",
      embedUrl: `https://open.spotify.com/embed/${match[1]}/${match[2]}`,
    };
  }

  if (host === "soundcloud.com" || host === "on.soundcloud.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    if (host === "soundcloud.com" && segments.length >= 2) {
      return {
        provider: "soundcloud",
        embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.toString())}`,
      };
    }
  }
  return null;
}

export function emptyVendorPortfolio(): VendorPortfolio {
  return { tagline: "", specialties: [], audio_embeds: [], gallery: [] };
}

export function normalizeVendorPortfolio(value: unknown): VendorPortfolio {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const audioEmbeds = Array.isArray(input.audio_embeds)
    ? input.audio_embeds
        .map((item): VendorAudioEmbed | null => {
          if (!item || typeof item !== "object") return null;
          const candidate = item as Record<string, unknown>;
          if (
            (candidate.provider !== "spotify" && candidate.provider !== "soundcloud") ||
            typeof candidate.url !== "string"
          ) {
            return null;
          }
          const normalized = toVendorAudioEmbedUrl(candidate.url);
          if (!normalized || normalized.provider !== candidate.provider) return null;
          return {
            provider: normalized.provider,
            url: candidate.url,
            embedUrl: normalized.embedUrl,
            ...(typeof candidate.title === "string" && candidate.title.trim()
              ? { title: candidate.title.slice(0, 120) }
              : {}),
          };
        })
        .filter((item): item is VendorAudioEmbed => item !== null)
        .slice(0, MAX_VENDOR_AUDIO_EMBEDS)
    : [];
  const gallery = Array.isArray(input.gallery)
    ? input.gallery
        .filter((item): item is VendorGalleryImage => {
          if (!item || typeof item !== "object") return false;
          const candidate = item as Record<string, unknown>;
          return (
            typeof candidate.url === "string" &&
            candidate.url.startsWith("https://") &&
            typeof candidate.alt === "string"
          );
        })
        .slice(0, MAX_VENDOR_GALLERY_IMAGES)
    : [];
  const specialties = Array.isArray(input.specialties)
    ? input.specialties
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 8)
    : [];
  return {
    tagline: typeof input.tagline === "string" ? input.tagline.slice(0, 160) : "",
    specialties,
    audio_embeds: audioEmbeds,
    gallery,
  };
}
