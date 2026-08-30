import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  HARDWARE_ENCODER_LABELS,
  HARDWARE_ENCODER_TYPES,
  identifyHardwareEncoder,
  type HardwareEncoderType,
} from "@/lib/hardwareClosedCaptions";

export function HardwareCaptionEncoderPanel({ eventId }: { eventId: string }) {
  const [supabase] = useState(() => createClient());
  const [encoderType, setEncoderType] = useState<HardwareEncoderType>("blackmagic_web_presenter");
  const [restBaseUrl, setRestBaseUrl] = useState("");
  const [rtmpUrl, setRtmpUrl] = useState("");
  const [channelId, setChannelId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("event_hardware_encoders")
        .select("encoder_type, rest_base_url, rtmp_url, channel_id")
        .eq("event_id", eventId)
        .maybeSingle();
      if (cancelled || !data) return;
      const identified = identifyHardwareEncoder(data.encoder_type);
      if (identified) setEncoderType(identified);
      setRestBaseUrl(data.rest_base_url || "");
      setRtmpUrl(data.rtmp_url || "");
      setChannelId(data.channel_id || "");
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, supabase]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.rpc("upsert_event_hardware_encoder", {
      p_event_id: eventId,
      p_encoder_type: encoderType,
      p_rest_base_url: restBaseUrl.trim(),
      p_rtmp_url: rtmpUrl.trim() || null,
      p_channel_id: channelId.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Failed to save hardware encoder");
      return;
    }
    toast.success("Hardware encoder identified. Deepgram captions will be burned into the RTMP feed.");
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4"
      data-testid="hardware-caption-encoder-panel"
    >
      <h3 className="text-sm font-semibold text-white">Hardware closed captions</h3>
      <p className="font-mono text-[11px] text-white/65">
        Identify the university encoder so Deepgram text is injected as CEA-608/708 into the
        H.264/RTMP stream for Cable TV.
      </p>
      <label className="block font-mono text-[10px] font-bold uppercase text-white/80">
        Encoder
        <select
          value={encoderType}
          onChange={(e) => setEncoderType(e.target.value as HardwareEncoderType)}
          className="mt-1 w-full rounded border border-white/20 bg-black px-2 py-1 text-xs text-white"
        >
          {HARDWARE_ENCODER_TYPES.map((type) => (
            <option key={type} value={type}>
              {HARDWARE_ENCODER_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      <label className="block font-mono text-[10px] font-bold uppercase text-white/80">
        REST API URL
        <input
          required
          value={restBaseUrl}
          onChange={(e) => setRestBaseUrl(e.target.value)}
          placeholder="https://presenter.campus.edu"
          className="mt-1 w-full rounded border border-white/20 bg-black px-2 py-1 text-xs text-white"
        />
      </label>
      <label className="block font-mono text-[10px] font-bold uppercase text-white/80">
        RTMP URL
        <input
          value={rtmpUrl}
          onChange={(e) => setRtmpUrl(e.target.value)}
          placeholder="rtmp://cable.campus.edu/live/event"
          className="mt-1 w-full rounded border border-white/20 bg-black px-2 py-1 text-xs text-white"
        />
      </label>
      {encoderType === "aws_medialive" && (
        <label className="block font-mono text-[10px] font-bold uppercase text-white/80">
          MediaLive channel id
          <input
            required
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="mt-1 w-full rounded border border-white/20 bg-black px-2 py-1 text-xs text-white"
          />
        </label>
      )}
      <button
        type="submit"
        disabled={saving}
        className="rounded border border-white bg-white px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-black disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save encoder"}
      </button>
    </form>
  );
}
