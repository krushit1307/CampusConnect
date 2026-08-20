import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface MerchVariantCart {
  variantId: string;
  quantity: number;
}

export interface MerchCartState {
  items: MerchVariantCart[];
  addItem: (variantId: string, quantity?: number) => void;
  increaseQuantity: (variantId: string) => void;
  decreaseQuantity: (variantId: string) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  getTotalQuantity: () => number;
  getItems: () => MerchVariantCart[];
}

export const useMerchCartStore = create<MerchCartState>(
  persist(
    (set) => ({
      items: [],

      addItem: (variantId, quantity = 1) =>
        set((s) => {
          const existingIndex = s.items.findIndex((item) => item.variantId === variantId);
          if (existingIndex >= 0) {
            const newItems = [...s.items];
            newItems[existingIndex].quantity += quantity;
            return { items: newItems };
          }
          return { items: [...s.items, { variantId, quantity }] };
        }),

      increaseQuantity: (variantId) =>
        set((s) => {
          const existingIndex = s.items.findIndex((item) => item.variantId === variantId);
          if (existingIndex >= 0) {
            const newItems = [...s.items];
            newItems[existingIndex].quantity += 1;
            return { items: newItems };
          }
          return { items: [...s.items, { variantId, quantity: 1 }] };
        }),

      decreaseQuantity: (variantId) =>
        set((s) => {
          const existingIndex = s.items.findIndex((item) => item.variantId === variantId);
          if (existingIndex >= 0) {
            const newItems = [...s.items];
            newItems[existingIndex].quantity -= 1;
            if (newItems[existingIndex].quantity <= 0) {
              const filtered = newItems.filter((item) => item.variantId !== variantId);
              return { items: filtered };
            }
            return { items: newItems };
          }
          return { items: s.items };
        }),

      removeItem: (variantId) =>
        set({
          items: s.items.filter((item) => item.variantId !== variantId),
        }),

      clearCart: () => set({ items: [] }),

      getTotalQuantity: () => {
        // Access state via get() outside this closure in components
        return 0;
      },

      getItems: () => {
        // Access state via get() outside this closure in components
        return [];
      },
    }),

    {
      name: "campusconnect-merch-cart",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        items: state.items,
      }),
    },
  ),
);
