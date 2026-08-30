import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MagicUpload from "./upload.magic.$token";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "@testing-library/jest-dom";

vi.mock("react-hot-toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("MagicUpload component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (token: string) => {
    render(
      <MemoryRouter initialEntries={[`/upload/magic/${token}`]}>
        <Routes>
          <Route path="/upload/magic/:token" element={<MagicUpload />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it("should show invalid link if token validation fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Invalid token" }),
    });

    renderComponent("bad-token");

    await waitFor(() => {
      expect(screen.getByText("Invalid Link")).toBeInTheDocument();
      expect(screen.getByText(/invalid, expired, or has already been used/i)).toBeInTheDocument();
    });
  });

  it("should show upload interface if token is valid", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: true, eventTitle: "Spring Festival" }),
    });

    renderComponent("good-token");

    await waitFor(() => {
      expect(screen.getByText("Upload Photos")).toBeInTheDocument();
      expect(screen.getByText("Spring Festival")).toBeInTheDocument();
    });
  });
});
