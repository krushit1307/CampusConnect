// src/components/CrossTabSyncProvider.tsx
//
// Mount-once component that activates all three cross-tab sync hooks
// (auth, theme, cart). Place this inside the Router context at the
// app root, e.g.:
//
//   <ThemeProvider>
//     <BrowserRouter>
//       <CrossTabSyncProvider />
//       <App />
//     </BrowserRouter>
//   </ThemeProvider>
//
// The component renders null — it has no UI.

import { useAuthBroadcast } from "@/hooks/useAuthBroadcast";
import { useThemeBroadcast } from "@/hooks/useThemeBroadcast";

export function CrossTabSyncProvider() {
  useAuthBroadcast();
  useThemeBroadcast();
  // Note: useCartBroadcast is called inside the cart UI component,
  // not here, because the cart state needs to be scoped to the
  // checkout component's lifecycle. The auth and theme hooks are
  // global, so they live here.
  return null;
}
