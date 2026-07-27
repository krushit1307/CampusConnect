export function parseVideoUrl(url: string): { type: "youtube" | "vimeo"; id: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch" && u.searchParams.get("v")) {
        return { type: "youtube", id: u.searchParams.get("v")! };
      }
      const match = u.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/);
      if (match && match[2]) {
        return { type: "youtube", id: match[2] };
      }
    }

    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      if (id) return { type: "youtube", id };
    }

    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      const id = parts[parts.length - 1];
      if (id && /^\d+$/.test(id)) return { type: "vimeo", id };
    }

    return null;
  } catch {
    return null;
  }
}

export function getEmbedUrl(parsed: { type: "youtube" | "vimeo"; id: string }): string {
  if (parsed.type === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${parsed.id}`;
  }
  return `https://player.vimeo.com/video/${parsed.id}`;
}
