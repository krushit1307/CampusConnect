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

export const useMerchCartStore = create<MerchCartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (variantId, quantity = 1) =>
        set((s) => {
          const existingIndex = s.items.findIndex((item) => item.variantId === variantId);
          if (existingIndex >= 0) {
            const newItems = s.items.map((item, idx) =>
              idx === existingIndex ? { ...item, quantity: item.quantity + quantity } : item,
            );
            return { items: newItems };
          }
          return { items: [...s.items, { variantId, quantity }] };
        }),

      increaseQuantity: (variantId) =>
        set((s) => {
          const existingIndex = s.items.findIndex((item) => item.variantId === variantId);
          if (existingIndex >= 0) {
            const newItems = s.items.map((item, idx) =>
              idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item,
            );
            return { items: newItems };
          }
          return { items: [...s.items, { variantId, quantity: 1 }] };
        }),

      decreaseQuantity: (variantId) =>
        set((s) => {
          const existingIndex = s.items.findIndex((item) => item.variantId === variantId);
          if (existingIndex >= 0) {
            const currentItem = s.items[existingIndex];
            if (currentItem.quantity <= 1) {
              return { items: s.items.filter((item) => item.variantId !== variantId) };
            }
            const newItems = s.items.map((item, idx) =>
              idx === existingIndex ? { ...item, quantity: item.quantity - 1 } : item,
            );
            return { items: newItems };
          }
          return { items: s.items };
        }),

      removeItem: (variantId) =>
        set((s) => ({
          items: s.items.filter((item) => item.variantId !== variantId),
        })),

      clearCart: () => set({ items: [] }),

      getTotalQuantity: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getItems: () => {
        return get().items;
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
