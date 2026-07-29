import { useRef, useState, useEffect } from "react";
import { parseVideoUrl, getEmbedUrl } from "@/utils/videoEmbed";

interface VideoEmbedProps {
  url: string;
}

export function VideoEmbed({ url }: VideoEmbedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const parsed = parseVideoUrl(url);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!parsed) return null;

  const embedUrl = getEmbedUrl(parsed);

  return (
    <div
      ref={ref}
      className="relative mt-3 mb-3 w-full aspect-video bg-black neu-border overflow-hidden"
    >
      {visible ? (
        <iframe
          src={embedUrl}
          title="Embedded video"
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-white font-mono text-xs">
          Loading video...
        </div>
      )}
    </div>
  );
}
