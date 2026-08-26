# Issue #2391 — Advanced IntersectionObserver pre-emptive lazy loading

## Implementation

CampusConnect already has `src/hooks/useOnScreen.ts`, but that hook creates an
`IntersectionObserver` for every mounted element. Issue #2391 explicitly calls
for one shared observer for large lists.

This implementation adds:

- `src/hooks/useInView.ts`
- `src/components/ui/LazyComponent.tsx`
- `src/hooks/useInView.test.ts`
- this documentation

## Observer configuration

The shared observer uses:

```ts
{
  root: null,
  rootMargin: "200px 0px 200px 0px",
  threshold: 0,
}
```

The vertical 200px margin expands the observer's mathematical viewport so a
resource can begin loading before it becomes visible.

## Lifecycle

1. A component attaches the returned ref.
2. The target is registered with the shared observer.
3. When `entry.isIntersecting` becomes true, the hook sets `hasIntersected`.
4. The target is immediately unobserved.
5. The wrapper renders the heavy child.
6. When no targets remain, the shared observer is disconnected.

## Why a shared observer?

Creating 500 independent observers for 500 images adds unnecessary browser
work and memory pressure. The registry keeps one observer and a small
subscriber set per DOM target.

## Usage

```tsx
<LazyComponent fallback={<ImageSkeleton />}>
  <img src={src} alt={alt} width={640} height={360} />
</LazyComponent>
```

For the issue's required default behavior:

```tsx
const { ref, hasIntersected } = useInView({
  rootMargin: "200px 0px 200px 0px",
});
```

## Testing

The tests verify:

- the exact 200px root margin;
- one observer for multiple targets;
- observation of multiple targets;
- intersection state changes;
- immediate unobserve after intersection;
- cleanup/disconnect;
- heavy content is not rendered before the threshold;
- heavy content renders after intersection.

## Manual verification

Create/render a list containing at least 50 heavy images.

Chrome DevTools:

1. Open **Network**.
2. Enable **Disable cache**.
3. Reload the page.
4. Confirm only initially rendered/eager resources download.
5. Slowly scroll toward the image list.
6. Watch the Network panel.
7. A deferred image should begin loading when its wrapper is approximately
   200px below the viewport bottom.
8. Continue scrolling into the image.
9. Verify the image is already loaded and there is no blank/white flash.
10. Confirm scrolling remains responsive.

For an exact 200px verification, use DevTools' element coordinates and compare
the target's top edge with the viewport bottom rather than relying only on
visual estimation.

## Compatibility

If `IntersectionObserver` is unavailable, the hook currently does not force
a network load. A project-level polyfill/fallback can be added if legacy
browser support is required. Modern supported browsers provide
`IntersectionObserver` natively.
