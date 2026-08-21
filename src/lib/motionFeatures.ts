/**
 * Central place for framer-motion's LazyMotion feature bundles.
 *
 * `framer-motion`'s full `motion` component ships ~35kb (gzipped) of gesture,
 * drag and layout-projection physics — most of which the app never touches.
 * `LazyMotion` lets us render with the lightweight `m` component instead and
 * fetch only the animation features we actually need, on demand.
 *
 * - `loadDomAnimation` — the default, app-wide bundle. Covers `animate`,
 *   `exit`, `initial`, `variants`, and hover/tap/focus gestures. This is all
 *   that ~95% of `m.*` usages in this app need.
 * - `loadDomMax`      — superset that adds drag physics and shared
 *   `layoutId` / layout-projection support. Noticeably heavier, so it's only
 *   loaded by the specific screens that use `drag` or `layoutId`
 *   (e.g. DiscoveryCardStack, FloatingChat, SwipeableLightbox,
 *   FeaturedEvents, EventDetail's hero image transition).
 *
 * Both are exported as loader functions (rather than the resolved feature
 * objects) so that `<LazyMotion features={loader}>` fetches the
 * `framer-motion` features chunk lazily, instead of pulling it into the
 * initial bundle via a static import.
 */
import type { FeatureBundle } from "framer-motion";

export const loadDomAnimation = (): Promise<FeatureBundle> =>
  import("framer-motion").then((mod) => mod.domAnimation);

export const loadDomMax = (): Promise<FeatureBundle> =>
  import("framer-motion").then((mod) => mod.domMax);
