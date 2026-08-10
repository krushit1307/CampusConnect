/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

export interface CommandObj {
  id: string;
  title: string;
  action: () => void;
  icon?: ComponentType<{ className?: string }>;
  keywords?: string[];
  group?: string;
}

type CommandPaletteContextValue = {
  commands: CommandObj[];
  registerCommand: (command: CommandObj) => void;
  unregisterCommand: (id: string) => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | undefined>(undefined);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [commands, setCommands] = useState<CommandObj[]>([]);

  const registerCommand = useCallback((command: CommandObj) => {
    setCommands((prev) => {
      const existingIndex = prev.findIndex((c) => c.id === command.id);
      if (existingIndex === -1) {
        return [...prev, command];
      }
      const next = [...prev];
      next[existingIndex] = command;
      return next;
    });
  }, []);

  const unregisterCommand = useCallback((id: string) => {
    setCommands((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const value = useMemo(
    () => ({ commands, registerCommand, unregisterCommand }),
    [commands, registerCommand, unregisterCommand],
  );

  return <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>;
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);

  if (!context) {
    throw new Error("useCommandPalette must be used within a CommandPaletteProvider");
  }

  return context;
}

/**
 * Registers a command with the global Command Palette while the calling
 * component is mounted. The command is automatically unregistered when the
 * component unmounts.
 *
 * Pass `null` to skip registration entirely (e.g. for role-gated commands).
 *
 * To avoid stale closures, the `action` is always invoked through a ref that is
 * refreshed on every render. Re-registration is keyed on a stable string
 * snapshot of the command's display metadata so that callers can pass fresh
 * object/array literals on every render without causing registration churn.
 */
export function useCommand(command: CommandObj | null) {
  const { registerCommand, unregisterCommand } = useCommandPalette();

  // Always invoke the freshest action closure, even if the command itself has
  // not been re-registered (e.g. local state changed inside the caller).
  const actionRef = useRef<CommandObj["action"]>(() => {});
  if (command) {
    actionRef.current = command.action;
  }

  // Stable serialized snapshot of the fields that affect how the palette
  // displays the command. Arrays are joined so identity changes do not churn.
  const snapshot = command
    ? `${command.id}|${command.title}|${(command.keywords || []).join(",")}|${command.group || ""}`
    : null;

  useEffect(() => {
    if (!command || !snapshot) return;

    registerCommand({
      id: command.id,
      title: command.title,
      icon: command.icon,
      keywords: command.keywords,
      group: command.group,
      action: () => actionRef.current(),
    });

    return () => unregisterCommand(command.id);
  }, [snapshot, registerCommand, unregisterCommand]);
}
