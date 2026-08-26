import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Music2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { uploadImageWithSignedUrl } from "@/lib/supabase/signedUpload";
import { createClient } from "@/lib/supabase/client";
import {
  emptyVendorPortfolio,
  MAX_VENDOR_AUDIO_EMBEDS,
  MAX_VENDOR_GALLERY_IMAGES,
  normalizeVendorPortfolio,
  toVendorAudioEmbedUrl,
  type VendorAudioEmbed,
  type VendorGalleryImage,
  type VendorPortfolio,
} from "@/lib/vendorPortfolio";

export function VendorPortfolioEditor() {
  const [supabase] = useState(() => createClient());
  const [portfolio, setPortfolio] = useState<VendorPortfolio>(emptyVendorPortfolio);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioTitle, setAudioTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("vendor_portfolio")
        .eq("id", user.id)
        .maybeSingle();
      if (active && data)
        setPortfolio(
          normalizeVendorPortfolio((data as { vendor_portfolio?: unknown }).vendor_portfolio),
        );
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  const addAudioEmbed = () => {
    const embed = toVendorAudioEmbedUrl(audioUrl);
    if (!embed) {
      toast.error("Paste a valid Spotify track, album, playlist, podcast, or SoundCloud URL.");
      return;
    }
    if (portfolio.audio_embeds.length >= MAX_VENDOR_AUDIO_EMBEDS) {
      toast.error(`You can add up to ${MAX_VENDOR_AUDIO_EMBEDS} audio samples.`);
      return;
    }
    const next: VendorAudioEmbed = {
      ...embed,
      url: audioUrl.trim(),
      ...(audioTitle.trim() ? { title: audioTitle.trim().slice(0, 100) } : {}),
    };
    setPortfolio((current) => ({ ...current, audio_embeds: [...current.audio_embeds, next] }));
    setAudioUrl("");
    setAudioTitle("");
  };

  const uploadGalleryImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = MAX_VENDOR_GALLERY_IMAGES - portfolio.gallery.length;
    if (remaining <= 0) {
      toast.error(`Your gallery already has ${MAX_VENDOR_GALLERY_IMAGES} images.`);
      return;
    }
    const selected = Array.from(files)
      .slice(0, remaining)
      .filter((file) => file.type.startsWith("image/"));
    if (!selected.length) {
      toast.error("Choose image files only.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setIsUploading(true);
    try {
      const uploaded: VendorGalleryImage[] = [];
      for (const file of selected) {
        const extension =
          file.name
            .split(".")
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `vendor-portfolios/${user.id}/${crypto.randomUUID()}.${extension}`;
        const url = await uploadImageWithSignedUrl("event-galleries", path, file);
        uploaded.push({ url, alt: file.name.replace(/\.[^/.]+$/, "").slice(0, 120) });
      }
      setPortfolio((current) => ({
        ...current,
        gallery: [...current.gallery, ...uploaded].slice(0, MAX_VENDOR_GALLERY_IMAGES),
      }));
      toast.success(
        `${uploaded.length} portfolio image${uploaded.length === 1 ? "" : "s"} uploaded.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const savePortfolio = async () => {
    setIsSaving(true);
    const { error } = await supabase.rpc("save_vendor_portfolio", {
      p_portfolio: portfolio as never,
    });
    setIsSaving(false);
    if (error) {
      toast.error(error.message || "Could not save your portfolio.");
      return;
    }
    toast.success("Vendor portfolio saved.");
  };

  if (isLoading)
    return (
      <div className="flex items-center gap-2 font-mono text-xs">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading portfolio…
      </div>
    );

  return (
    <section
      className="border-2 border-black bg-purple-50 p-5 shadow-[4px_4px_0_0_#000]"
      aria-labelledby="vendor-portfolio-editor-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-purple-800">
            <Music2 className="h-4 w-4" /> Student vendor profile
          </p>
          <h2
            id="vendor-portfolio-editor-title"
            className="mt-1 font-display text-2xl font-black uppercase"
          >
            Your portfolio
          </h2>
          <p className="mt-2 max-w-2xl font-mono text-xs text-black/65">
            Help organizers evaluate your work. Only add work you own or have permission to publish.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void savePortfolio()}
          disabled={isSaving || isUploading}
          className="neu-border flex items-center gap-2 bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {isSaving ? "Saving…" : "Save portfolio"}
        </button>
      </div>

      <label
        className="mt-5 block font-mono text-xs font-bold uppercase"
        htmlFor="vendor-portfolio-tagline"
      >
        Tagline
        <input
          id="vendor-portfolio-tagline"
          maxLength={160}
          value={portfolio.tagline}
          onChange={(event) =>
            setPortfolio((current) => ({ ...current, tagline: event.target.value }))
          }
          placeholder="Student DJ bringing high-energy, clean campus sets"
          className="mt-2 w-full border-2 border-black bg-white px-3 py-2 font-sans text-sm"
        />
      </label>

      <div className="mt-5 border-2 border-black bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-mono text-xs font-bold uppercase">Audio samples</h3>
          <span className="font-mono text-[10px] text-black/55">
            {portfolio.audio_embeds.length}/{MAX_VENDOR_AUDIO_EMBEDS}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            value={audioUrl}
            onChange={(event) => setAudioUrl(event.target.value)}
            placeholder="Spotify or SoundCloud URL"
            aria-label="Audio sample URL"
            className="border-2 border-black px-3 py-2 font-mono text-xs"
          />
          <input
            value={audioTitle}
            onChange={(event) => setAudioTitle(event.target.value)}
            placeholder="Sample title (optional)"
            aria-label="Audio sample title"
            className="border-2 border-black px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            onClick={addAudioEmbed}
            className="neu-border bg-yellow-300 px-3 py-2 font-mono text-xs font-bold uppercase"
          >
            Add
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {portfolio.audio_embeds.map((sample, index) => (
            <div
              key={`${sample.embedUrl}-${index}`}
              className="flex items-center justify-between gap-2 border-2 border-black bg-purple-100 px-3 py-2 font-mono text-xs"
            >
              <span className="truncate">
                {sample.title || sample.provider} · {sample.url}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPortfolio((current) => ({
                    ...current,
                    audio_embeds: current.audio_embeds.filter(
                      (_, sampleIndex) => sampleIndex !== index,
                    ),
                  }))
                }
                aria-label={`Remove ${sample.title || sample.provider}`}
                className="text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 border-2 border-black bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase">
            <ImagePlus className="h-4 w-4" /> Photography gallery
          </h3>
          <span className="font-mono text-[10px] text-black/55">
            {portfolio.gallery.length}/{MAX_VENDOR_GALLERY_IMAGES}
          </span>
        </div>
        <p className="mt-1 font-mono text-[10px] text-black/55">
          Images are uploaded to the existing private upload flow and shown only when an organizer
          opens your bid.
        </p>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 neu-border bg-lime-300 px-3 py-2 font-mono text-xs font-bold uppercase">
          <ImagePlus className="h-4 w-4" /> {isUploading ? "Uploading…" : "Add images"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            disabled={isUploading || portfolio.gallery.length >= MAX_VENDOR_GALLERY_IMAGES}
            onChange={(event) => void uploadGalleryImages(event.target.files)}
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {portfolio.gallery.map((image, index) => (
            <figure
              key={`${image.url}-${index}`}
              className="group relative aspect-square overflow-hidden border-2 border-black bg-gray-100"
            >
              <img src={image.url} alt={image.alt} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() =>
                  setPortfolio((current) => ({
                    ...current,
                    gallery: current.gallery.filter((_, imageIndex) => imageIndex !== index),
                  }))
                }
                aria-label={`Remove ${image.alt}`}
                className="absolute right-1 top-1 bg-white p-1 text-red-700 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
