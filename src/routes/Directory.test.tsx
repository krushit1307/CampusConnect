import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Directory from "./Directory";
import { generateMockUsers, filterUsers } from "../components/Directory/userData";

import { useDirectoryStore } from "@/store/useDirectoryStore";

describe("Directory", () => {
  beforeEach(() => {
    useDirectoryStore.getState().resetFilters();
  });
  it("renders the directory header and search input", () => {
    render(<Directory />);
    expect(screen.getByText("University User Directory")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search by name, major/i)).toBeInTheDocument();
  });

  it("renders virtualized users after loading completes", async () => {
    render(<Directory />);
    expect(await screen.findByText("User #1", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(/Rendering 100,000 users/i)).toBeInTheDocument();
  });

  it("filters users by search query", async () => {
    render(<Directory />);
    await screen.findByText("User #1", {}, { timeout: 5000 });
    fireEvent.change(screen.getByPlaceholderText(/search by name, major/i), {
      target: { value: "Finance" },
    });
    expect(screen.getByText(/Rendering 20,000 users/i)).toBeInTheDocument();
  });

  it("shows empty state when no users match", async () => {
    render(<Directory />);
    await screen.findByText("User #1", {}, { timeout: 5000 });
    fireEvent.change(screen.getByPlaceholderText(/search by name, major/i), {
      target: { value: "zzzz-no-match" },
    });
    expect(screen.getByText(/No people match that search/i)).toBeInTheDocument();
  });

  it("clears the search from the empty state", async () => {
    render(<Directory />);
    await screen.findByText("User #1", {}, { timeout: 5000 });
    fireEvent.change(screen.getByPlaceholderText(/search by name, major/i), {
      target: { value: "zzzz-no-match" },
    });
    fireEvent.click(screen.getByText(/clear search/i));
    expect(screen.getByText(/Rendering 100,000 users/i)).toBeInTheDocument();
  });
});

describe("userData", () => {
  it("generates the requested number of mock users", () => {
    const users = generateMockUsers({ count: 5 });
    expect(users).toHaveLength(5);
    expect(users[0]).toMatchObject({
      id: 1,
      name: "User #1",
      email: "user1@university.edu",
    });
  });

  it("returns all users when the query is empty", () => {
    const users = generateMockUsers({ count: 3 });
    expect(filterUsers(users, "  ")).toBe(users);
  });

  it("filters by name", () => {
    const users = generateMockUsers({ count: 10 });
    const result = filterUsers(users, "User #7");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("User #7");
  });

  it("filters by major", () => {
    const users = generateMockUsers({ count: 5 });
    const result = filterUsers(users, "finance");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((u) => u.major.toLowerCase() === "finance")).toBe(true);
  });

  it("filters by interest", () => {
    const users = generateMockUsers({ count: 8, allInterests: ["Coding"] });
    const result = filterUsers(users, "coding");
    expect(result).toHaveLength(8);
  });
});
