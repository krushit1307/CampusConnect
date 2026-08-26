import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import SkillSwapMarketplace from "./skill-swap";

// Mock Supabase client
const mockInsert = vi.fn().mockResolvedValue({ data: { id: "swap-3" }, error: null });
const mockAccept = vi.fn().mockResolvedValue({ data: true, error: null });

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } })
    },
    rpc: (name: string, args: any) => {
      if (name === "accept_skill_swap_match") return mockAccept(args);
      return Promise.resolve({ data: null, error: null });
    },
    from: (table: string) => {
      if (table === "skill_swaps") {
        return {
          select: () => ({
            order: () => Promise.resolve({
              data: [
                { id: "swap-1", user_id: "user-1", offering_skill: "Python", requesting_skill: "Guitar", created_at: "2026-08-19" },
                { id: "swap-2", user_id: "user-2", offering_skill: "Guitar", requesting_skill: "Python", created_at: "2026-08-19", profile: { first_name: "Alex", last_name: "Jones" } }
              ],
              error: null
            })
          }),
          insert: (val: any) => ({
            select: () => ({
              single: () => mockInsert(val)
            })
          })
        };
      }
      if (table === "skill_swap_matches") {
        return {
          select: () => ({
            or: () => ({
              order: () => Promise.resolve({
                data: [
                  {
                    id: "match-1",
                    status: "matched",
                    user_a_id: "user-1",
                    user_b_id: "user-2",
                    skill_a_to_b: "Python",
                    skill_b_to_a: "Guitar",
                    user_a_accepted: false,
                    user_b_accepted: false,
                    user_a: { first_name: "Me", last_name: "Self" },
                    user_b: { first_name: "Alex", last_name: "Jones" }
                  }
                ],
                error: null
              })
            })
          })
        };
      }
      return {
        select: () => ({
          order: () => Promise.resolve({ data: [], error: null })
        })
      };
    }
  })
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: (opts: any) => {
    if (opts.queryKey[0] === "all-skill-swaps") {
      return {
        data: [
          { id: "swap-1", user_id: "user-1", offering_skill: "Python", requesting_skill: "Guitar", created_at: "2026-08-19" },
          { id: "swap-2", user_id: "user-2", offering_skill: "Guitar", requesting_skill: "Python", created_at: "2026-08-19", profile: { first_name: "Alex", last_name: "Jones" } }
        ],
        isLoading: false
      };
    }
    if (opts.queryKey[0] === "user-skill-matches") {
      return {
        data: [
          {
            id: "match-1",
            status: "matched",
            user_a_id: "user-1",
            user_b_id: "user-2",
            skill_a_to_b: "Python",
            skill_b_to_a: "Guitar",
            user_a_accepted: false,
            user_b_accepted: false,
            user_a: { first_name: "Me", last_name: "Self" },
            user_b: { first_name: "Alex", last_name: "Jones" }
          }
        ],
        isLoading: false
      };
    }
    return { data: { id: "user-1" }, isLoading: false };
  },
  useMutation: (opts: any) => ({
    mutate: (arg?: any) => opts.mutationFn(arg).then(opts.onSuccess),
    isPending: false
  })
}));

describe("Dynamic Skill Swap Marketplace UI (#3605)", () => {
  it("renders swap boards, matches checklist and handles connection acceptances", async () => {
    render(
      <BrowserRouter>
        <SkillSwapMarketplace />
      </BrowserRouter>
    );

    // Verify Title and Sub-headers
    expect(screen.getByText("Skill Swap Board")).toBeInTheDocument();
    expect(screen.getByText("Match with Alex Jones")).toBeInTheDocument();

    // Verify Offering and Learning skill fields
    expect(screen.getByText("What you teach")).toBeInTheDocument();
    expect(screen.getByText("What you learn")).toBeInTheDocument();

    // Click Accept match button
    const acceptBtn = screen.getByRole("button", { name: "Accept" });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(mockAccept).toHaveBeenCalled();
    });
  });
});
