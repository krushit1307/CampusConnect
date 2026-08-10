import { toast } from "sonner";
import { AudioEngine } from "./audioEngine";

/**
 * Wires procedural success/error sounds into sonner's toast() calls,
 * app-wide, with zero changes to any existing toast.success(...) /
 * toast.error(...) call site.
 *
 * This works because `toast` imported from "sonner" is a module-level
 * singleton — every file in the app that does `import { toast } from
 * "sonner"` receives the exact same object reference. Wrapping
 * `toast.success` / `toast.error` once, here, mutates that shared object,
 * so every existing and future call site picks up the sound automatically.
 *
 * Must be imported once, as early as possible (see src/routes/__root.tsx),
 * before any toast.success/toast.error call can fire.
 */
let wired = false;

export function wireToastSounds(): void {
  if (wired) return;
  wired = true;

  const originalSuccess = toast.success.bind(toast);
  const originalError = toast.error.bind(toast);

  toast.success = ((...args: Parameters<typeof toast.success>) => {
    AudioEngine.playSuccess();
    return originalSuccess(...args);
  }) as typeof toast.success;

  toast.error = ((...args: Parameters<typeof toast.error>) => {
    AudioEngine.playError();
    return originalError(...args);
  }) as typeof toast.error;
}
