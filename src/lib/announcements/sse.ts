import { toast } from "sonner";

export interface AnnouncementToastOptions {
  title: string;
  description: string;
  type: "default" | "success" | "info" | "warning" | "error";
}

export function buildAnnouncementToastOptions(rawPayload: string): AnnouncementToastOptions {
  const fallback: AnnouncementToastOptions = {
    title: "Live announcement",
    description: rawPayload.trim() || "A new campus announcement is available.",
    type: "info",
  };

  if (!rawPayload.trim()) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Record<string, unknown>;

    const title =
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim()
        : fallback.title;
    const description =
      typeof parsed.message === "string" && parsed.message.trim()
        ? parsed.message.trim()
        : typeof parsed.description === "string" && parsed.description.trim()
          ? parsed.description.trim()
          : fallback.description;
    const type =
      parsed.type === "success" || parsed.type === "warning" || parsed.type === "error"
        ? parsed.type
        : "info";

    return { title, description, type };
  } catch {
    return fallback;
  }
}

export function showAnnouncementToast(rawPayload: string) {
  const options = buildAnnouncementToastOptions(rawPayload);

  const toastOptions = {
    description: options.description,
    duration: 7000,
  } as const;

  if (options.type === "success") {
    toast.success(options.title, toastOptions);
  } else if (options.type === "warning") {
    toast.warning(options.title, toastOptions);
  } else if (options.type === "error") {
    toast.error(options.title, toastOptions);
  } else {
    toast.info(options.title, toastOptions);
  }
}
