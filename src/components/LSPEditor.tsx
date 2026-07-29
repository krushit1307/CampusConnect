/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useLSPClient } from "@/hooks/useLSPClient";
import { Loader2, Radio, AlertCircle, CheckCircle, HelpCircle } from "lucide-react";

interface LSPEditorProps {
  defaultValue?: string;
  value?: string;
  onChange?: (val: string) => void;
  language?: string;
  theme?: string;
  wsUrl?: string;
  documentUri?: string;
}

// Global cache to prevent multiple script injections
let monacoLoadingPromise: Promise<any> | null = null;

function loadMonacoCDN(): Promise<any> {
  if (monacoLoadingPromise) return monacoLoadingPromise;

  monacoLoadingPromise = new Promise((resolve, reject) => {
    // If already loaded by another page/component
    if ((window as any).monaco) {
      return resolve((window as any).monaco);
    }

    // 1. Create loader script
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs/loader.min.js";
    script.async = true;

    script.onload = () => {
      const require = (window as any).require;
      if (!require) {
        return reject(new Error("Monaco require loader not found"));
      }

      // Configure AMD loader to fetch VS folder from CDN
      require.config({
        paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs" },
      });

      // Load editor main module
      require(["vs/editor/editor.main"], () => {
        resolve((window as any).monaco);
      });
    };

    script.onerror = (err) => {
      reject(new Error("Failed to load Monaco script loader: " + String(err)));
    };

    document.body.appendChild(script);
  });

  return monacoLoadingPromise;
}

export function LSPEditor({
  defaultValue = "",
  value,
  onChange,
  language = "python",
  theme = "vs-dark",
  wsUrl = "ws://localhost:3003",
  documentUri = "file:///workspace/main.py",
}: LSPEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);

  const [monaco, setMonaco] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>("");

  // 1. Load Monaco Editor from CDN on mount
  useEffect(() => {
    loadMonacoCDN()
      .then((m) => {
        setMonaco(m);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoadError(err.message || "Failed to load Monaco editor from CDN.");
        setIsLoading(false);
      });
  }, []);

  // 2. Initialize Monaco Editor Instance once DOM container and Monaco are ready
  useEffect(() => {
    if (!monaco || !containerRef.current || editorRef.current) return;

    // Create the editor instance
    const editorInstance = monaco.editor.create(containerRef.current, {
      value: value !== undefined ? value : defaultValue,
      language,
      theme,
      automaticLayout: true,
      fontSize: 14,
      fontFamily: "Fira Code, Courier New, monospace",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      roundedSelection: false,
      padding: { top: 12, bottom: 12 },
    });

    editorRef.current = editorInstance;

    // Listen to changes to report back
    editorInstance.onDidChangeModelContent(() => {
      if (onChange) {
        onChange(editorInstance.getValue());
      }
    });

    // Handle container resizing
    const resizeObserver = new ResizeObserver(() => {
      editorInstance.layout();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      editorInstance.dispose();
      editorRef.current = null;
    };
  }, [monaco, defaultValue, language, theme]);

  // Update value dynamically if controlled prop changes
  useEffect(() => {
    if (editorRef.current && value !== undefined && value !== editorRef.current.getValue()) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  // 3. Coordinate with LSP client hook
  const { status: lspStatus } = useLSPClient(
    editorRef.current,
    monaco,
    wsUrl,
    documentUri,
    language,
  );

  const getStatusBadge = () => {
    switch (lspStatus) {
      case "connecting":
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 font-mono text-xs border border-blue-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            LSP CONNECTING
          </div>
        );
      case "connected":
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-800 font-mono text-xs border border-green-300 font-bold">
            <Radio className="h-3 w-3 text-green-600 animate-pulse" />
            LSP ACTIVE
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 font-mono text-xs border border-red-300">
            <AlertCircle className="h-3 w-3" />
            LSP ERROR / OFFLINE
          </div>
        );
      case "disconnected":
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-800 font-mono text-xs border border-gray-300">
            <HelpCircle className="h-3 w-3" />
            DISCONNECTED
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="neu-border bg-gray-50 h-[450px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-black" />
        <span className="font-mono text-sm uppercase font-bold tracking-tight">
          Loading Code Editor…
        </span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="neu-border bg-red-50 h-[450px] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-2" />
        <span className="font-mono text-sm font-bold text-red-800 uppercase block mb-1">
          Editor Load Failed
        </span>
        <span className="font-mono text-xs text-red-600 max-w-md">{loadError}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col neu-border bg-white overflow-hidden h-[480px]">
      {/* Editor Main Canvas */}
      <div ref={containerRef} className="flex-1 w-full min-h-0 bg-[#1e1e1e]" />

      {/* Editor Status Bar */}
      <div className="border-t-2 border-black bg-cream p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <span className="font-mono text-xs text-gray-500 uppercase">
            Language: <span className="font-bold text-black">{language}</span>
          </span>
        </div>
        <div className="font-mono text-[10px] text-gray-500 hidden sm:block uppercase">
          IntelliSense + Remote Diagnostics Enabled
        </div>
      </div>
    </div>
  );
}
export default LSPEditor;
