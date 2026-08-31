/**
 * Hardware closed captions (#4731).
 *
 * Deepgram WebSocket transcript chunks are encoded as CEA-608/708 and POSTed
 * to the university hardware encoder (Blackmagic Web Presenter or AWS MediaLive)
 * so captions are burned into the H.264/RTMP feed for Cable TV, Twitch, and
 * CampusConnect.
 */

export const HARDWARE_ENCODER_TYPES = [
  "blackmagic_web_presenter",
  "aws_medialive",
] as const;

export type HardwareEncoderType = (typeof HARDWARE_ENCODER_TYPES)[number];

export const HARDWARE_ENCODER_LABELS: Record<HardwareEncoderType, string> = {
  blackmagic_web_presenter: "Blackmagic Web Presenter",
  aws_medialive: "AWS MediaLive",
};

export type HardwareEncoderConfig = {
  encoder_type: HardwareEncoderType;
  rest_base_url: string;
  rtmp_url?: string | null;
  channel_id?: string | null;
  api_token?: string | null;
};

export type DeepgramTranscriptChunk = {
  text: string;
  isFinal: boolean;
};

export type Cea608Pair = [number, number];

export type HardwareCaptionRequest = {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: {
    format: "cea-608";
    cea608: string;
    cea708: string;
    rtmpUrl: string | null;
    service: "CC1";
    destination: "H.264/RTMP";
    isFinal: boolean;
    text: string;
  };
};

export function isHardwareEncoderType(value: string | null | undefined): value is HardwareEncoderType {
  return HARDWARE_ENCODER_TYPES.includes(value as HardwareEncoderType);
}

export function identifyHardwareEncoder(
  type: string | null | undefined,
): HardwareEncoderType | null {
  if (isHardwareEncoderType(type)) return type;
  return null;
}

/** Pull the live transcript string out of a Deepgram listen WebSocket payload. */
export function extractDeepgramTranscript(chunk: unknown): DeepgramTranscriptChunk | null {
  if (!chunk || typeof chunk !== "object") return null;
  const data = chunk as {
    is_final?: boolean;
    channel?: { alternatives?: Array<{ transcript?: string }> };
  };
  const text = data.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
  if (!text) return null;
  return { text, isFinal: Boolean(data.is_final) };
}

/** CEA-608 bytes use odd parity on bit 7. */
export function oddParityByte(value: number): number {
  const low = value & 0x7f;
  let ones = 0;
  for (let bit = 0; bit < 7; bit += 1) {
    if (low & (1 << bit)) ones += 1;
  }
  return ones % 2 === 0 ? low | 0x80 : low;
}

function pair(a: number, b: number): Cea608Pair {
  return [oddParityByte(a), oddParityByte(b)];
}

/** CC1 pop-on / paint-on control codes (pre-parity). */
export const CEA608_CC1 = {
  RCL: [0x14, 0x20] as const,
  ENM: [0x14, 0x2e] as const,
  EOC: [0x14, 0x2f] as const,
  RDC: [0x14, 0x29] as const,
  PAC_ROW_15: [0x14, 0x60] as const,
};

function ascii608Char(char: string): number {
  const code = char.charCodeAt(0);
  if (code >= 0x20 && code <= 0x7f) return code;
  return 0x20;
}

function textPairs(text: string): Cea608Pair[] {
  const normalized = text.replace(/\s+/g, " ").trim().slice(0, 32 * 4);
  const pairs: Cea608Pair[] = [];
  for (let i = 0; i < normalized.length; i += 2) {
    const a = ascii608Char(normalized[i]);
    const b = i + 1 < normalized.length ? ascii608Char(normalized[i + 1]) : 0x00;
    pairs.push(pair(a, b));
  }
  return pairs;
}

export function encodeCea608Caption(text: string, isFinal = true): Cea608Pair[] {
  const controls = isFinal
    ? [CEA608_CC1.RCL, CEA608_CC1.ENM, CEA608_CC1.PAC_ROW_15]
    : [CEA608_CC1.RDC, CEA608_CC1.PAC_ROW_15];
  const encoded = controls.map(([a, b]) => pair(a, b));
  encoded.push(...textPairs(text));
  if (isFinal) encoded.push(pair(CEA608_CC1.EOC[0], CEA608_CC1.EOC[1]));
  return encoded;
}

export function cea608ToHex(pairs: ReadonlyArray<Cea608Pair>): string {
  return pairs.map(([a, b]) => `${a.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`).join("");
}

/**
 * Wrap CEA-608 field-1 pairs as CEA-708 cc_data (cc_type 0 = NTSC field 1).
 * Cable plants that only parse 708 still see the 608 service.
 */
export function wrapCea608InCea708(pairs: ReadonlyArray<Cea608Pair>): string {
  return pairs.map(([a, b]) => `80${a.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`).join("");
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function buildHardwareCaptionRequest(
  encoder: HardwareEncoderConfig,
  chunk: DeepgramTranscriptChunk,
): HardwareCaptionRequest {
  const pairs = encodeCea608Caption(chunk.text, chunk.isFinal);
  const cea608 = cea608ToHex(pairs);
  const cea708 = wrapCea608InCea708(pairs);
  const base = trimSlash(encoder.rest_base_url);
  const url =
    encoder.encoder_type === "aws_medialive"
      ? `${base}/prod/channels/${encoder.channel_id || "default"}/captions`
      : `${base}/api/captions`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (encoder.api_token) headers.Authorization = `Bearer ${encoder.api_token}`;

  return {
    url,
    method: "POST",
    headers,
    body: {
      format: "cea-608",
      cea608,
      cea708,
      rtmpUrl: encoder.rtmp_url || null,
      service: "CC1",
      destination: "H.264/RTMP",
      isFinal: chunk.isFinal,
      text: chunk.text,
    },
  };
}

export async function injectHardwareCaptions(
  encoder: HardwareEncoderConfig,
  deepgramPayload: unknown,
  postJson: (
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ) => Promise<{ ok: boolean; status: number }> = defaultPostJson,
): Promise<{ injected: boolean; url?: string; reason?: string }> {
  if (!identifyHardwareEncoder(encoder.encoder_type)) {
    return { injected: false, reason: "unknown_encoder" };
  }
  if (!encoder.rest_base_url?.trim()) {
    return { injected: false, reason: "missing_rest_url" };
  }
  if (encoder.encoder_type === "aws_medialive" && !encoder.channel_id?.trim()) {
    return { injected: false, reason: "missing_channel_id" };
  }

  const chunk = extractDeepgramTranscript(deepgramPayload);
  if (!chunk) return { injected: false, reason: "empty_transcript" };

  const request = buildHardwareCaptionRequest(encoder, chunk);
  const result = await postJson(request.url, request.body, request.headers);
  if (!result.ok) return { injected: false, url: request.url, reason: `http_${result.status}` };
  return { injected: true, url: request.url };
}

async function defaultPostJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<{ ok: boolean; status: number }> {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { ok: response.ok, status: response.status };
}
