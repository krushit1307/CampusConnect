import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeepfakeAudioDetectorService } from "../deepfakeAudioDetectorService";
import MessageInput from "../../components/Messages/MessageInput";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockInvoke = vi.fn();
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: "test-user-uuid" } },
  error: null,
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    functions: {
      invoke: mockInvoke,
    },
  }),
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => mockToastError(msg),
    success: (msg: string) => mockToastSuccess(msg),
    info: (msg: string) => mockToastInfo(msg),
  },
}));

// Mock useChatStore for Zustand
vi.mock("@/store/useChatStore", () => ({
  useChatStore: (selector: any) => {
    // Return dummy store content
    const state = {
      inputMessage: "",
      setInputMessage: vi.fn(),
    };
    return selector(state);
  },
}));

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe("DeepfakeAudioDetectorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes clean/real audio files correctly", async () => {
    mockInvoke.mockResolvedValue({
      data: { blocked: false, probability: 0.15 },
      error: null,
    });

    const file = new File([new ArrayBuffer(100)], "speech_sample.mp3", { type: "audio/mpeg" });
    const result = await DeepfakeAudioDetectorService.validateAudioFile(file);

    expect(result.valid).toBe(true);
    expect(result.probability).toBe(0.15);
  });

  it("blocks synthetic deepfake audio files", async () => {
    mockInvoke.mockResolvedValue({
      data: { blocked: true, probability: 0.98, message: "Upload blocked: Deepfake audio detected (Impersonation/Generative AI Fraud)." },
      error: null,
    });

    const file = new File([new ArrayBuffer(100)], "president_endorsement_deepfake.mp3", { type: "audio/mpeg" });
    const result = await DeepfakeAudioDetectorService.validateAudioFile(file);

    expect(result.valid).toBe(false);
    expect(result.probability).toBe(0.98);
    expect(result.error).toContain("Generative AI Fraud");
  });
});

describe("MessageInput Deepfake Integration", () => {
  const dummyOnSend = vi.fn();
  const dummyOnTyping = vi.fn();
  const dummyOnFocus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders audio attachment button and file input", () => {
    render(
      <MessageInput
        onSend={dummyOnSend}
        onTyping={dummyOnTyping}
        onFocus={dummyOnFocus}
        typingUsers={[]}
      />
    );

    expect(screen.getByTestId("chat-audio-attach-button")).toBeInTheDocument();
    expect(screen.getByTestId("chat-audio-file-input")).toBeInTheDocument();
  });

  it("blocks and warns when attaching a deepfake audio file", async () => {
    mockInvoke.mockResolvedValue({
      data: { blocked: true, probability: 0.98, message: "Upload blocked: Deepfake audio detected." },
      error: null,
    });

    render(
      <MessageInput
        onSend={dummyOnSend}
        onTyping={dummyOnTyping}
        onFocus={dummyOnFocus}
        typingUsers={[]}
      />
    );

    const fileInput = screen.getByTestId("chat-audio-file-input") as HTMLInputElement;
    const file = new File([new ArrayBuffer(100)], "cloned_elevenlabs_voice.wav", { type: "audio/wav" });

    // Simulate file attachment
    Object.defineProperty(fileInput, "files", {
      value: [file],
      writable: true,
    });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining("Deepfake audio detected")
      );
    });
  });

  it("allows clean audio files to attach successfully", async () => {
    mockInvoke.mockResolvedValue({
      data: { blocked: false, probability: 0.08 },
      error: null,
    });

    render(
      <MessageInput
        onSend={dummyOnSend}
        onTyping={dummyOnTyping}
        onFocus={dummyOnFocus}
        typingUsers={[]}
      />
    );

    const fileInput = screen.getByTestId("chat-audio-file-input") as HTMLInputElement;
    const file = new File([new ArrayBuffer(100)], "normal_lecture.mp3", { type: "audio/mpeg" });

    Object.defineProperty(fileInput, "files", {
      value: [file],
      writable: true,
    });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Audio verified: No synthetic voice artifacts detected.")
      );
    });
  });
});
