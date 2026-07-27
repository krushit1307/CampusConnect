import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractText } from "./ocr";

vi.mock("tesseract.js", () => ({
  createWorker: vi.fn().mockResolvedValue({
    recognize: vi.fn().mockResolvedValue({
      data: { text: "Mock extracted text" },
    }),
  }),
}));

describe("ocr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract text from a file", async () => {
    const file = new File([""], "flyer.png", { type: "image/png" });
    const text = await extractText(file);
    expect(text).toBe("Mock extracted text");
  });
});
