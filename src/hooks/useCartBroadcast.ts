// src/hooks/useCartBroadcast.ts
//
// Cross-tab Ticket Cart Synchronization (Issue #2692).
//
// Keeps the ticket cart (the list of ticket tiers a user has added
// to their cart for checkout) synchronized across all open tabs.
// When a user adds a ticket in Tab A, Tab B's cart instantly
// reflects the addition.
//
// Uses useBroadcastState under the hood.

import { useBroadcastState } from "./useBroadcastState";

export interface CartItem {
  eventId: string;
  eventTitle: string;
  tierId: string;
  tierName: string;
  price: number;
  quantity: number;
}

export type Cart = CartItem[];

const CART_CHANNEL = "campusconnect:cart";
const EMPTY_CART: Cart = [];

/**
 * Cross-tab synchronized ticket cart.
 *
 * Returns `[cart, setCart]` where `cart` is the array of CartItem
 * objects and `setCart` updates both local state and broadcasts to
 * all other tabs.
 *
 * Convenience helpers `addItem`, `removeItem`, `updateQuantity`,
 * `clearCart` are also provided.
 */
export function useCartBroadcast(): {
  cart: Cart;
  setCart: (value: Cart | ((prev: Cart) => Cart)) => void;
  addItem: (item: CartItem) => void;
  removeItem: (tierId: string) => void;
  updateQuantity: (tierId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
} {
  const [cart, setCart] = useBroadcastState<Cart>(CART_CHANNEL, EMPTY_CART);

  const addItem = (item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.tierId === item.tierId);
      if (existing) {
        return prev.map((i) =>
          i.tierId === item.tierId ? { ...i, quantity: i.quantity + item.quantity } : i,
        );
      }
      return [...prev, item];
    });
  };

  const removeItem = (tierId: string) => {
    setCart((prev) => prev.filter((i) => i.tierId !== tierId));
  };

  const updateQuantity = (tierId: string, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.tierId !== tierId)
        : prev.map((i) => (i.tierId === tierId ? { ...i, quantity } : i)),
    );
  };

  const clearCart = () => {
    setCart(EMPTY_CART);
  };

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return {
    cart,
    setCart,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    totalItems,
    totalPrice,
  };
}
