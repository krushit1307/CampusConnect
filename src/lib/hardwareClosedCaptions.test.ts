import { describe, expect, it, vi } from "vitest";
import {
  CEA608_CC1,
  HARDWARE_ENCODER_TYPES,
  buildHardwareCaptionRequest,
  cea608ToHex,
  encodeCea608Caption,
  extractDeepgramTranscript,
  identifyHardwareEncoder,
  injectHardwareCaptions,
  oddParityByte,
  wrapCea608InCea708,
} from "./hardwareClosedCaptions";

const DEEPGRAM_FINAL = {
  is_final: true,
  channel: { alternatives: [{ transcript: "Welcome to campus cable" }] },
};

const blackmagic = {
  encoder_type: "blackmagic_web_presenter" as const,
  rest_base_url: "https://presenter.campus.edu",
  rtmp_url: "rtmp://cable.campus.edu/live/event",
};

const medialive = {
  encoder_type: "aws_medialive" as const,
  rest_base_url: "https://medialive.campus.edu",
  channel_id: "ch-cable-1",
  rtmp_url: "rtmp://cable.campus.edu/live/event",
  api_token: "secret-token",
};

describe("hardware CEA-608/708 captions (#4731)", () => {
  it("identifies Blackmagic Web Presenter and AWS MediaLive encoders", () => {
    expect(HARDWARE_ENCODER_TYPES).toEqual(["blackmagic_web_presenter", "aws_medialive"]);
    expect(identifyHardwareEncoder("blackmagic_web_presenter")).toBe("blackmagic_web_presenter");
    expect(identifyHardwareEncoder("aws_medialive")).toBe("aws_medialive");
    expect(identifyHardwareEncoder("obs")).toBeNull();
  });

  it("reads live WebSocket text chunks from Deepgram", () => {
    expect(extractDeepgramTranscript(DEEPGRAM_FINAL)).toEqual({
      text: "Welcome to campus cable",
      isFinal: true,
    });
    expect(
      extractDeepgramTranscript({
        is_final: false,
        channel: { alternatives: [{ transcript: "  hello  " }] },
      }),
    ).toEqual({ text: "hello", isFinal: false });
    expect(extractDeepgramTranscript({ is_final: true, channel: { alternatives: [{ transcript: "" }] } })).toBeNull();
  });

  it("encodes CEA-608 with odd parity, pop-on controls, and CEA-708 wrap", () => {
    expect(oddParityByte(0x14) & 0x80).toBeTruthy();
    const pairs = encodeCea608Caption("HI", true);
    expect(pairs[0]).toEqual([oddParityByte(CEA608_CC1.RCL[0]), oddParityByte(CEA608_CC1.RCL[1])]);
    expect(pairs[pairs.length - 1]).toEqual([
      oddParityByte(CEA608_CC1.EOC[0]),
      oddParityByte(CEA608_CC1.EOC[1]),
    ]);
    const hex = cea608ToHex(pairs);
    expect(hex).toMatch(/^[0-9a-f]+$/);
    expect(hex.length % 4).toBe(0);
    const cea708 = wrapCea608InCea708(pairs);
    expect(cea708.startsWith("80")).toBe(true);
    expect(cea708.length).toBe(pairs.length * 6);
  });

  it("builds encoder REST calls that inject captions into the H.264/RTMP stream", () => {
    const chunk = extractDeepgramTranscript(DEEPGRAM_FINAL)!;
    const bm = buildHardwareCaptionRequest(blackmagic, chunk);
    expect(bm.url).toBe("https://presenter.campus.edu/api/captions");
    expect(bm.method).toBe("POST");
    expect(bm.body.format).toBe("cea-608");
    expect(bm.body.destination).toBe("H.264/RTMP");
    expect(bm.body.rtmpUrl).toBe("rtmp://cable.campus.edu/live/event");
    expect(bm.body.cea608.length).toBeGreaterThan(0);
    expect(bm.body.cea708.length).toBeGreaterThan(0);

    const aws = buildHardwareCaptionRequest(medialive, chunk);
    expect(aws.url).toBe("https://medialive.campus.edu/prod/channels/ch-cable-1/captions");
    expect(aws.headers.Authorization).toBe("Bearer secret-token");
  });

  it("POSTs Deepgram chunks to the identified encoder REST API", async () => {
    const postJson = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const result = await injectHardwareCaptions(blackmagic, DEEPGRAM_FINAL, postJson);
    expect(result.injected).toBe(true);
    expect(postJson).toHaveBeenCalledTimes(1);
    expect(postJson.mock.calls[0][0]).toBe("https://presenter.campus.edu/api/captions");
    expect(postJson.mock.calls[0][1].cea608).toMatch(/^[0-9a-f]+$/);
  });

  it("does not hit the encoder when the Deepgram chunk has no text", async () => {
    const postJson = vi.fn();
    const result = await injectHardwareCaptions(
      blackmagic,
      { is_final: true, channel: { alternatives: [{ transcript: "   " }] } },
      postJson,
    );
    expect(result).toEqual({ injected: false, reason: "empty_transcript" });
    expect(postJson).not.toHaveBeenCalled();
  });
});
