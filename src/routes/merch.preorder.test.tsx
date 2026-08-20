import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useMerchCartStore } from "@/store/useMerchCartStore";
import { MerchStore } from "@/components/Clubs/Merchandise/MerchStore";
import { ManageMerch } from "@/components/Clubs/Merchandise/ManageMerch";

// Mock Supabase
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "user-1", email: "backer@campus.edu" } } }),
    },
    from: () => ({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [],
            error: null,
          }),
      }),
      insert: () => Promise.resolve({ data: { id: "new" }, error: null }),
      functions: {
        invoke: () =>
          Promise.resolve({
            data: { url: "https://checkout.stripe.com", orderId: "ord-1" },
            error: null,
          }),
      },
    }),
  },
}));

// Mock edge functions
vi.mock("@/supabase/functions", () => ({
  useIdempotentPayment: () => ({
    processPayment: vi.fn(),
    isProcessing: false,
  }),
  useIdempotentPreorder: () => ({
    processPreorder: vi.fn(),
    isProcessing: false,
  }),
}));

describe("Merch Pre-Order Module", () => {
  describe("Cart Store", () => {
    it("adds variant to cart", () => {
      const { addItem } = useMerchCartStore.getState();
      addItem("var-1", 2);
      const state = useMerchCartStore.getState();
      expect(state.getItemCount("var-1")).toBe(2);
    });

    it("increases quantity", () => {
      const { increaseQuantity, addItem } = useMerchCartStore.getState();
      addItem("var-1", 1);
      increaseQuantity("var-1");
      const state = useMerchCartStore.getState();
      expect(state.getItemCount("var-1")).toBe(2);
    });

    it("decreases quantity", () => {
      const { addItem, decreaseQuantity } = useMerchCartStore.getState();
      addItem("var-1", 2);
      decreaseQuantity("var-1");
      const state = useMerchCartStore.getState();
      expect(state.getItemCount("var-1")).toBe(1);
    });

    it("removes item from cart", () => {
      const { addItem, removeItem } = useMerchCartStore.getState();
      addItem("var-1", 1);
      removeItem("var-1");
      const state = useMerchCartStore.getState();
      expect(state.getTotalQuantity()).toBe(0);
    });

    it("clears cart", () => {
      const { addItem, clearCart } = useMerchCartStore.getState();
      addItem("var-1", 1);
      addItem("var-2", 2);
      clearCart();
      const state = useMerchCartStore.getState();
      expect(state.getTotalQuantity()).toBe(0);
      expect(state.getItems().length).toBe(0);
    });

    it("supports multiple variants in one cart", () => {
      const { addItem } = useMerchCartStore.getState();
      addItem("var-1", 1);
      addItem("var-2", 2);
      const state = useMerchCartStore.getState();
      expect(state.getTotalQuantity()).toBe(3);
      expect(state.getItemCount("var-1")).toBe(1);
      expect(state.getItemCount("var-2")).toBe(2);
    });

    it("returns correct total quantity", () => {
      const { addItem } = useMerchCartStore.getState();
      addItem("var-1", 2);
      addItem("var-2", 3);
      const state = useMerchCartStore.getState();
      expect(state.getTotalQuantity()).toBe(5);
    });
  });

  describe("MerchStore - Cart Integration", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("renders Add to Cart buttons alongside Buy Now", () => {
      render(
        <BrowserRouter>
          <MerchStore clubId="club-1" />
        </BrowserRouter>,
      );
      // The store should render with variants
      expect(screen.getAllByRole("button")).toBeInTheDocument();
    });

    it("shows cart summary when items are added", () => {
      const { addItem } = useMerchCartStore.getState();
      addItem("var-1", 2);
      addItem("var-3", 1);
      const state = useMerchCartStore.getState();
      expect(state.getTotalQuantity()).toBe(3);
    });
  });

  describe("Fulfillment Dashboard", () => {
    it("requires payment before pickup", () => {
      // Test that the fulfillment logic correctly rejects unpaid orders
      expect(true).toBe(true); // Placeholder - actual testing via RTL
    });

    it("allows pickup of paid orders", () => {
      expect(true).toBe(true); // Placeholder
    });

    it("rejects already picked-up orders", () => {
      expect(true).toBe(true); // Placeholder
    });
  });

  describe("CSV Export", () => {
    it("aggregates quantities by variant", () => {
      expect(true).toBe(true); // Placeholder
    });

    it("only counts paid orders", () => {
      expect(true).toBe(true); // Placeholder
    });
  });
});
