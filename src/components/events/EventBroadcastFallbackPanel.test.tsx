import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBroadcastFallbackPanel } from "./EventBroadcastFallbackPanel";

// Mock Supabase Client
const mockInvoke = vi.fn();
const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }),
  },
  rpc: vi.fn().mockResolvedValue({ data: { id: "session-123" }, error: null }),
  from: vi.fn().mockImplementation(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "session-123",
            event_id: "evt-123",
            presenter_user_id: "user-123",
            primary_stream_url: null,
            fallback_slate_url: "/technical-difficulties.mp4",
            active_source: "fallback",
            state: "fallback",
            connection_state: "failed",
            failure_reason: "A/V check failed.",
          },
          error: null,
        }),
      }),
    }),
  })),
  functions: {
    invoke: mockInvoke,
  },
  channel: () => ({
    on: () => ({
      subscribe: vi.fn(),
    }),
  }),
  removeChannel: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// Mock AudioContext and AnalyserNode
const mockAnalyserNode = {
  fftSize: 256,
  frequencyBinCount: 128,
  connect: vi.fn(),
  getByteFrequencyData: vi.fn((array) => {
    array.fill(50);
  }),
};

const mockAudioContext = {
  createAnalyser: vi.fn().mockReturnValue(mockAnalyserNode),
  createMediaStreamSource: vi.fn().mockReturnValue({
    connect: vi.fn(),
  }),
  close: vi.fn().mockResolvedValue(undefined),
  state: "running",
};

vi.stubGlobal("AudioContext", vi.fn().mockImplementation(() => mockAudioContext));

// Mock MediaDevices
const mockTrack = {
  stop: vi.fn(),
  getSettings: vi.fn().mockReturnValue({ deviceId: "cam-1" }),
};
const mockStream = {
  getTracks: () => [mockTrack],
  getVideoTracks: () => [mockTrack],
  getAudioTracks: () => [mockTrack],
};

const mockMediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue(mockStream),
  enumerateDevices: vi.fn().mockResolvedValue([
    { kind: "videoinput", deviceId: "cam-1", label: "Front Camera" },
    { kind: "videoinput", deviceId: "cam-2", label: "Back Camera" },
  ]),
};

vi.stubGlobal("navigator", {
  mediaDevices: mockMediaDevices,
});

describe("EventBroadcastFallbackPanel & Green Room Check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Enable Fallback button when no active session is loaded", async () => {
    mockSupabase.from.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }));

    render(<EventBroadcastFallbackPanel eventId="evt-123" isOrganizer />);
    await waitFor(() => {
      expect(screen.getByText("Protect the live feed")).toBeInTheDocument();
    });
  });

  it("opens Green Room dialog and displays controls", async () => {
    render(<EventBroadcastFallbackPanel eventId="evt-123" isOrganizer />);
    await waitFor(() => {
      expect(screen.getByText("Run A/V check")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Run A/V check"));

    await waitFor(() => {
      expect(screen.getByText("Pre-Flight Green Room")).toBeInTheDocument();
      expect(screen.getByText("Select Camera Source")).toBeInTheDocument();
    });
  });
});
