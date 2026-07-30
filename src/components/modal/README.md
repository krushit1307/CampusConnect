# Unified Modal Manager (issue #1916)

A single React context that owns modal state for the whole app,
preventing the "two modals fighting for Z-index supremacy" bug that
happens when every consumer manages its own `useState(false)`.

## Why

Before this module, each consumer declared its own:

```ts
const [isLoginOpen, setLoginOpen] = useState(false);
const [isFilterOpen, setFilterOpen] = useState(false);
```

Clicking "Login" and then "Filter" would open **both** at once. The
unified context replaces this with one piece of state, so opening a
new modal automatically closes whatever was open before.

## Usage

### 1. Wrap your app in `<ModalProvider>`

```tsx
import { ModalProvider } from "@/components/modal";

function App() {
  return (
    <ModalProvider>
      <Routes />
      <ModalRoot registrations={...} />
    </ModalProvider>
  );
}
```

### 2. Open modals from anywhere

```tsx
import { useModal } from "@/components/modal";

function LoginButton() {
  const { openModal } = useModal();
  return <button onClick={() => openModal("LOGIN", { redirectTo: "/feed" })}>Login</button>;
}
```

### 3. Register each modal kind with `<ModalRoot>`

```tsx
import { ModalRoot, makeRegistrations } from "@/components/modal";
import { BugReportModalBody } from "@/components/modal/adapters/BugReportModalBody";

<ModalRoot registrations={makeRegistrations({
  BUG_REPORT: BugReportModalBody,
  LOGIN: LoginModalBody,
})} />
```

## Adding a new modal kind

1. Add the kind to `ModalKind` in `ModalContext.types.ts`.
2. Add the props shape to `ModalPropsByKind`.
3. Build (or adapt) the modal body component.
4. Register it in `<ModalRoot registrations={...} />`.

TypeScript catches missing steps at compile time.

## Public API

| Export | Purpose |
| --- | --- |
| `ModalProvider` | Owns the modal state. |
| `useModal` | Hook for consumers; throws if used outside `<ModalProvider>`. |
| `ModalRoot` | The renderer; sits at the top of the app and listens to the context. |
| `makeRegistrations` | Ergonomic helper for wiring body components into the renderer. |

## Out of scope (future work)

- **Route-driven modals**: the issue's edge case suggests syncing
  activeModal with URL search params so links can deep-link into an
  open modal. That's a separate, larger change (touches routing +
  navigation) and belongs in its own PR.
- **Migrating the rest of the existing modals**: only the
  `BugReportModal` adapter is shipped in this PR. The remaining
  modals (login, filters, share, command palette, etc.) can be
  migrated incrementally using the same adapter pattern.
