import { useRef } from "react";
import { GripVertical, Twitter, Link2, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { SortableList } from "@/components/ui/SortableList";

const PLATFORM_META: Record<string, { label: string; icon: typeof Twitter; placeholder: string }> =
  {
    website: { label: "Website URL", icon: Globe, placeholder: "https://example.com" },
    twitter: { label: "Twitter URL", icon: Twitter, placeholder: "https://twitter.com/username" },
    instagram: {
      label: "Instagram URL",
      icon: Link2,
      placeholder: "https://instagram.com/username",
    },
  };

interface ClubSocialLinksEditorProps {
  clubId: string;
  order: string[];
  values: Record<string, string>;
  onValueChange: (platform: string, value: string) => void;
  onOrderChange: (order: string[]) => void;
}

export function ClubSocialLinksEditor({
  clubId,
  order,
  values,
  onValueChange,
  onOrderChange,
}: ClubSocialLinksEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const supabase = createClient();

  const persistOrder = (newOrder: string[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from("clubs")
        .update({ social_links_order: newOrder })
        .eq("id", clubId);
      if (error) toast.error("Failed to save link order");
    }, 500);
  };

  const handleReorder = (newOrder: string[]) => {
    onOrderChange(newOrder);
    persistOrder(newOrder);
  };

  return (
    <div className="space-y-3">
      <label className="font-mono text-sm font-bold uppercase block">Social Links</label>
      <SortableList
        ids={order}
        onReorder={handleReorder}
        renderItem={(platform, dragHandleProps) => {
          const meta = PLATFORM_META[platform];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <div className="flex items-center gap-2 neu-border p-2 bg-white dark:bg-zinc-900">
              <button
                type="button"
                aria-label={`Drag to reorder ${meta.label}`}
                className="cursor-grab active:cursor-grabbing touch-none p-1 shrink-0"
                {...dragHandleProps}
              >
                <GripVertical className="h-5 w-5 text-gray-400" />
              </button>
              <Icon className="h-4 w-4 shrink-0" />
              <input
                value={values[platform] || ""}
                onChange={(e) => onValueChange(platform, e.target.value)}
                placeholder={meta.placeholder}
                className="neu-border w-full p-2 font-mono text-sm"
              />
            </div>
          );
        }}
      />
    </div>
  );
}
