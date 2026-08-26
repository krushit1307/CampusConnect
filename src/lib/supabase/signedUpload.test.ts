import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSignedUploadUrl, uploadToSignedUrl, uploadImageWithSignedUrl } from "./signedUpload";

const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    functions: { invoke: vi.fn() },
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: vi.fn((path: string) => ({
          data: {
            publicUrl: `https://mock.supabase.co/storage/v1/object/public/avatars/${path}`,
          },
        })),
      })),
    },
  },
}));

vi.mock("./client", () => ({
  createClient: vi.fn(() => mockClient),
}));

class MockXHR {
  static instance: MockXHR | null = null;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  abort = vi.fn();
  upload: { onprogress: ((e: { loaded: number; total: number }) => void) | null } = {
    onprogress: null,
  };
  status = 200;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    MockXHR.instance = this;
  }
}

function file(name = "photo.png", type = "image/png", size = 1024): Blob {
  return new Blob([new Uint8Array(size)], { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("XMLHttpRequest", MockXHR);
});

afterEach(() => {
  vi.unstubAllGlobals();
  MockXHR.instance = null;
});

describe("getSignedUploadUrl", () => {
  it("requests a signed URL from the generate-upload-url edge function", async () => {
    mockClient.functions.invoke.mockResolvedValueOnce({
      data: {
        uploadUrl: "https://mock.supabase.co/storage/v1/object/upload/sign/avatars/u/p.png?token=t",
        token: "t",
        path: "u/p.png",
        bucket: "avatars",
      },
      error: null,
    });

    const result = await getSignedUploadUrl("avatars", "u/p.png", "image/png", 1024);

    expect(mockClient.functions.invoke).toHaveBeenCalledWith("generate-upload-url", {
      body: { bucket: "avatars", path: "u/p.png", contentType: "image/png", size: 1024 },
    });
    expect(result.uploadUrl).toContain("/object/upload/sign/avatars/u/p.png");
    expect(result.token).toBe("t");
  });

  it("throws when the edge function returns an error", async () => {
    mockClient.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Bucket 'foo' is not allowed" },
    });

    await expect(getSignedUploadUrl("foo", "x.png", "image/png", 10)).rejects.toThrow(
      "Bucket 'foo' is not allowed",
    );
  });

  it("throws when the backend returns no upload URL", async () => {
    mockClient.functions.invoke.mockResolvedValueOnce({ data: null, error: null });

    await expect(getSignedUploadUrl("avatars", "x.png", "image/png", 10)).rejects.toThrow(
      "backend returned no URL",
    );
  });
});

describe("uploadToSignedUrl", () => {
  it("PUTs the raw file to the signed URL with the expected headers", async () => {
    const promise = uploadToSignedUrl("https://signed.example/upload?token=t", file());
    const xhr = MockXHR.instance!;
    expect(xhr.open).toHaveBeenCalledWith("PUT", "https://signed.example/upload?token=t");
    expect(xhr.setRequestHeader).toHaveBeenCalledWith("Content-Type", "image/png");
    expect(xhr.setRequestHeader).toHaveBeenCalledWith("x-upsert", "true");

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 512, total: 1024 });
    xhr.onload?.();
    await promise;
  });

  it("rejects on a non-2xx response", async () => {
    const promise = uploadToSignedUrl("https://signed.example/upload?token=t", file());
    MockXHR.instance!.status = 403;
    MockXHR.instance!.onload?.();
    await expect(promise).rejects.toThrow("Upload failed with status 403");
  });

  it("rejects on network error", async () => {
    const promise = uploadToSignedUrl("https://signed.example/upload?token=t", file());
    MockXHR.instance!.onerror?.();
    await expect(promise).rejects.toThrow("Upload failed due to a network error");
  });
});

describe("uploadImageWithSignedUrl", () => {
  it("requests a signed URL, PUTs the file, and returns the public URL", async () => {
    mockClient.functions.invoke.mockResolvedValueOnce({
      data: {
        uploadUrl: "https://mock.supabase.co/storage/v1/object/upload/sign/avatars/u/p.png?token=t",
        token: "t",
        path: "u/p.png",
        bucket: "avatars",
      },
      error: null,
    });

    const onProgress = vi.fn();
    const promise = uploadImageWithSignedUrl("avatars", "u/p.png", file(), onProgress);

    await new Promise((resolve) => setTimeout(resolve, 0));
    MockXHR.instance!.upload.onprogress?.({
      lengthComputable: true,
      loaded: 512,
      total: 1024,
    });
    MockXHR.instance!.onload?.();

    await expect(promise).resolves.toBe(
      "https://mock.supabase.co/storage/v1/object/public/avatars/u/p.png",
    );
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(mockClient.functions.invoke).toHaveBeenCalledTimes(1);
  });

  it("propagates signed-URL request failures", async () => {
    mockClient.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Unauthorized" },
    });

    await expect(uploadImageWithSignedUrl("avatars", "u/p.png", file())).rejects.toThrow(
      "Unauthorized",
    );
  });
});
