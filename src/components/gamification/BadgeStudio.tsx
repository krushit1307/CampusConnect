// =============================================================================
// Component: BadgeStudio
// Issue: #3171 - Develop a 'Custom Interactive Badges' Editor
// Description: Visual editor for the Student Union to assemble new SVG
// badges from a library of shapes, gradient colors, and icons, plus an
// optional text ribbon - then publish them dynamically without a code
// deployment. Composition is serialized as whitelisted JSON, never raw SVG.
// =============================================================================

import { useState } from "react";
import { toast } from "sonner";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { useGamificationBadges } from "@/hooks/useGamificationBadges";
import {
  BADGE_SHAPES,
  BADGE_ICONS,
  DEFAULT_BADGE_COMPOSITION,
  BadgeComposition,
} from "@/lib/gamification/badgeComposer";
import { DynamicBadge } from "@/lib/gamification/DynamicBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BadgeStudio() {
  const { badges, isLoading, createBadge, togglePublish, deleteBadge } = useGamificationBadges();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [composition, setComposition] = useState<BadgeComposition>(DEFAULT_BADGE_COMPOSITION);

  const updateComposition = (changes: Partial<BadgeComposition>) => {
    setComposition({ ...composition, ...changes });
  };

  const handlePublish = () => {
    if (!title.trim()) {
      toast.error("Please give the badge a title.");
      return;
    }

    createBadge.mutate(
      { title: title.trim(), description: description.trim(), svg_payload_json: composition },
      {
        onSuccess: () => {
          toast.success("Badge published!");
          setTitle("");
          setDescription("");
          setComposition(DEFAULT_BADGE_COMPOSITION);
        },
        onError: (err: Error) => toast.error(`Failed to save badge: ${err.message}`),
      },
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-4">
        <h2 className="font-display text-2xl font-bold">Badge Studio</h2>

        <Input
          placeholder="Badge title (e.g. Campus Legend)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          placeholder="Short description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div>
          <p className="text-sm font-bold uppercase mb-2">Shape</p>
          <div className="flex gap-2">
            {BADGE_SHAPES.map((shape) => (
              <button
                key={shape}
                onClick={() => updateComposition({ shape })}
                className={`px-3 py-2 border-2 border-black text-sm font-mono uppercase ${
                  composition.shape === shape ? "bg-black text-white" : "bg-white"
                }`}
              >
                {shape}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-bold uppercase mb-2">Icon</p>
          <div className="flex flex-wrap gap-2">
            {BADGE_ICONS.map((icon) => (
              <button
                key={icon}
                onClick={() => updateComposition({ icon })}
                className={`px-3 py-2 border-2 border-black text-sm font-mono uppercase ${
                  composition.icon === icon ? "bg-black text-white" : "bg-white"
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <label className="flex-1 text-sm font-bold uppercase">
            Gradient From
            <input
              type="color"
              value={composition.gradientFrom}
              onChange={(e) => updateComposition({ gradientFrom: e.target.value })}
              className="w-full h-10 border-2 border-black mt-1"
            />
          </label>
          <label className="flex-1 text-sm font-bold uppercase">
            Gradient To
            <input
              type="color"
              value={composition.gradientTo}
              onChange={(e) => updateComposition({ gradientTo: e.target.value })}
              className="w-full h-10 border-2 border-black mt-1"
            />
          </label>
        </div>

        <Input
          placeholder="Ribbon text (optional, e.g. 2026)"
          value={composition.ribbonText}
          maxLength={24}
          onChange={(e) => updateComposition({ ribbonText: e.target.value })}
        />

        <Button onClick={handlePublish} disabled={createBadge.isPending}>
          Publish Badge
        </Button>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center border-2 border-black p-8 bg-gray-50">
          <DynamicBadge payload={composition} title={title || "Preview"} size={140} />
          <p className="mt-4 font-mono text-sm font-bold">{title || "Untitled Badge"}</p>
        </div>

        <div>
          <h3 className="font-bold uppercase text-sm mb-2">Existing Badges</h3>
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="border-2 border-black p-3 flex flex-col items-center gap-2"
                >
                  <DynamicBadge payload={badge.svg_payload_json} title={badge.title} size={64} />
                  <p className="text-xs font-bold text-center">{badge.title}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        togglePublish.mutate({ id: badge.id, isPublished: !badge.is_published })
                      }
                    >
                      {badge.is_published ? "Unpublish" : "Publish"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteBadge.mutate(badge.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
