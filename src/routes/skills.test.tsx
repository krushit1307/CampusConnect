import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SkillsBoard from "./skills";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } }),
    },
    from: (table: string) => {
      return {
        select: (columns: string) => {
          if (table === "skills_taxonomy") {
            return Promise.resolve({
              data: [
                { id: "s-1", name: "React" },
                { id: "s-2", name: "Python" },
                { id: "s-3", name: "Graphic Design" },
              ],
              error: null,
            });
          }
          if (table === "profiles") {
            return Promise.resolve({
              data: [
                {
                  id: "user-2",
                  full_name: "Alice Smith",
                  handle: "alice",
                  avatar_url: null,
                  college: "Art College",
                  bio: "Art student looking to barter graphic design",
                },
                {
                  id: "user-3",
                  full_name: "Bob Jones",
                  handle: "bob",
                  avatar_url: null,
                  college: "Engineering College",
                  bio: "CS student building a next-gen web app",
                },
              ],
              error: null,
            });
          }
          if (table === "user_offered_skills") {
            return Promise.resolve({
              data: [
                { user_id: "user-2", skills_taxonomy: { name: "Graphic Design" } },
                { user_id: "user-3", skills_taxonomy: { name: "React" } },
              ],
              error: null,
            });
          }
          if (table === "user_needed_skills") {
            return Promise.resolve({
              data: [
                { user_id: "user-2", skills_taxonomy: { name: "React" } },
                { user_id: "user-3", skills_taxonomy: { name: "Graphic Design" } },
              ],
              error: null,
            });
          }
          return Promise.resolve({ data: [], error: null });
        },
      };
    },
    rpc: (name: string) => {
      if (name === "get_skill_swap_matches") {
        return Promise.resolve({
          data: [
            {
              matched_user_id: "user-2",
              full_name: "Alice Smith",
              handle: "alice",
              avatar_url: null,
              skills_they_offer_i_need: ["Graphic Design"],
              skills_i_offer_they_need: ["React"],
              match_score: 2,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    },
  }),
}));

describe("SkillsBoard Component", () => {
  it("renders the skill swap board headers and filters", async () => {
    render(
      <MemoryRouter>
        <SkillsBoard />
      </MemoryRouter>
    );

    expect(screen.getByText("Skill Swap Board")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search name, bio...")).toBeInTheDocument();
  });

  it("filters profiles correctly based on search input", async () => {
    render(
      <MemoryRouter>
        <SkillsBoard />
      </MemoryRouter>
    );

    // Initial load displays profiles
    expect(await screen.findByText("Alice Smith")).toBeInTheDocument();
    expect(await screen.findByText("Bob Jones")).toBeInTheDocument();

    // Type query to filter
    const input = screen.getByPlaceholderText("Search name, bio...");
    fireEvent.change(input, { target: { value: "Alice" } });

    // Verify Bob is filtered out
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
  });
});
