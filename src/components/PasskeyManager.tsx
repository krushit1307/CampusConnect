/**
 * PasskeyManager – Manages registered passkeys in the Settings page.
 *
 * Allows users to:
 * - View their registered passkeys
 * - Register a new passkey
 * - Rename existing passkeys
 * - Delete passkeys
 */

import { useEffect, useState } from "react";
import {
  Fingerprint,
  Key,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useWebAuthn, type PasskeyCredential } from "@/hooks/useWebAuthn";

export function PasskeyManager() {
  const {
    isSupported,
    hasPlatformAuth,
    isLoading,
    error,
    passkeys,
    isLoadingPasskeys,
    registerPasskey,
    fetchPasskeys,
    deletePasskey,
    renamePasskey,
    clearError,
  } = useWebAuthn();

  const [deviceName, setDeviceName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Fetch passkeys on mount
  useEffect(() => {
    fetchPasskeys();
  }, [fetchPasskeys]);

  // Show error as toast
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const handleRegister = async () => {
    const name = deviceName.trim() || getDefaultDeviceName();
    const success = await registerPasskey(name);
    if (success) {
      toast.success("Passkey registered successfully!");
      setDeviceName("");
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deletePasskey(id);
    if (success) {
      toast.success("Passkey removed.");
      setConfirmDeleteId(null);
    }
  };

  const handleRename = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;

    const success = await renamePasskey(id, trimmed);
    if (success) {
      toast.success("Passkey renamed.");
      setEditingId(null);
      setEditName("");
    }
  };

  const startEdit = (passkey: PasskeyCredential) => {
    setEditingId(passkey.id);
    setEditName(passkey.device_name || "");
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  if (!isSupported) {
    return (
      <div className="font-mono text-xs text-gray-500 dark:text-gray-300">
        <p>
          Your browser does not support passkeys (WebAuthn). Use a modern browser like Chrome,
          Safari, Edge, or Firefox to manage passkeys.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-black dark:text-cream">
        <ShieldCheck className="h-5 w-5" />
        <p className="font-mono text-xs">
          {hasPlatformAuth
            ? "Your device supports biometric authentication (Touch ID, Face ID, Windows Hello)."
            : "Your device supports security key authentication."}
        </p>
      </div>

      {/* Registered passkeys list */}
      {isLoadingPasskeys ? (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="font-mono text-xs">Loading passkeys…</span>
        </div>
      ) : passkeys.length === 0 ? (
        <div className="border-2 border-dashed border-black/30 p-4">
          <p className="font-mono text-xs text-gray-500 dark:text-gray-300">
            No passkeys registered yet. Add one below to enable passwordless sign-in.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {passkeys.map((passkey) => (
            <div
              key={passkey.id}
              className="neu-border flex items-center gap-3 bg-white p-3 dark:bg-brand-gray-base-800"
            >
              <div className="flex-shrink-0">
                {passkey.transports?.includes("internal") ? (
                  <Fingerprint className="h-5 w-5 text-black dark:text-cream" />
                ) : (
                  <Key className="h-5 w-5 text-black dark:text-cream" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                {editingId === passkey.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(passkey.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-1 font-mono text-sm outline-none focus:bg-lime/40"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(passkey.id)}
                      className="p-1 text-green-700 hover:bg-green-100"
                      aria-label="Save name"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="p-1 text-gray-500 hover:bg-gray-100"
                      aria-label="Cancel rename"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="truncate font-mono text-sm font-bold text-black dark:text-cream">
                      {passkey.device_name || "Passkey"}
                    </p>
                    <p className="font-mono text-xs text-gray-500 dark:text-gray-300">
                      Added {new Date(passkey.created_at).toLocaleDateString()}
                      {passkey.last_used_at &&
                        ` · Last used ${new Date(passkey.last_used_at).toLocaleDateString()}`}
                      {passkey.backed_up && " · Synced"}
                    </p>
                  </>
                )}
              </div>

              {editingId !== passkey.id && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(passkey)}
                    className="p-1.5 text-gray-500 transition-colors hover:text-black dark:hover:text-cream"
                    aria-label={`Rename ${passkey.device_name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>

                  {confirmDeleteId === passkey.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(passkey.id)}
                        disabled={isLoading}
                        className="neu-border bg-red-500 px-2 py-1 font-mono text-xs font-bold text-white hover:bg-red-600"
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 font-mono text-xs text-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteId(passkey.id);
                        setEditingId(null);
                      }}
                      className="p-1.5 text-gray-500 transition-colors hover:text-red-600"
                      aria-label={`Delete ${passkey.device_name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Register new passkey */}
      <div className="border-t-2 border-black pt-4">
        <p className="eyebrow mb-2 font-bold text-black dark:text-cream">Add a new passkey</p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block font-mono text-xs text-gray-500 dark:text-gray-300">
              Device name (optional)
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder={getDefaultDeviceName()}
              className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
            />
          </div>
          <button
            type="button"
            onClick={handleRegister}
            disabled={isLoading}
            className="neu-border neu-press flex items-center gap-2 bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-cream disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Registering…
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" />
                Add Passkey
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Returns a sensible default device name based on the user agent.
 */
function getDefaultDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iPhone / iPad";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Android/.test(ua)) return "Android Device";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Linux/.test(ua)) return "Linux Device";
  return "My Device";
}
