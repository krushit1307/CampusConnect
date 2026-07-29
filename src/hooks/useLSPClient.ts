/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";

// Minimal interfaces matching LSP spec and Monaco types
export interface LSPPosition {
  line: number;
  character: number;
}

export interface LSPRange {
  start: LSPPosition;
  end: LSPPosition;
}

export interface LSPDiagnostic {
  range: LSPRange;
  severity: number;
  message: string;
  source?: string;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

export function useLSPClient(
  editor: any, // Monaco editor instance
  monaco: any, // Monaco global instance
  wsUrl: string = "ws://localhost:3003",
  documentUri: string = "file:///workspace/main.py",
  languageId: string = "python",
) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const requestIdRef = useRef<number>(1);
  const pendingRequestsRef = useRef<Map<number, PendingRequest>>(new Map());
  const docVersionRef = useRef<number>(1);
  const completionProviderRef = useRef<any>(null);

  // Helper to send JSON-RPC messages
  const sendRequest = (method: string, params: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return reject(new Error("LSP connection is not active."));
      }

      const id = requestIdRef.current++;
      const payload = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      pendingRequestsRef.current.set(id, { resolve, reject });
      wsRef.current.send(JSON.stringify(payload));
    });
  };

  const sendNotification = (method: string, params: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const payload = {
      jsonrpc: "2.0",
      method,
      params,
    };
    wsRef.current.send(JSON.stringify(payload));
  };

  useEffect(() => {
    if (!editor || !monaco) return;

    setStatus("connecting");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = async () => {
      console.log("[LSP Client] Connected to LSP WebSocket proxy.");
      setStatus("connected");

      // 1. Send LSP Initialize request
      try {
        await sendRequest("initialize", {
          processId: null,
          rootUri: "file:///workspace",
          capabilities: {
            textDocument: {
              completion: {
                completionItem: {
                  snippetSupport: true,
                },
              },
            },
          },
        });

        // 2. Notify LSP initialized
        sendNotification("initialized", {});

        // 3. Notify LSP that document is opened
        sendNotification("textDocument/didOpen", {
          textDocument: {
            uri: documentUri,
            languageId,
            version: docVersionRef.current,
            text: editor.getValue(),
          },
        });
      } catch (err) {
        console.error("[LSP Client] Initialize handshake failed:", err);
        setStatus("error");
      }
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        // Check if message is a response to a pending request
        if (payload.id !== undefined && pendingRequestsRef.current.has(payload.id)) {
          const { resolve, reject } = pendingRequestsRef.current.get(payload.id)!;
          pendingRequestsRef.current.delete(payload.id);

          if (payload.error) {
            reject(payload.error);
          } else {
            resolve(payload.result);
          }
          return;
        }

        // Handle incoming notifications (e.g. diagnostics)
        if (payload.method === "textDocument/publishDiagnostics") {
          const { uri, diagnostics } = payload.params;
          if (uri === documentUri) {
            applyDiagnostics(diagnostics);
          }
        }
      } catch (err) {
        console.error("[LSP Client] Error parsing incoming WS payload:", err);
      }
    };

    ws.onclose = () => {
      console.log("[LSP Client] Connection closed.");
      setStatus("disconnected");
      clearMarkers();
    };

    ws.onerror = (err) => {
      console.error("[LSP Client] WebSocket error:", err);
      setStatus("error");
    };

    // 4. Register Monaco autocomplete (IntelliSense) completion provider
    completionProviderRef.current = monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: [".", "@", "/"],
      provideCompletionItems: async (model: any, position: any) => {
        if (ws.readyState !== WebSocket.OPEN) return { suggestions: [] };

        try {
          const res = await sendRequest("textDocument/completion", {
            textDocument: { uri: documentUri },
            position: {
              line: position.lineNumber - 1,
              character: position.column - 1,
            },
          });

          // Support both CompletionList and CompletionItem[]
          const items = Array.isArray(res) ? res : res?.items || [];

          // Map LSP Completion Items to Monaco Completion Items
          const suggestions = items.map((item: any) => {
            const insertText = item.insertText || item.label;

            // Monaco snippet strings are represented by completion type 2
            const isSnippet = item.insertTextFormat === 2;

            return {
              label: item.label,
              kind: mapLspKindToMonaco(item.kind),
              detail: item.detail,
              documentation: item.documentation?.value || item.documentation || "",
              insertText,
              insertTextRules: isSnippet
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
              range: undefined,
            };
          });

          return { suggestions };
        } catch (err) {
          console.error("[LSP Client] Autocomplete fetch failed:", err);
          return { suggestions: [] };
        }
      },
    });

    // 5. Track editor content changes to notify LSP
    const changeSubscription = editor.onDidChangeModelContent(() => {
      docVersionRef.current++;
      sendNotification("textDocument/didChange", {
        textDocument: {
          uri: documentUri,
          version: docVersionRef.current,
        },
        contentChanges: [
          {
            text: editor.getValue(),
          },
        ],
      });
    });

    return () => {
      ws.close();
      changeSubscription.dispose();
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
      }
      clearMarkers();
    };
  }, [editor, monaco, wsUrl, documentUri, languageId]);

  // Maps LSP Diagnostics to Monaco markers
  const applyDiagnostics = (diagnostics: LSPDiagnostic[]) => {
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    const markers = diagnostics.map((diag) => {
      const severityMap: Record<number, any> = {
        1: monaco.MarkerSeverity.Error,
        2: monaco.MarkerSeverity.Warning,
        3: monaco.MarkerSeverity.Info,
        4: monaco.MarkerSeverity.Hint,
      };

      return {
        severity: severityMap[diag.severity] || monaco.MarkerSeverity.Error,
        message: diag.message,
        source: diag.source || "Pyright",
        startLineNumber: diag.range.start.line + 1,
        startColumn: diag.range.start.character + 1,
        endLineNumber: diag.range.end.line + 1,
        endColumn: diag.range.end.character + 1,
      };
    });

    monaco.editor.setModelMarkers(model, "lsp-markers", markers);
  };

  const clearMarkers = () => {
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelMarkers(model, "lsp-markers", []);
    }
  };

  // Helper maps LSP completion kind (number) to Monaco completion kind (number)
  const mapLspKindToMonaco = (kind?: number) => {
    if (!monaco) return 0;
    const map: Record<number, number> = {
      1: monaco.languages.CompletionItemKind.Text,
      2: monaco.languages.CompletionItemKind.Method,
      3: monaco.languages.CompletionItemKind.Function,
      4: monaco.languages.CompletionItemKind.Constructor,
      5: monaco.languages.CompletionItemKind.Field,
      6: monaco.languages.CompletionItemKind.Variable,
      7: monaco.languages.CompletionItemKind.Class,
      8: monaco.languages.CompletionItemKind.Interface,
      9: monaco.languages.CompletionItemKind.Module,
      10: monaco.languages.CompletionItemKind.Property,
      11: monaco.languages.CompletionItemKind.Unit,
      12: monaco.languages.CompletionItemKind.Value,
      13: monaco.languages.CompletionItemKind.Enum,
      14: monaco.languages.CompletionItemKind.Keyword,
      15: monaco.languages.CompletionItemKind.Snippet,
      16: monaco.languages.CompletionItemKind.Color,
      17: monaco.languages.CompletionItemKind.File,
      18: monaco.languages.CompletionItemKind.Reference,
      19: monaco.languages.CompletionItemKind.Folder,
      20: monaco.languages.CompletionItemKind.EnumMember,
      21: monaco.languages.CompletionItemKind.Constant,
      22: monaco.languages.CompletionItemKind.Struct,
      23: monaco.languages.CompletionItemKind.Event,
      24: monaco.languages.CompletionItemKind.Operator,
      25: monaco.languages.CompletionItemKind.TypeParameter,
    };
    return kind !== undefined ? map[kind] || 0 : 0;
  };

  return { status };
}
